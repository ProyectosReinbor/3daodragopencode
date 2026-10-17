import { describe, it, expect } from 'vitest';
import { CITY_ENCOUNTERS } from '../../shared/city-world.js';
import { nearestMonster } from './bestiary';
describe('monster destinations', () => {
  it('selects the closest actual encounter of the requested species', () => {
    for (const kind of ['wolf', 'skeleton', 'spirit', 'golem']) {
      const target = nearestMonster(kind, { x: 0, z: 0 })!;
      expect(target.id).toBe('monster-' + kind);
      expect(
        CITY_ENCOUNTERS.some((e) => e.kind === kind && e.x === target.x && e.z === target.z)
      ).toBe(true);
      const distance = Math.hypot(target.x, target.z);
      expect(
        CITY_ENCOUNTERS.filter((e) => e.kind === kind).every(
          (e) => Math.hypot(e.x, e.z) >= distance
        )
      ).toBe(true);
    }
  });
  it('rejects unknown species and inherited properties', () => {
    expect(nearestMonster('missing', { x: 0, z: 0 })).toBeNull();
    expect(nearestMonster('constructor', { x: 0, z: 0 })).toBeNull();
  });
});
