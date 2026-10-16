import { describe, it, expect } from 'vitest';
import { initialWorldProgress } from '../../shared/world-items.js';
import { planRecipe, nearestMaterialSource } from './forge-planner';
describe('forge planning', () => {
  it('calculates exact shortages without spending resources and prevents duplicate crafting', () => {
    const world = initialWorldProgress();
    world.materials = { mineral: 3, madera: 8 };
    expect(planRecipe(world, 'hoja')!.ingredients.map((i) => i.missing)).toEqual([1, 0]);
    expect(planRecipe(world, 'hoja')!.ready).toBe(false);
    world.materials.mineral = 4;
    expect(planRecipe(world, 'hoja')!.ready).toBe(true);
    world.items.push('explorer_blade');
    expect(planRecipe(world, 'hoja')!.ready).toBe(false);
    expect(world.materials).toEqual({ mineral: 4, madera: 8 });
    expect(planRecipe(world, 'constructor')).toBeNull();
  });
  it('prefers an available source and reports the nearest cooldown if all are exhausted', () => {
    const nodes = [
      { id: 'near', name: 'Cerca', x: 1, z: 0, material: 'mineral', amount: 2 },
      { id: 'far', name: 'Lejos', x: 10, z: 0, material: 'mineral', amount: 2 },
    ];
    const at = { x: 0, z: 0 };
    expect(nearestMaterialSource('mineral', at, nodes, { near: 5000 }, 1000)!.node.id).toBe('far');
    const result = nearestMaterialSource('mineral', at, nodes, { near: 5000, far: 6000 }, 1000)!;
    expect(result.node.id).toBe('near');
    expect(result.waitSeconds).toBe(4);
    expect(nearestMaterialSource('mineral', at, nodes, { near: 1000 }, 1000)!.node.id).toBe('near');
    expect(nearestMaterialSource('madera', at, nodes, {}, 1000)).toBeNull();
  });
});
