import { describe, expect, it } from 'vitest';
import { Scene, Mesh, InstancedMesh, Vector3 } from 'three';
import { CITY_WORLD, createCityWorld } from './city-world';
import { craftWorldItem } from '../../shared/world-crafting.js';
import { initialWorldProgress } from '../../shared/world-items.js';

describe('Villavicencio conceptual world', () => {
  it('uses one colored terrain and keeps vegetation local in the snow biome', () => {
    const scene = new Scene();
    createCityWorld(scene);
    const terrain = scene.getObjectByName('city-terrain') as Mesh;
    expect(terrain.geometry.getAttribute('color').count).toBe(129 * 129);
    expect(scene.getObjectByName('city-biomes')).toBeUndefined();
    const snow = CITY_WORLD.biomes.find((b) => b.id === 'nieve')!;
    scene.userData.updateCityVegetation(new Vector3(snow.x, 0, snow.z));
    expect((scene.getObjectByName('city-leaves-nieve') as InstancedMesh).count).toBeGreaterThan(0);
    expect((scene.getObjectByName('city-leaves-bosque') as InstancedMesh).count).toBe(0);
    const places = CITY_WORLD.landmarks.filter((l) => l.type !== 'parque');
    for (const a of places)
      for (const b of places)
        if (a.id !== b.id) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(300);
  });
  it('includes requested landmarks and a connected continuous world', () => {
    expect(CITY_WORLD.landmarks.filter((l) => l.type === 'comercial')).toHaveLength(6);
    expect(new Set(CITY_WORLD.landmarks.map((l) => l.id)).size).toBe(12);
    const scene = new Scene();
    const world = createCityWorld(scene);
    expect(world.groundSize).toBe(7200);
    expect(world.portals).toHaveLength(0);
    expect(scene.getObjectByName('central-training-park')).toBeDefined();
    for (const landmark of CITY_WORLD.landmarks.filter((l) => l.type !== 'parque'))
      expect(scene.getObjectByName('landmark-' + landmark.id)).toBeDefined();
    expect(world.enemies.every((e) => Math.hypot(e.spawnPosition.x, e.spawnPosition.z) >= 15)).toBe(
      true
    );
  });
  it('charges crafting only after all materials are available and never twice', () => {
    const world = initialWorldProgress();
    world.materials = { mineral: 4, madera: 1 };
    expect(() => craftWorldItem(world, 'hoja')).toThrow();
    expect(world.materials.mineral).toBe(4);
    world.materials.madera = 2;
    expect(craftWorldItem(world, 'hoja').alreadyCrafted).toBe(false);
    expect(craftWorldItem(world, 'hoja').alreadyCrafted).toBe(true);
    expect(world.materials.mineral).toBe(0);
    expect(world.items.filter((id) => id === 'explorer_blade')).toHaveLength(1);
    expect(() => craftWorldItem(world, 'toString')).toThrow('Receta desconocida');
  });
});
