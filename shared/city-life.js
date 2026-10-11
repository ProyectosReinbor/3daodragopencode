import { VILLAVICENCIO_URBAN } from './villavicencio-urban.js';
import { geographicWorldPosition } from './city-geography.js';
import { generateCityInfill } from './city-fill.js';
const projected = (points) =>
  points.map(([lng, lat]) => {
    const p = geographicWorldPosition(lat, lng);
    return [p.x, p.z];
  });
export const CITY_BUILDINGS = VILLAVICENCIO_URBAN.buildings.map((b) => {
  const points = projected(b.points),
    xs = points.map((p) => p[0]),
    zs = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs),
    x = (minX + maxX) / 2,
    z = (minZ + maxZ) / 2;
  const ex = (points[0][0] + points[1][0]) / 2,
    ez = (points[0][1] + points[1][1]) / 2,
    length = Math.hypot(ex - x, ez - z) || 1;
  return {
    ...b,
    points,
    minX,
    maxX,
    minZ,
    maxZ,
    x,
    z,
    entrance: { x: ex + ((ex - x) / length) * 1.5, z: ez + ((ez - z) / length) * 1.5 },
  };
});
CITY_BUILDINGS.push(...generateCityInfill(CITY_BUILDINGS));
const names = [
  'Botica Nébula',
  'Café Luciérnaga',
  'Galería AODASE',
  'Mirador Llanero',
  'Taller del Alba',
  'Centro de Guardianes',
];
const candidates = CITY_BUILDINGS.filter(
  (b) =>
    !b.generated &&
    b.maxX - b.minX >= 10 &&
    b.maxZ - b.minZ >= 10 &&
    b.maxX - b.minX < 55 &&
    b.maxZ - b.minZ < 55 &&
    Math.hypot(b.x, b.z) > 45
).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
export const CITY_VENUES = candidates.slice(0, 6).map((b, i) => ({
  id: 'venue-' + i,
  buildingId: b.id,
  name: names[i],
  kind: ['shop', 'cafe', 'gallery', 'tower', 'workshop', 'guild'][i],
  floors: [5, 4, 6, 8, 4, 5][i],
  ...b.entrance,
  npcName: [
    'Mara, boticaria',
    'Lía, exploradora',
    'Noa, coleccionista',
    'Sol, guardiana',
    'Ivo, artesano',
    'Kai, entrenador',
  ][i],
  quest: ['supplies', 'urban_supplies', 'collector', 'park_patrol', 'artisan', 'patrol'][i],
}));
export function buildingFloors(b) {
  const venue = CITY_VENUES.find((v) => v.buildingId === b.id);
  const variety = 3 + ((Number(b.id.split('-').at(-1)) || 0) % 4);
  return Math.min(25, Math.max(venue?.floors || variety, b.levels, Math.ceil(b.height / 4)));
}
export function buildingHeight(b) {
  return buildingFloors(b) * 4;
}
export const CITY_PARKS = (VILLAVICENCIO_URBAN.parks || [])
  .map((p) => {
    const points = projected(p.points),
      x = points.slice(0, -1).reduce((s, p) => s + p[0], 0) / (points.length - 1),
      z = points.slice(0, -1).reduce((s, p) => s + p[1], 0) / (points.length - 1);
    return { ...p, points, x, z };
  })
  .filter((p) => Math.hypot(p.x, p.z) > 100)
  .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
  .slice(0, 12);
export const CITY_CITIZENS = [
  { id: 'camp-guide', name: 'Ari, guía de la ciudad', x: -5, z: -5, quest: 'supplies' },
  { id: 'city-courier', name: 'Luna, mensajera', x: 15, z: -14, quest: 'urban_supplies' },
  { id: 'city-collector', name: 'Teo, coleccionista', x: -15, z: -14, quest: 'collector' },
  ...CITY_VENUES.map((v) => ({
    id: v.id,
    name: v.npcName,
    x: v.x + 3,
    z: v.z + 2,
    quest: v.quest,
  })),
  ...CITY_PARKS.slice(0, 6).map((p, i) => ({
    id: 'park-guard-' + i,
    name: 'Guardiana del parque',
    x: p.points[0][0] + 3,
    z: p.points[0][1] + 3,
    quest: 'park_patrol',
  })),
];
