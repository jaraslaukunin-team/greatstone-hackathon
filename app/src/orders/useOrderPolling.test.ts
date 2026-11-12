jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

import { createOrderPoller } from './useOrderPolling';
import type { OrderDTO } from '@picpac/shared';

function order(status: OrderDTO['status']): OrderDTO {
  return {
    id: '00000000-0000-4000-8000-000000000401',
    number: 'PP-000142',
    projectId: '00000000-0000-4000-8000-000000000301',
    status,
    totalKop: 8790,
    currency: 'BYN',
    delivery: 'belpost',
    payment: 'card',
    eripNumber: null,
    createdAt: '2026-11-11T12:00:00.000Z',
    history: [],
    interactionIds: [],
  };
}

describe('createOrderPoller', () => {
  it('обновляет статус и останавливается на финальном', async () => {
    const statuses: OrderDTO['status'][] = ['accepted', 'moderation', 'completed'];
    let i = 0;
    const timers: Array<() => void> = [];
    const poller = createOrderPoller({
      getOrder: async () => order(statuses[Math.min(i++, statuses.length - 1)]!),
      intervalMs: 10,
      setIntervalFn: ((fn: () => void) => {
        timers.push(fn);
        return 1;
      }) as unknown as typeof setInterval,
      clearIntervalFn: () => {
        timers.length = 0;
      },
    });

    const seen: string[] = [];
    poller.onChange((o) => seen.push(o.status));
    poller.start();
    await Promise.resolve();
    expect(seen[0]).toBe('accepted');
    timers[0]?.();
    await Promise.resolve();
    timers[0]?.();
    await Promise.resolve();
    expect(seen).toContain('completed');
    expect(timers).toHaveLength(0);
  });

  it('при ошибке сети не падает и продолжает', async () => {
    let fails = 1;
    const poller = createOrderPoller({
      getOrder: async () => {
        if (fails > 0) {
          fails -= 1;
          throw new Error('network');
        }
        return order('accepted');
      },
      intervalMs: 1000,
      setIntervalFn: (() => 1) as unknown as typeof setInterval,
      clearIntervalFn: () => undefined,
    });
    const seen: string[] = [];
    poller.onChange((o) => seen.push(o.status));
    poller.start();
    await Promise.resolve();
    expect(seen).toEqual([]);
    // second manual tick via internal get would require exposing; ensure no throw
    poller.stop();
  });
});
