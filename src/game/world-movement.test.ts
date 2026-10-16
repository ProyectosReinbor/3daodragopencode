import { describe, expect, it } from 'vitest';
import { moveWithCollisions } from './world-movement';
const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const wall = (x: number, z: number) => x >= 1 && x <= 1.5 && Math.abs(z) < 5;
describe('walk and dash collision sweep', () => {
  it('cannot dash through a thin facade and slides parallel to it', () => {
    const result = moveWithCollisions({ x: 0, z: 0 }, { x: 3, z: 0 }, bounds, wall);
    expect(result.x).toBeLessThan(1);
    const slide = moveWithCollisions({ x: 0.9, z: 0 }, { x: 2, z: 2 }, bounds, wall);
    expect(slide.x).toBeLessThan(1);
    expect(slide.z).toBeCloseTo(2);
  });
  it('keeps a dash inside room and world bounds', () => {
    expect(moveWithCollisions({ x: 9, z: 9 }, { x: 3, z: 3 }, bounds, () => false)).toEqual({
      x: 10,
      z: 10,
    });
  });
});
