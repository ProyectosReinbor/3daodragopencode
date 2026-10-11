import { VILLAVICENCIO_OSM } from './villavicencio-osm.js';
import { VILLAVICENCIO_URBAN } from './villavicencio-urban.js';
import { geographicWorldPosition } from './city-geography.js';
/** Artistic infill on unmapped lots; never presented as surveyed buildings. */
export function generateCityInfill(buildings) {
  const occupied = new Map(),
    roads = new Map();
  const register = (index, item) => {
    for (let x = Math.floor(item.minX / 100); x <= Math.floor(item.maxX / 100); x++)
      for (let z = Math.floor(item.minZ / 100); z <= Math.floor(item.maxZ / 100); z++) {
        const key = x + ':' + z;
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(item);
      }
  };
  buildings.forEach((b) => register(occupied, b));
  for (const p of VILLAVICENCIO_URBAN.parks || []) {
    const points = p.points.map(([lng, lat]) => geographicWorldPosition(lat, lng));
    register(occupied, {
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)),
      minZ: Math.min(...points.map((p) => p.z)),
      maxZ: Math.max(...points.map((p) => p.z)),
    });
  }
  const segments = VILLAVICENCIO_OSM.roads.flatMap((r) => {
    const points = r.points.map(([lng, lat]) => geographicWorldPosition(lat, lng)),
      width = ['primary', 'secondary', 'trunk'].includes(r.highway) ? 12 : 6;
    return points
      .slice(1)
      .map((b, i) => ({
        a: points[i],
        b,
        id: r.id + '-' + i,
        highway: r.highway,
        bridge: r.bridge,
        width,
        minX: Math.min(points[i].x, b.x) - width,
        maxX: Math.max(points[i].x, b.x) + width,
        minZ: Math.min(points[i].z, b.z) - width,
        maxZ: Math.max(points[i].z, b.z) + width,
      }));
  });
  segments.forEach((s) => register(roads, s));
  const nearby = (index, x, z) => {
    const items = new Set();
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (const item of index.get(Math.floor(x / 100) + dx + ':' + (Math.floor(z / 100) + dz)) ||
          [])
          items.add(item);
    return [...items];
  };
  const generated = [];
  for (const s of segments
    .filter(
      (s) =>
        !s.bridge &&
        ['residential', 'unclassified', 'tertiary', 'secondary', 'primary'].includes(s.highway)
    )
    .sort((a, b) => Math.hypot(a.a.x, a.a.z) - Math.hypot(b.a.x, b.a.z))) {
    if (generated.length >= 2500) break;
    const dx = s.b.x - s.a.x,
      dz = s.b.z - s.a.z,
      length = Math.hypot(dx, dz);
    if (length < 18) continue;
    for (let d = length < 32 ? length / 2 : 16; d < length && generated.length < 2500; d += 32)
      for (const side of [-1, 1]) {
        const x = s.a.x + (dx * d) / length + (dz / length) * (s.width / 2 + 12) * side,
          z = s.a.z + (dz * d) / length - (dx / length) * (s.width / 2 + 12) * side;
        if (Math.hypot(x, z) < 55 || Math.hypot(x, z) > 5000) continue;
        const box = { minX: x - 4.5, maxX: x + 4.5, minZ: z - 4.5, maxZ: z + 4.5 };
        if (
          nearby(occupied, x, z).some(
            (b) =>
              box.minX < b.maxX + 2 &&
              box.maxX > b.minX - 2 &&
              box.minZ < b.maxZ + 2 &&
              box.maxZ > b.minZ - 2
          )
        )
          continue;
        if (
          nearby(roads, x, z).some((r) => {
            const vx = r.b.x - r.a.x,
              vz = r.b.z - r.a.z,
              square = vx * vx + vz * vz,
              t = square
                ? Math.max(0, Math.min(1, ((x - r.a.x) * vx + (z - r.a.z) * vz) / square))
                : 0;
            return Math.hypot(x - r.a.x - vx * t, z - r.a.z - vz * t) < r.width / 2 + 7;
          })
        )
          continue;
        const levels = 3 + (generated.length % 4),
          b = {
            ...box,
            x,
            z,
            id: 'generated-' + s.id + '-' + side + '-' + Math.round(d),
            kind: 'apartments',
            generated: true,
            height: levels * 4,
            measuredHeight: false,
            levels,
            points: [
              [x - 4.5, z - 4.5],
              [x + 4.5, z - 4.5],
              [x + 4.5, z + 4.5],
              [x - 4.5, z + 4.5],
              [x - 4.5, z - 4.5],
            ],
            entrance: { x, z: z - 6 },
          };
        generated.push(b);
        register(occupied, b);
        if (generated.length >= 2500) break;
      }
  }
  return generated;
}
