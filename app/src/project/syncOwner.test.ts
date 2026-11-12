import { claimSync, isSyncOwner, releaseSync } from './syncOwner';

describe('syncOwner', () => {
  it('владелец — первый занявший; после его ухода право переходит следующему', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    claimSync('p', a);
    claimSync('p', b);
    expect(isSyncOwner('p', a)).toBe(true);
    expect(isSyncOwner('p', b)).toBe(false);
    releaseSync('p', a);
    expect(isSyncOwner('p', b)).toBe(true);
    releaseSync('p', b);
    expect(isSyncOwner('p', b)).toBe(false);
  });
  it('проекты независимы, повторный claim не дублирует', () => {
    const a = Symbol('a');
    claimSync('x', a);
    claimSync('x', a);
    claimSync('y', a);
    expect(isSyncOwner('x', a)).toBe(true);
    releaseSync('x', a);
    expect(isSyncOwner('x', a)).toBe(false);
    expect(isSyncOwner('y', a)).toBe(true);
    releaseSync('y', a);
  });
});
