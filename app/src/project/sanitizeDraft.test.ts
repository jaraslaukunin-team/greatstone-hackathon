import { sanitizeDraft } from './sanitizeDraft';

const good = { project: { id: 'p', variantId: 'v' }, layout: { pages: [] }, idempotencyKey: null };

describe('sanitizeDraft', () => {
  it('оставляет целый черновик', () => {
    expect(sanitizeDraft(good)).toBe(good);
  });
  it('отбрасывает черновик, в котором вместо проекта только версия', () => {
    expect(sanitizeDraft({ project: { version: 3 }, idempotencyKey: null })).toBeNull();
  });
  it('отбрасывает черновик без макета, пустое значение и не объект', () => {
    expect(sanitizeDraft({ project: { id: 'p', variantId: 'v' } })).toBeNull();
    expect(sanitizeDraft(null)).toBeNull();
    expect(sanitizeDraft('x')).toBeNull();
  });
});
