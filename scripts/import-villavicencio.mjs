/** Import public OSM XML extracts; never retain contributor/user metadata. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const input = process.argv[2] || '.cartography-work';
const bounds = { south: 4.04, west: -73.7, north: 4.2, east: -73.48 };
const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const attrs = (s) =>
  Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
const tags = (s) =>
  Object.fromEntries(
    [...s.matchAll(/<tag\s+([^>]+)\/?\s*>/g)].map((m) => {
      const a = attrs(m[1]);
      return [a.k, a.v];
    })
  );
const nodes = new Map(),
  ways = new Map();
for (const file of readdirSync(input)
  .filter((f) => /^tile-\d+\.osm$/.test(f))
  .sort()) {
  const xml = readFileSync(join(input, file), 'utf8');
  for (const m of xml.matchAll(/<node\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
    const a = attrs(m[1]);
    nodes.set(a.id, { lat: +a.lat, lng: +a.lon, tags: tags(m[2] || '') });
  }
  for (const m of xml.matchAll(/<way\s+([^>]+)>([\s\S]*?)<\/way>/g)) {
    const a = attrs(m[1]);
    ways.set(a.id, {
      tags: tags(m[2]),
      refs: [...m[2].matchAll(/<nd\s+ref="(\d+)"/g)].map((n) => n[1]),
    });
  }
}
const inside = (p) =>
  p.lat >= bounds.south && p.lat <= bounds.north && p.lng >= bounds.west && p.lng <= bounds.east;
const geometry = (way) => way.refs.map((id) => nodes.get(id)).filter(Boolean);
const center = (points) => {
  const unique = points.length > 1 && points[0] === points.at(-1) ? points.slice(0, -1) : points;
  return {
    lat: unique.reduce((v, p) => v + p.lat, 0) / unique.length,
    lng: unique.reduce((v, p) => v + p.lng, 0) / unique.length,
  };
};
const roads = [];
const roadTypes = new Set([
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'pedestrian',
  'footway',
  'cycleway',
  'path',
  'track',
  'steps',
]);
for (const [id, way] of ways) {
  if (!roadTypes.has(way.tags.highway)) continue;
  // Only retain runs inside the downloaded area; do not invent connections over missing nodes.
  let run = [],
    part = 0;
  const flush = () => {
    if (run.length > 1)
      roads.push({
        id: 'osm-way-' + id + '-' + part++,
        name: way.tags.name || way.tags.ref || 'Vía sin nombre',
        highway: way.tags.highway,
        bridge: Boolean(way.tags.bridge && way.tags.bridge !== 'no'),
        layer: Number(way.tags.layer) || 0,
        points: run,
      });
    run = [];
  };
  for (const ref of way.refs) {
    const p = nodes.get(ref);
    if (!p || !inside(p)) flush();
    else run.push([p.lng, p.lat]);
  }
  flush();
}
const places = [];
const addPlace = (id, tags, p) => {
  if (
    !inside(p) ||
    !tags.name ||
    !/Viva|[ÚU]nico|Unicentro|Primavera|Llanocentro|Villacentro|Universidad|Universitaria|Libertadores/i.test(
      tags.name
    )
  )
    return;
  if (
    !['university', 'college'].includes(tags.amenity) &&
    tags.shop !== 'mall' &&
    !(/Libertadores/i.test(tags.name) && tags.leisure) &&
    !['osm-way-241990757', 'osm-way-105610688'].includes(id)
  )
    return;
  places.push({
    id,
    name: tags.name,
    lat: p.lat,
    lng: p.lng,
    type:
      tags.amenity === 'university' || tags.amenity === 'college' || id === 'osm-way-105610688'
        ? 'universidad'
        : /Libertadores/i.test(tags.name)
          ? 'parque'
          : 'comercial',
  });
};
for (const [id, n] of nodes) addPlace('osm-node-' + id, n.tags, n);
for (const [id, w] of ways) {
  const points = geometry(w);
  if (points.length) addPlace('osm-way-' + id, w.tags, center(points));
}
const park = places.find((p) => p.name === 'Plaza de Los Libertadores');
if (!park || roads.length < 1000)
  throw new Error('Extracto incompleto: faltan el parque central o la red vial.');
const data = {
  source: 'OpenStreetMap',
  attribution: '© OpenStreetMap contributors',
  license: 'ODbL-1.0',
  sourceUrl: 'https://www.openstreetmap.org/copyright',
  importedAt: new Date().toISOString(),
  bounds,
  origin: { lat: park.lat, lng: park.lng },
  roads,
  places,
};
const buildings = [];
const waterways = [];
for (const [id, way] of ways) {
  const points = geometry(way);
  if (points.length < 2 || !points.some(inside)) continue;
  if (
    way.tags.building &&
    way.tags.building !== 'no' &&
    points.length >= 4 &&
    way.refs[0] === way.refs.at(-1) &&
    points.every(inside)
  ) {
    const levels = Math.max(1, Math.min(30, Number(way.tags['building:levels']) || 2));
    const height = parseFloat(way.tags.height || '');
    buildings.push({
      id: 'osm-way-' + id,
      kind: way.tags.building,
      height: Number.isFinite(height) && height > 0 ? Math.min(100, height) : levels * 3,
      measuredHeight: Number.isFinite(height) && height > 0,
      levels,
      points: points.map((p) => [p.lng, p.lat]),
    });
  }
  if (['river', 'stream', 'canal'].includes(way.tags.waterway)) {
    let run = [],
      part = 0;
    const flush = () => {
      if (run.length > 1)
        waterways.push({
          id: 'osm-way-' + id + '-' + part++,
          width: way.tags.waterway === 'river' ? 18 : 5,
          points: run,
        });
      run = [];
    };
    for (const p of points) {
      if (inside(p)) run.push([p.lng, p.lat]);
      else flush();
    }
    flush();
  }
}
const signals = [...nodes]
  .filter(([, n]) => inside(n) && n.tags.highway === 'traffic_signals')
  .map(([id, n]) => ({ id: 'osm-node-' + id, lat: n.lat, lng: n.lng }));
writeFileSync(
  'shared/villavicencio-urban.js',
  '// OSM derived urban geometry, ODbL-1.0. See docs/CARTOGRAFIA-VILLAVICENCIO.md.\nexport const VILLAVICENCIO_URBAN = ' +
    JSON.stringify({ buildings, waterways, signals }) +
    ';\n'
);
writeFileSync(
  'shared/villavicencio-osm.js',
  '// Public geographic extract. See docs/CARTOGRAFIA-VILLAVICENCIO.md for attribution and refresh.\nexport const VILLAVICENCIO_OSM = ' +
    JSON.stringify(data) +
    ';\n'
);
console.log(
  JSON.stringify(
    {
      roads: roads.length,
      vertices: roads.reduce((n, r) => n + r.points.length, 0),
      buildings: buildings.length,
      signals: signals.length,
      bridges: roads.filter((r) => r.bridge).length,
      waterways: waterways.length,
      origin: data.origin,
      places,
    },
    null,
    2
  )
);
