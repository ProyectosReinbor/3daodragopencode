import { VILLAVICENCIO_OSM } from './villavicencio-osm.js';
import { geographicWorldPosition } from './city-geography.js';
import { CITY_PARKS } from './city-life.js';
export { geographicWorldPosition } from './city-geography.js';
const realRoads = VILLAVICENCIO_OSM.roads.map((r) => ({
  ...r,
  width: ['footway', 'path', 'cycleway', 'steps'].includes(r.highway)
    ? 2
    : ['primary', 'trunk', 'secondary'].includes(r.highway)
      ? 12
      : 6,
  points: r.points.map(([lng, lat]) => {
    const p = geographicWorldPosition(lat, lng);
    return [p.x, p.z];
  }),
}));
const landmarkIds = {
  'osm-way-181454390': 'viva',
  'osm-way-241990757': 'unico',
  'osm-way-68983015': 'unicentro',
  'osm-way-611726309': 'primavera',
  'osm-way-181455473': 'llanocentro',
  'osm-way-181455472': 'villacentro',
  'osm-way-108278125': 'unillanos',
  'osm-way-183027857': 'unillanos-san-antonio',
  'osm-node-4455378191': 'cooperativa',
  'osm-way-105610688': 'unimeta',
  'osm-way-771656259': 'santo-tomas',
  'osm-way-96020851': 'parque-central',
};
const realLandmarks = VILLAVICENCIO_OSM.places
  .filter((p) => landmarkIds[p.id])
  .map((p) => ({
    ...p,
    osmId: p.id,
    id: landmarkIds[p.id],
    ...geographicWorldPosition(p.lat, p.lng),
  }));
const adventureRoads = realRoads.filter((r) =>
  ['primary', 'secondary', 'tertiary', 'trunk'].includes(r.highway)
);
const layout = {
  name: 'Villavicencio',
  size: 40000,
  origin: VILLAVICENCIO_OSM.origin,
  cartography: 'openstreetmap',
  attribution: VILLAVICENCIO_OSM.attribution,
  sourceUrl: VILLAVICENCIO_OSM.sourceUrl,
  importedAt: VILLAVICENCIO_OSM.importedAt,
  geographicBounds: VILLAVICENCIO_OSM.bounds,
  biomes: [
    {
      id: 'bosque',
      name: 'Bosque Esmeralda',
      x: -32,
      z: 1,
      radius: 37,
      color: 1923403,
      zone: 'bosque',
    },
    {
      id: 'selva',
      name: 'Selva de Catama',
      x: 36,
      z: -30,
      radius: 36,
      color: 1528904,
      zone: 'bosque',
    },
    {
      id: 'fuego',
      name: 'Tierras de Brasa',
      x: 43,
      z: 36,
      radius: 33,
      color: 6502200,
      zone: 'desierto',
    },
    {
      id: 'nieve',
      name: 'Cumbres de Nacar',
      x: -40,
      z: -45,
      radius: 30,
      color: 6657709,
      zone: 'ruinas',
    },
    {
      id: 'cueva',
      name: 'Cuevas del Anillo',
      x: -9,
      z: 53,
      radius: 26,
      color: 3683412,
      zone: 'cueva',
    },
  ],
  nodes: [
    { id: 'mina-anillo', name: 'Mina del Anillo', x: -8, z: 40, material: 'mineral', amount: 2 },
    {
      id: 'cristal-nacar',
      name: 'Cristales de Nacar',
      x: -34,
      z: -40,
      material: 'cristal',
      amount: 1,
    },
    {
      id: 'bosque-madera',
      name: 'Arboleda Esmeralda',
      x: -30,
      z: 12,
      material: 'madera',
      amount: 2,
    },
    {
      id: 'selva-esencia',
      name: 'Santuario de Catama',
      x: 34,
      z: -23,
      material: 'esencia',
      amount: 1,
    },
    {
      id: 'brasa-obsidiana',
      name: 'Mina de Obsidiana',
      x: 42,
      z: 30,
      material: 'obsidiana',
      amount: 1,
    },
  ],
  forge: { x: 0, z: 4 },
  spawn: { x: 0, z: 0 },
};
const scale = 40;
export const CITY_WORLD = Object.freeze({
  ...layout,
  landmarks: realLandmarks,
  roads: realRoads,
  biomes: layout.biomes.map((b) => ({
    ...b,
    x: b.x * scale,
    z: b.z * scale,
    radius: b.radius * scale,
  })),
  nodes: [
    {
      id: 'starter-wood',
      name: 'Madera del sendero',
      x: 28,
      z: 12,
      material: 'madera',
      amount: 2,
      pickup: true,
    },
    {
      id: 'starter-ore',
      name: 'Veta del campamento',
      x: 42,
      z: -18,
      material: 'mineral',
      amount: 2,
    },
    {
      id: 'starter-crystal',
      name: 'Fragmento perdido',
      x: -32,
      z: 24,
      material: 'cristal',
      amount: 1,
      pickup: true,
    },
    {
      id: 'starter-essence',
      name: 'Esencia del claro',
      x: -45,
      z: -22,
      material: 'esencia',
      amount: 1,
      pickup: true,
    },
    ...layout.nodes.map((p) => ({ ...p, x: p.x * scale, z: p.z * scale })),
    ...adventureRoads
      .filter((_, i) => i % Math.max(1, Math.ceil(adventureRoads.length / 60)) === 0)
      .flatMap((r, roadIndex) =>
        r.points.slice(0, 1).map((p, i) => ({
          id: 'cache-' + r.id + '-' + i,
          name: 'Hallazgo del camino',
          x: p[0] + 12,
          z: p[1] - 12,
          material: ['madera', 'mineral', 'esencia', 'cristal', 'obsidiana'][roadIndex % 5],
          amount: 1,
          pickup: true,
        }))
      ),
  ],
});
export function biomeAt(x, z) {
  return CITY_WORLD.biomes.reduce(
    (best, b) => (Math.hypot(x - b.x, z - b.z) < Math.hypot(x - best.x, z - best.z) ? b : best),
    CITY_WORLD.biomes[0]
  );
}
export function businessWorldPosition(store) {
  if (store.city_id && store.city_id !== 'CO-MET-VVC') return null;
  if (!Number.isFinite(store.lat) || !Number.isFinite(store.lng)) return null;
  const { x, z } = geographicWorldPosition(store.lat, store.lng);
  const b = CITY_WORLD.geographicBounds;
  if (store.lat < b.south || store.lat > b.north || store.lng < b.west || store.lng > b.east)
    return null;
  if (Math.abs(x) > CITY_WORLD.size / 2 - 20 || Math.abs(z) > CITY_WORLD.size / 2 - 20) return null;
  return { x, z };
}

export const CITY_ENCOUNTERS = [
  // Keep the original encounter indices stable; park encounters are appended below.
  ...[70, 120, 185, 250].map((x, i) => ({
    id: 'path-' + i,
    x,
    z: (i % 2 ? 1 : -1) * 25,
    kind: i % 2 ? 'skeleton' : 'wolf',
  })),
  ...CITY_WORLD.biomes.flatMap((b) =>
    Array.from({ length: 6 }, (_, i) => ({
      id: b.id + '-' + i,
      x: b.x + ((i % 3) - 1) * 70,
      z: b.z + (i < 3 ? -55 : 55),
      kind:
        b.id === 'fuego'
          ? 'golem'
          : b.id === 'cueva'
            ? 'spirit'
            : b.id === 'nieve'
              ? 'skeleton'
              : 'wolf',
    }))
  ),
  ...adventureRoads.flatMap((r) =>
    r.points.slice(1).flatMap((p, i) => {
      const a = r.points[i],
        length = Math.hypot(p[0] - a[0], p[1] - a[1]),
        count = Math.floor(length / 350);
      return Array.from({ length: count }, (_, j) => ({
        id: r.id + '-' + i + '-' + j,
        x: a[0] + ((p[0] - a[0]) * (j + 1)) / (count + 1) + 18,
        z: a[1] + ((p[1] - a[1]) * (j + 1)) / (count + 1) + 18,
        kind: j % 3 === 0 ? 'spirit' : 'wolf',
      }));
    })
  ),
];
CITY_ENCOUNTERS.push(
  ...CITY_PARKS.flatMap((p) =>
    Array.from({ length: 4 }, (_, i) => ({
      id: p.id + '-monster-' + i,
      x: p.x + Math.cos((i * Math.PI) / 2) * 12,
      z: p.z + Math.sin((i * Math.PI) / 2) * 12,
      kind: i === 3 ? 'spirit' : 'wolf',
      park: p.id,
    }))
  )
);
