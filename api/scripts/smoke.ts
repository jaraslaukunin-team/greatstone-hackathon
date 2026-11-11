// Сквозная проверка обязательного пути по HTTP: гость → каталог → проект → 10 фото → макет → цена →
// заказ (дважды с одним ключом) → оператор меняет статус → клиент видит новый статус.
// Запуск: npx tsx api/scripts/smoke.ts https://api.example.com
// Нужны выполненные миграции и сид (npm run db:migrate, npm run db:seed) и DEMO_MODE=true на сервере:
// оператор входит по тестовому коду 000000.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.argv[2]?.replace(/\/+$/, '');
if (!base) {
  console.error('Использование: npx tsx api/scripts/smoke.ts <адрес API>, например http://localhost:3000');
  process.exit(2);
}

type Json = Record<string, any>;
type Res = { status: number; json: any; headers: Headers };

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; form?: FormData; headers?: Record<string, string> } = {},
): Promise<Res> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // Ответ не JSON (например, файл): оставляем текст.
  }
  return { status: res.status, json, headers: res.headers };
}

function expectStatus(res: Res, expected: number, what: string): void {
  if (res.status !== expected) {
    throw new Error(`${what}: ожидался статус ${expected}, получен ${res.status} ${JSON.stringify(res.json).slice(0, 300)}`);
  }
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    console.log(`OK ${name}`);
    return result;
  } catch (e) {
    console.error(`FAIL ${name}: ${(e as Error).message}`);
    process.exit(1);
  }
}

const photo = await readFile(fileURLToPath(new URL('../fixtures/photo-ok.jpg', import.meta.url)));
const address = { recipient: 'Тест Тестов', phone: '+375291234567', city: 'Минск', street: 'ул. Тестовая, 1' };

await step('health', async () => {
  const r = await call('GET', '/health');
  expectStatus(r, 200, 'GET /health');
});

const guest = await step('гость', async () => {
  const r = await call('POST', '/auth/guest');
  expectStatus(r, 200, 'POST /auth/guest');
  return r.json as { token: string; user: Json };
});

const variant = await step('каталог', async () => {
  const r = await call('GET', '/catalog', { token: guest.token });
  expectStatus(r, 200, 'GET /catalog');
  const product = (r.json.products as Json[]).find((p) => p.title === 'Печать 10×15');
  const v = (product?.variants as Json[] | undefined)?.find((x) => x.format === '10×15 глянцевая');
  if (!v) throw new Error('в каталоге нет печати 10×15: выполните npm run db:seed');
  return v;
});

const projectId = await step('проект', async () => {
  const r = await call('POST', '/projects', { token: guest.token, body: { variantId: variant.id, title: 'Smoke-тест' } });
  expectStatus(r, 201, 'POST /projects');
  return r.json.id as string;
});

const photoIds = await step('10 фото', async () => {
  const ids: string[] = [];
  for (let i = 0; i < 10; i++) {
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), `smoke-${i}.jpg`);
    const r = await call('POST', `/projects/${projectId}/photos`, { token: guest.token, form });
    expectStatus(r, 201, `загрузка фото ${i + 1}`);
    ids.push(r.json.id);
  }
  const list = await call('GET', `/projects/${projectId}/photos`, { token: guest.token });
  expectStatus(list, 200, 'GET /projects/:id/photos');
  if (list.json.length !== 10) throw new Error(`в проекте ${list.json.length} фото вместо 10`);
  const file = await call('GET', list.json[0].url);
  expectStatus(file, 200, 'скачивание фото по подписанной ссылке');
  return ids;
});

await step('макет (10 страниц)', async () => {
  const layout = {
    pages: photoIds.map((id) => ({
      template: 'one',
      copies: 1,
      cells: [{ photoId: id, crop: { x: 0, y: 0, scale: 1, rotation: 0 } }],
    })),
  };
  const r = await call('PUT', `/projects/${projectId}`, { token: guest.token, body: { layout, version: 1 } });
  expectStatus(r, 200, 'PUT /projects/:id');
});

const quote = await step('цена', async () => {
  const r = await call('POST', '/price-quote', {
    token: guest.token,
    body: { variantId: variant.id, pages: 10, quantity: 1, delivery: 'ems' },
  });
  expectStatus(r, 200, 'POST /price-quote');
  if (!Number.isInteger(r.json.totalKop) || r.json.totalKop <= 0) throw new Error(`странная сумма ${r.json.totalKop}`);
  return r.json as { totalKop: number };
});

const key = randomUUID();
const order = await step('заказ', async () => {
  const body = { projectId, delivery: 'ems', expectedTotalKop: quote.totalKop, address };
  const first = await call('POST', '/orders', { token: guest.token, body, headers: { 'idempotency-key': key } });
  expectStatus(first, 201, 'POST /orders');
  return first.json as { id: string; status: string; totalKop: number };
});

await step('повтор заказа с тем же ключом не создаёт дубль', async () => {
  const body = { projectId, delivery: 'ems', expectedTotalKop: quote.totalKop, address };
  const again = await call('POST', '/orders', { token: guest.token, body, headers: { 'idempotency-key': key } });
  expectStatus(again, 200, 'повторный POST /orders');
  if (again.json.id !== order.id) throw new Error('повтор вернул другой заказ');
  const list = await call('GET', '/orders', { token: guest.token });
  expectStatus(list, 200, 'GET /orders');
  if (list.json.length !== 1) throw new Error(`у клиента ${list.json.length} заказов вместо одного`);
});

const operator = await step('вход оператора', async () => {
  const contact = 'operator@test.local';
  expectStatus(await call('POST', '/auth/request-code', { body: { contact } }), 204, 'POST /auth/request-code');
  const r = await call('POST', '/auth/verify-code', { body: { contact, code: '000000' } });
  if (r.status !== 200) throw new Error(`вход оператора не удался (${r.status}): для smoke нужны сид и DEMO_MODE=true`);
  return r.json as { token: string };
});

await step('оператор переводит заказ на модерацию', async () => {
  const r = await call('POST', `/operator/orders/${order.id}/status`, {
    token: operator.token,
    body: { status: 'moderation', comment: 'Smoke-тест' },
  });
  expectStatus(r, 200, 'POST /operator/orders/:id/status');
});

await step('клиент видит новый статус', async () => {
  const r = await call('GET', `/orders/${order.id}`, { token: guest.token });
  expectStatus(r, 200, 'GET /orders/:id');
  if (r.json.status !== 'moderation') throw new Error(`статус ${r.json.status} вместо moderation`);
  if (r.json.history.length !== 2) throw new Error(`в истории ${r.json.history.length} записей вместо 2`);
});

console.log('SMOKE PASSED');
