import { ru, be } from './strings';

/** Recursively collect all leaf string paths from a value. */
function leafPaths(value: unknown, path: string[] = []): string[] {
  if (typeof value === 'string') {
    return [path.join('.')];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => leafPaths(item, [...path, String(i)]));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, [...path, k]));
  }
  return [];
}

/** Traverse object by a path array like ['onboarding', 'cards', '0', 'title']. */
function getByPath(obj: unknown, parts: string[]): unknown {
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      cur = cur[parseInt(part, 10)];
    } else {
      cur = (cur as Record<string, unknown>)[part];
    }
  }
  return cur;
}

test('ru and be have identical key sets', () => {
  const ruKeys = leafPaths(ru).sort();
  const beKeys = leafPaths(be).sort();
  expect(beKeys).toEqual(ruKeys);
});

test('no empty strings in ru', () => {
  for (const path of leafPaths(ru)) {
    const val = getByPath(ru, path.split('.'));
    if (typeof val === 'string') {
      expect(val.length).toBeGreaterThan(0);
    }
  }
});

test('no empty strings in be', () => {
  for (const path of leafPaths(be)) {
    const val = getByPath(be, path.split('.'));
    if (typeof val === 'string') {
      expect(val.length).toBeGreaterThan(0);
    }
  }
});

test('faq has 10 items in ru', () => {
  expect(ru.faq.items).toHaveLength(10);
});

test('faq has 10 items in be', () => {
  expect(be.faq.items).toHaveLength(10);
});

test('onboarding has 3 cards in ru', () => {
  expect(ru.onboarding.cards).toHaveLength(3);
});

test('onboarding has 3 cards in be', () => {
  expect(be.onboarding.cards).toHaveLength(3);
});
