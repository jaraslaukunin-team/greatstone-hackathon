import { statusSteps, STATUS_FLOW } from './statusSteps';

describe('statusSteps', () => {
  it('отмечает шаги до текущего включительно', () => {
    const steps = statusSteps('production');
    expect(steps).toHaveLength(STATUS_FLOW.length);
    expect(steps.map((s) => s.reached)).toEqual([true, true, true, false, false]);
    expect(steps.find((s) => s.current)?.status).toBe('production');
  });

  it('на completed все шаги достигнуты', () => {
    const steps = statusSteps('completed');
    expect(steps.every((s) => s.reached)).toBe(true);
    expect(steps[steps.length - 1]?.current).toBe(true);
  });

  it('при cancelled ничего не достигнуто', () => {
    const steps = statusSteps('cancelled');
    expect(steps.every((s) => !s.reached && !s.current)).toBe(true);
  });
});
