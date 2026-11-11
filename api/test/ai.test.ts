import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { aiJobSchema, photoSchema } from '@picpac/shared';
import { auditLog, consents, aiJobs, productVariants, projectMembers, projectPhotos, projects } from '../src/db/schema.js';
import { AiaiProvider } from '../src/modules/ai/aiaiProvider.js';
import { BLOCKED_TERMS, isPromptAllowed } from '../src/modules/ai/promptFilter.js';
import { StubProvider } from '../src/modules/ai/stubProvider.js';
import type { ImageEditProvider } from '../src/modules/ai/provider.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name));
const SOURCE = fixture('photo-ok.jpg');
const RESULT = fixture('ai-result.jpg');
const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-11-11T12:00:00Z');

describe('фильтр запросов', () => {
  it('каждый запрещённый термин блокируется независимо от регистра и пробелов', () => {
    expect(BLOCKED_TERMS.length).toBeGreaterThan(5);
    for (const term of BLOCKED_TERMS) {
      expect(isPromptAllowed(`  сделай ${term.toUpperCase()}  фон `)).toBe(false);
    }
  });

  it('обычные запросы проходят', () => {
    for (const p of ['сделай меня в роллс-ройсе', 'add a sunset behind me', 'в стиле ретро']) {
      expect(isPromptAllowed(p)).toBe(true);
    }
  });
});

describe('провайдер aiai.by', () => {
  const base = { aiaiBaseUrl: 'https://ai.test/v1', aiaiApiKey: 'secret-key', aiaiModel: 'flux-1-kontext-pro' };
  const input = (prompt = 'сделай ярче') => ({
    image: SOURCE,
    mime: 'image/jpeg' as const,
    prompt,
    signal: new AbortController().signal,
  });
  type Call = { url: string; init: RequestInit };
  const fakeFetch = (respond: () => Response) => {
    const calls: Call[] = [];
    const impl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond();
    }) as unknown as typeof fetch;
    return { calls, impl };
  };

  it('режим images: multipart с model, prompt и image, ключ в заголовке, ответ b64_json', async () => {
    const f = fakeFetch(() => new Response(JSON.stringify({ data: [{ b64_json: RESULT.toString('base64') }] }), { status: 200 }));
    const provider = new AiaiProvider({ ...base, aiaiEditMode: 'images' }, f.impl);
    const out = await provider.edit(input());
    expect(out.image.equals(RESULT)).toBe(true);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.url).toBe('https://ai.test/v1/images/edits');
    expect((f.calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    const form = f.calls[0]!.init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('model')).toBe('flux-1-kontext-pro');
    expect(form.get('prompt')).toBe('сделай ярче');
    expect((form.get('image') as File).type).toBe('image/jpeg');
    expect(Buffer.from(await (form.get('image') as File).arrayBuffer()).equals(SOURCE)).toBe(true);
  });

  it('режим chat: JSON с картинкой как data URL, ответ разбирается из message.images', async () => {
    const dataUrl = `data:image/png;base64,${RESULT.toString('base64')}`;
    const f = fakeFetch(
      () => new Response(JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: dataUrl } }] } }] }), { status: 200 }),
    );
    const provider = new AiaiProvider({ ...base, aiaiEditMode: 'chat' }, f.impl);
    const out = await provider.edit(input('в стиле ретро'));
    expect(out.image.equals(RESULT)).toBe(true);
    expect(out.mime).toBe('image/png');
    expect(f.calls[0]!.url).toBe('https://ai.test/v1/chat/completions');
    const body = JSON.parse(f.calls[0]!.init.body as string) as {
      model: string;
      messages: { role: string; content: { type: string; text?: string; image_url?: { url: string } }[] }[];
    };
    expect(body.model).toBe('flux-1-kontext-pro');
    const content = body.messages[0]!.content;
    expect(content.find((c) => c.type === 'text')!.text).toBe('в стиле ретро');
    expect(content.find((c) => c.type === 'image_url')!.image_url!.url.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('ошибка HTTP и ответ без картинки дают понятную ошибку без ключа в тексте', async () => {
    const bad = fakeFetch(() => new Response('upstream failure', { status: 502 }));
    await expect(new AiaiProvider({ ...base, aiaiEditMode: 'images' }, bad.impl).edit(input())).rejects.toThrow(/502/);
    const empty = fakeFetch(() => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await expect(new AiaiProvider({ ...base, aiaiEditMode: 'images' }, empty.impl).edit(input())).rejects.toThrow();
    const noImage = fakeFetch(() => new Response(JSON.stringify({ choices: [{ message: { content: 'нет' } }] }), { status: 200 }));
    const err = await new AiaiProvider({ ...base, aiaiEditMode: 'chat' }, noImage.impl).edit(input()).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toContain('secret-key');
  });

  it('без ключа провайдер не создаётся: ошибка называет AIAI_API_KEY', () => {
    expect(() => new AiaiProvider({ ...base, aiaiApiKey: '', aiaiEditMode: 'images' })).toThrow(/AIAI_API_KEY/);
  });
});

describe('AI-редактор', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let alice: Session;
  let bob: Session;
  let projectId: string;
  let photoId: string;

  beforeAll(async () => {
    ({ app, db, reset } = await testApp());
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  const guest = async (): Promise<Session> => {
    const j = (await app.inject({ method: 'POST', url: '/auth/guest' })).json() as {
      token: string;
      user: { id: string };
    };
    return { token: j.token, id: j.user.id };
  };
  const call = (s: Session | null, method: 'GET' | 'POST', url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as object | undefined,
      headers: s ? { authorization: `Bearer ${s.token}` } : {},
    });
  const consent = (s: Session) => call(s, 'POST', '/ai/consent');
  const edit = (s: Session, extra: Record<string, unknown> = {}) =>
    call(s, 'POST', '/ai/edit', { projectId, photoId, prompt: 'сделай меня в роллс-ройсе', ...extra });
  const getJob = async (s: Session, id: string) => aiJobSchema.parse((await call(s, 'GET', `/ai/jobs/${id}`)).json());
  const photosOf = (pid = projectId) => db.select().from(projectPhotos).where(eq(projectPhotos.projectId, pid));

  async function addSourcePhoto(owner: Session, pid: string): Promise<string> {
    const id = randomUUID();
    const key = `projects/${pid}/${id}`;
    await app.storage.put(key, SOURCE);
    await db.insert(projectPhotos).values({
      id,
      projectId: pid,
      uploadedBy: owner.id,
      storagePath: key,
      position: 0,
      width: 2400,
      height: 1600,
    });
    return id;
  }
  async function makeProject(owner: Session, extra: Record<string, unknown> = {}): Promise<string> {
    const variantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Classic 20×20')))[0]!.id;
    return ((await call(owner, 'POST', '/projects', { variantId, title: 'AI', ...extra })).json() as { id: string }).id;
  }

  // Задачи работают в фоне: перед очисткой таблиц их нужно дождаться, иначе TRUNCATE упирается в их транзакции.
  afterEach(async () => {
    await app.ai.idle();
  });

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => NOW;
    app.ai.provider = new StubProvider();
    app.ai.timeoutMs = 90_000;
    alice = await guest();
    bob = await guest();
    projectId = await makeProject(alice);
    photoId = await addSourcePhoto(alice, projectId);
  });

  it('без согласия 403 AI_CONSENT_REQUIRED; согласие идемпотентно и отражается в /me', async () => {
    const res = await edit(alice);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('AI_CONSENT_REQUIRED');
    expect(await db.select().from(aiJobs)).toHaveLength(0);

    expect((await consent(alice)).statusCode).toBe(204);
    expect((await consent(alice)).statusCode).toBe(204);
    expect(await db.select().from(consents).where(eq(consents.userId, alice.id))).toHaveLength(1);
    expect((await call(alice, 'GET', '/me')).json().aiConsent).toBe(true);
  });

  it('запрещённая тема: 422 PROMPT_REJECTED, задача не создаётся; пустой и слишком длинный запрос 400', async () => {
    await consent(alice);
    const res = await edit(alice, { prompt: `сделай ${BLOCKED_TERMS[0]}` });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PROMPT_REJECTED');
    expect(await db.select().from(aiJobs)).toHaveLength(0);
    expect((await edit(alice, { prompt: '   ' })).statusCode).toBe(400);
    expect((await edit(alice, { prompt: 'я'.repeat(501) })).statusCode).toBe(400);
  });

  it('со StubProvider задача доходит до done: результат это новое фото source ai, макет проекта не тронут', async () => {
    await consent(alice);
    const [before] = await db.select().from(projects).where(eq(projects.id, projectId));
    const res = await edit(alice);
    expect(res.statusCode).toBe(202);
    const { jobId } = res.json() as { jobId: string };
    expect((await getJob(alice, jobId)).status).toMatch(/pending|done/);
    await app.ai.idle();

    const job = await getJob(alice, jobId);
    expect(job.status).toBe('done');
    const result = photoSchema.parse(job.resultPhoto);
    expect(result).toMatchObject({ source: 'ai', width: 1024, height: 1024, uploadedBy: alice.id });
    const rows = await photosOf();
    expect(rows).toHaveLength(2);
    const aiRow = rows.find((r) => r.source === 'ai')!;
    expect((await app.storage.get(aiRow.storagePath)).equals(RESULT)).toBe(true);
    const [after] = await db.select().from(projects).where(eq(projects.id, projectId));
    expect(after!.layout).toEqual(before!.layout);
    expect(after!.version).toBe(before!.version);
    const [row] = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId));
    expect(row).toMatchObject({ provider: 'stub', status: 'done', projectId });
    const logged = await db.select().from(auditLog).where(and(eq(auditLog.userId, alice.id), eq(auditLog.action, 'ai.edit')));
    expect(logged).toHaveLength(1);
  });

  it('сбой провайдера: job failed с причиной по-русски без деталей, фото не добавлено, лимит не уменьшается', async () => {
    await consent(alice);
    app.ai.provider = { name: 'broken', edit: async () => { throw new Error('boom: internal-secret-detail'); } };
    const { jobId } = (await edit(alice)).json() as { jobId: string };
    await app.ai.idle();
    const job = await getJob(alice, jobId);
    expect(job.status).toBe('failed');
    expect(job.reason).toMatch(/[а-яА-Я]/);
    expect(job.reason).not.toContain('internal-secret-detail');
    expect(job.resultPhoto).toBeUndefined();
    expect(await photosOf()).toHaveLength(1);

    app.ai.provider = new StubProvider();
    for (let i = 0; i < 10; i++) expect((await edit(alice)).statusCode).toBe(202);
    expect((await edit(alice)).statusCode).toBe(429);
  });

  it('ответ провайдера не картинка и зависший провайдер: job failed, процесс жив', async () => {
    await consent(alice);
    app.ai.provider = { name: 'junk', edit: async () => ({ image: Buffer.from('это не картинка'), mime: 'image/jpeg' }) };
    const a = (await edit(alice)).json() as { jobId: string };
    await app.ai.idle();
    expect((await getJob(alice, a.jobId)).status).toBe('failed');

    app.ai.timeoutMs = 50;
    app.ai.provider = {
      name: 'hang',
      edit: ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    };
    const b = (await edit(alice)).json() as { jobId: string };
    await app.ai.idle();
    const job = await getJob(alice, b.jobId);
    expect(job.status).toBe('failed');
    expect(job.reason).toMatch(/вовремя|ещё раз/);
  });

  it('11-я задача за час: 429 AI_LIMIT; через час снова можно; параллельные запросы не обходят лимит', async () => {
    await consent(alice);
    for (let i = 0; i < 10; i++) expect((await edit(alice)).statusCode).toBe(202);
    const over = await edit(alice);
    expect(over.statusCode).toBe(429);
    expect(over.json().error.code).toBe('AI_LIMIT');
    app.clock.now = () => new Date(NOW.getTime() + HOUR + 1000);
    const later = { ...alice };
    expect((await edit(later)).statusCode).toBe(202);

    await consent(bob);
    const bobProject = await makeProject(bob);
    const bobPhoto = await addSourcePhoto(bob, bobProject);
    const burst = await Promise.all(
      Array.from({ length: 12 }, () => call(bob, 'POST', '/ai/edit', { projectId: bobProject, photoId: bobPhoto, prompt: 'ярче' })),
    );
    expect(burst.filter((r) => r.statusCode === 202)).toHaveLength(10);
    expect(burst.filter((r) => r.statusCode === 429)).toHaveLength(2);
  });

  it('чужой проект, чужое фото, фото из другого проекта и не-uuid: 404; участник правит только свои фото', async () => {
    await consent(bob);
    expect((await call(bob, 'POST', '/ai/edit', { projectId, photoId, prompt: 'ярче' })).statusCode).toBe(404);

    await consent(alice);
    const other = await makeProject(alice);
    const otherPhoto = await addSourcePhoto(alice, other);
    expect((await edit(alice, { photoId: otherPhoto })).statusCode).toBe(404);
    expect((await edit(alice, { photoId: '00000000-0000-4000-8000-000000000000' })).statusCode).toBe(404);
    expect((await edit(alice, { projectId: 'not-a-uuid' })).statusCode).toBe(404);

    await db.update(projects).set({ isShared: true }).where(eq(projects.id, projectId));
    await db.insert(projectMembers).values({ projectId, userId: bob.id, role: 'contributor' });
    expect((await call(bob, 'POST', '/ai/edit', { projectId, photoId, prompt: 'ярче' })).statusCode).toBe(404);
    const bobsOwn = await addSourcePhoto(bob, projectId);
    expect((await call(bob, 'POST', '/ai/edit', { projectId, photoId: bobsOwn, prompt: 'ярче' })).statusCode).toBe(202);
  });

  it('заказанный проект: 409 PROJECT_ORDERED', async () => {
    await consent(alice);
    await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, projectId));
    const res = await edit(alice);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PROJECT_ORDERED');
  });

  it('статус задачи видит только её автор: чужой, неизвестный и не-uuid 404, без токена 401', async () => {
    await consent(alice);
    const { jobId } = (await edit(alice)).json() as { jobId: string };
    await app.ai.idle();
    expect((await call(bob, 'GET', `/ai/jobs/${jobId}`)).statusCode).toBe(404);
    expect((await call(alice, 'GET', '/ai/jobs/00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
    expect((await call(alice, 'GET', '/ai/jobs/not-a-uuid')).statusCode).toBe(404);
    expect((await call(null, 'GET', `/ai/jobs/${jobId}`)).statusCode).toBe(401);
    expect((await call(null, 'POST', '/ai/consent')).statusCode).toBe(401);
  });
});
