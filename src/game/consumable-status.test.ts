import { expect, it } from 'vitest';
import { consumableStatus } from './consumable-status';
const ready = { stock: 3, current: 20, maximum: 100, readyAt: 0, now: 1000, blocked: false };
it('explains full bars, empty stock and paused or pending actions', () => {
  expect(consumableStatus(ready)).toEqual({ disabled: false, label: 'Usar', state: 'ready' });
  expect(consumableStatus({ ...ready, current: 100 }).state).toBe('full');
  expect(consumableStatus({ ...ready, current: 101 }).disabled).toBe(true);
  expect(consumableStatus({ ...ready, stock: 0 }).state).toBe('empty');
  expect(consumableStatus({ ...ready, blocked: true }).state).toBe('blocked');
});
it('keeps cooldown visible until the precise availability boundary', () => {
  expect(consumableStatus({ ...ready, readyAt: 2500 }).label).toBe('Espera 2 s');
  expect(consumableStatus({ ...ready, readyAt: 1001 }).disabled).toBe(true);
  expect(consumableStatus({ ...ready, readyAt: 1000 }).disabled).toBe(false);
});
