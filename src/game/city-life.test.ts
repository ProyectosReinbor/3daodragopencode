import { describe, expect, it, vi } from 'vitest';
import { Scene, Vector3, Mesh } from 'three';
import { createCityWorld } from './city-world';
import {
  CITY_BUILDINGS,
  CITY_VENUES,
  CITY_PARKS,
  CITY_CITIZENS,
  buildingHeight,
} from '../../shared/city-life.js';
import { CITY_ENCOUNTERS } from '../../shared/city-world.js';
import { openCityRoom, closeCityRoom, nearbyCityEntrance } from './city-life';

describe('inhabited city and accessible buildings', () => {
  it('opens multiple floors in place and restores the exterior on exit', () => {
    const venue = CITY_VENUES[0],
      building = CITY_BUILDINGS.find((b) => b.id === venue.buildingId)!;
    const scene = new Scene();
    createCityWorld(scene);
    expect(nearbyCityEntrance(new Vector3(venue.x, 0, venue.z))?.id).toBe(building.id);
    const room = openCityRoom(scene, building, 2);
    expect(room.height).toBe(8.25);
    expect(room.group.position.x).toBe(building.x);
    expect(scene.getObjectByName('city-accessible-interior')).toBe(room.group);
    expect(buildingHeight(building)).toBeGreaterThanOrEqual(20);
    const geometry = (room.group.children[0] as Mesh).geometry;
    const dispose = vi.spyOn(geometry, 'dispose');
    closeCityRoom(scene, room);
    expect(dispose).toHaveBeenCalledOnce();
    const terrace = openCityRoom(scene, building, venue.floors);
    expect(terrace.terrace).toBe(true);
    expect(terrace.height).toBe(venue.floors * 4 + 0.25);
    closeCityRoom(scene, terrace);
    expect(scene.getObjectByName('city-accessible-interior')).toBeUndefined();
  });
  it('populates businesses, quest NPCs and parks with canonical monsters', () => {
    const infill = CITY_BUILDINGS.filter((b) => b.generated);
    expect(infill.length).toBeGreaterThan(1000);
    expect(infill.length).toBeLessThanOrEqual(2500);
    expect(new Set(CITY_BUILDINGS.map((b) => b.id)).size).toBe(CITY_BUILDINGS.length);
    expect(CITY_VENUES).toHaveLength(6);
    expect(CITY_PARKS).toHaveLength(12);
    const scene = new Scene();
    const world = createCityWorld(scene);
    for (const venue of CITY_VENUES)
      expect(scene.getObjectByName('venue-entry-' + venue.id)).toBeDefined();
    expect(CITY_CITIZENS.length).toBeGreaterThan(12);
    expect(scene.getObjectByName('citizen-camp-guide')).toBeDefined();
    for (const park of CITY_PARKS) {
      expect(scene.getObjectByName('combat-park-' + park.id)).toBeDefined();
      expect(CITY_ENCOUNTERS.filter((e) => e.park === park.id)).toHaveLength(4);
    }
    expect(world.enemies).toHaveLength(CITY_ENCOUNTERS.length);
  });
});
