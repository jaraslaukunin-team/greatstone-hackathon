import { orderStatusTone } from './statusTone';

it('uses distinct tones for active, finished and cancelled orders', () => {
  const statuses = ['accepted', 'moderation', 'production', 'ready_for_delivery', 'completed', 'cancelled'];
  expect(new Set(statuses.map((status) => orderStatusTone(status).statusColor)).size).toBe(statuses.length);
  expect(orderStatusTone('accepted')).toEqual(orderStatusTone(undefined));
  expect(orderStatusTone('production').backgroundColor).toBe('#FFF4CC');
  expect(orderStatusTone('ready_for_delivery').backgroundColor).toBe('#E3F0FB');
});
