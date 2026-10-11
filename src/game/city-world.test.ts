import { describe, expect, it } from 'vitest';
import { Scene, Mesh, InstancedMesh, Vector3 } from 'three';
import { CITY_WORLD, createCityWorld } from './city-world';
import { craftWorldItem } from '../../shared/world-crafting.js';
import { initialWorldProgress } from '../../shared/world-items.js';
import { geographicWorldPosition, businessWorldPosition } from '../../shared/city-world.js';
import { VILLAVICENCIO_OSM } from '../../shared/villavicencio-osm.js';
import { cityRoadMarkup } from './city-map';

describe('Villavicencio geographic world', () => {
  it('preserves real road vertices and metre scale on both axes', () => {
    expect(CITY_WORLD.cartography).toBe('openstreetmap');
    expect(CITY_WORLD.roads.length).toBeGreaterThan(10000);
    const source = VILLAVICENCIO_OSM.roads[0];
    const road = CITY_WORLD.roads.find((r) => r.id === source.id)!;
    expect(road.points).toHaveLength(source.points.length);
    source.points.forEach(([lng, lat], i) => {
      const p = geographicWorldPosition(lat, lng);
      expect(road.points[i]).toEqual([p.x, p.z]);
    });
    const origin = CITY_WORLD.origin;
    const north = geographicWorldPosition(origin.lat + 0.001, origin.lng);
    const east = geographicWorldPosition(origin.lat, origin.lng + 0.001);
    expect(north.z).toBeCloseTo(-111.195, 2);
    expect(east.x).toBeGreaterThan(110);
    expect(businessWorldPosition({ lat: origin.lat + 0.001, lng: origin.lng })).toEqual(north);
    expect(businessWorldPosition({ lat: 5, lng: origin.lng })).toBeNull();
    const viva = CITY_WORLD.landmarks.find((l) => l.id === 'viva')!;
    expect(Math.hypot(viva.x, viva.z)).toBeGreaterThan(2900);
    expect(Math.hypot(viva.x, viva.z)).toBeLessThan(3000);
    expect(cityRoadMarkup(0, 0, 1800)).toContain('<polyline');
    expect(cityRoadMarkup(100000, 100000, 1800)).toBe('');
  });
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
    scene.userData.updateCityVegetation(new Vector3());
    const roads = scene.getObjectByName('city-road-network') as InstancedMesh;
    expect(roads.count).toBeLessThan(4096);
    expect(roads.count).toBeGreaterThan(0);
  });
  it('includes requested landmarks and a connected continuous world', () => {
    expect(CITY_WORLD.landmarks.filter((l) => l.type === 'comercial')).toHaveLength(6);
    expect(new Set(CITY_WORLD.landmarks.map((l) => l.id)).size).toBe(12);
    const scene = new Scene();
    const world = createCityWorld(scene);
    expect(world.groundSize).toBe(40000);
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
