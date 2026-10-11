import { describe, expect, it, vi } from 'vitest';
import { InstancedMesh, Mesh, MeshLambertMaterial, Scene, Vector3 } from 'three';
import { createCityWorld } from './city-world';
import { ROAD_SEGMENTS, URBAN_BUILDINGS, citySurfaceHeight } from './city-urban';
import { geographicWorldPosition } from '../../shared/city-world.js';
import { VILLAVICENCIO_URBAN } from '../../shared/villavicencio-urban.js';

describe('geographic 3D city', () => {
  it('extrudes actual footprints locally and releases replaced sector geometry', () => {
    expect(URBAN_BUILDINGS.length).toBeGreaterThan(7000);
    const scene = new Scene();
    createCityWorld(scene);
    const bodies = scene.getObjectByName('city-buildings') as Mesh;
    expect(bodies.geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(bodies.userData.buildingIds.length).toBeLessThanOrEqual(500);
    expect((scene.getObjectByName('city-windows') as InstancedMesh).count).toBeGreaterThan(0);
    expect((scene.getObjectByName('city-sidewalks') as InstancedMesh).count).toBeGreaterThan(0);
    const dispose = vi.spyOn(bodies.geometry, 'dispose');
    scene.userData.updateCityVegetation(new Vector3(100000, 0, 100000));
    expect(dispose).toHaveBeenCalledOnce();
    expect(bodies.userData.buildingIds).toEqual([]);
    expect((scene.getObjectByName('city-windows') as InstancedMesh).count).toBe(0);
  });
  it('builds raised bridge decks with rails and pillars and returns their walking height', () => {
    const segment = ROAD_SEGMENTS.find((s) => s.bridge && s.yA > 2 && s.yB > 2)!;
    const x = (segment.a[0] + segment.b[0]) / 2,
      z = (segment.a[1] + segment.b[1]) / 2;
    expect(citySurfaceHeight(x, z)).toBeGreaterThan(2);
    expect(citySurfaceHeight(100000, 100000)).toBe(0);
    const scene = new Scene();
    createCityWorld(scene);
    scene.userData.updateCityVegetation(new Vector3(x, 0, z));
    expect((scene.getObjectByName('city-bridge-rails') as InstancedMesh).count).toBeGreaterThan(0);
    expect((scene.getObjectByName('city-bridge-piers') as InstancedMesh).count).toBeGreaterThan(0);
  });
  it('places recorded traffic signals and animates their lights', () => {
    expect(VILLAVICENCIO_URBAN.signals).toHaveLength(77);
    const source = VILLAVICENCIO_URBAN.signals[0],
      p = geographicWorldPosition(source.lat, source.lng);
    const scene = new Scene();
    createCityWorld(scene);
    scene.userData.updateCityVegetation(new Vector3(p.x, 0, p.z));
    const signal = scene.getObjectByName(source.id)!;
    expect(signal).toBeDefined();
    const lights = signal.userData.lights as Mesh[];
    scene.userData.animateCityUrban(0);
    expect((lights[2].material as MeshLambertMaterial).color.getHex()).toBe(0x6cf3bb);
    scene.userData.animateCityUrban(10);
    expect((lights[0].material as MeshLambertMaterial).color.getHex()).toBe(0xff5b61);
  });
});
