import { describe, expect, it } from 'vitest';
import { nearbyCombatTargets, nextCombatTarget } from './combat-targeting';
const enemy = (x: number, y = 0) => ({
  alive: true,
  mesh: { visible: true, position: { x, y, z: 0 } },
});
describe('combat target selection', () => {
  it('orders reachable rivals and excludes walls, floors, hidden and dead enemies', () => {
    const close = enemy(1),
      far = enemy(4),
      floor = enemy(1, 4),
      dead = enemy(2),
      hidden = enemy(2);
    dead.alive = false;
    hidden.mesh.visible = false;
    expect(
      nearbyCombatTargets([far, floor, dead, hidden, close], { x: 0, y: 0, z: 0 }, 12)
    ).toEqual([close, far]);
    expect(
      nearbyCombatTargets([far, close], { x: 0, y: 0, z: 0 }, 12, (x) => x > 2 && x < 3)
    ).toEqual([close]);
    expect(nearbyCombatTargets([far], { x: 0, y: 0, z: 0 }, 3)).toEqual([]);
  });
  it('cycles deterministically and handles missing or empty selections', () => {
    const a = enemy(1),
      b = enemy(2);
    expect(nextCombatTarget([a, b], undefined)).toBe(a);
    expect(nextCombatTarget([a, b], a)).toBe(b);
    expect(nextCombatTarget([a, b], b)).toBe(a);
    expect(nextCombatTarget([], a)).toBeUndefined();
  });
});
