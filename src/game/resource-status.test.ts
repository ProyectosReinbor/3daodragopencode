import { describe, expect, it } from 'vitest';
import { nearbyResource, resourceWait } from './resource-status';
describe('resource status', () => {
  it('counts down without unlocking early and handles expired or missing timers', () => {
    expect(resourceWait('ore', { ore: 2001 }, 1000)).toBe(2);
    expect(resourceWait('ore', { ore: 2001 }, 2000)).toBe(1);
    expect(resourceWait('ore', { ore: 2001 }, 2001)).toBe(0);
    expect(resourceWait('ore', {}, 2001)).toBe(0);
    expect(resourceWait('ore', { ore: NaN }, 2001)).toBe(0);
  });
  it('chooses the closest resource in range rather than catalog order', () => {
    const nodes = [
      { id: 'far', name: 'Lejos', material: 'madera', amount: 1, x: 3, z: 0 },
      { id: 'near', name: 'Cerca', material: 'mineral', amount: 2, x: 1, z: 0 },
    ];
    expect(nearbyResource({ x: 0, z: 0 }, nodes, 4)?.id).toBe('near');
    expect(nearbyResource({ x: 9, z: 9 }, nodes, 4)).toBeNull();
    expect(nodes[0].id).toBe('far');
  });
});
