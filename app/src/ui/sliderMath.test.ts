import { clampSplit, stepSplit } from './sliderMath';

describe('clampSplit', () => {
  it('переводит координату в долю ширины и держит её в 0..1', () => {
    expect(clampSplit(-5, 100)).toBe(0);
    expect(clampSplit(50, 100)).toBe(0.5);
    expect(clampSplit(150, 100)).toBe(1);
  });
  it('при нулевой ширине (ещё не измерено) ставит середину', () => {
    expect(clampSplit(10, 0)).toBe(0.5);
  });
});

describe('stepSplit', () => {
  it('стрелки двигают на 5% и не выходят за границы', () => {
    expect(stepSplit(0.5, 1)).toBeCloseTo(0.55, 6);
    expect(stepSplit(0.02, -1)).toBe(0);
    expect(stepSplit(0.98, 1)).toBe(1);
  });
});
