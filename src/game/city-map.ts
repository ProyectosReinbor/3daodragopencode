import { CITY_WORLD } from '../../shared/city-world.js';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
const indexed = CITY_WORLD.roads.map((r) => ({
  r,
  minX: Math.min(...r.points.map((p) => p[0])),
  maxX: Math.max(...r.points.map((p) => p[0])),
  minZ: Math.min(...r.points.map((p) => p[1])),
  maxZ: Math.max(...r.points.map((p) => p[1])),
}));
export function cityRoadMarkup(x: number, z: number, span: number, labels = false): string {
  const half = span / 2;
  return indexed
    .filter(
      (p) => p.maxX >= x - half && p.minX <= x + half && p.maxZ >= z - half && p.minZ <= z + half
    )
    .map(({ r }) => {
      const p = r.points[Math.floor(r.points.length / 2)];
      const major = ['primary', 'secondary', 'trunk'].includes(r.highway);
      return (
        `<polyline points="${r.points.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${major ? '#d5e9d2' : '#799b9e'}" stroke-width="${Math.max(r.width, span / 1500)}"><title>${escape(r.name)}</title></polyline>` +
        (labels && span <= 4000 && major && r.name !== 'Vía sin nombre'
          ? `<text x="${p[0]}" y="${p[1]}" font-size="${span / 70}" fill="#fff" stroke="#07151d" stroke-width="${span / 400}" paint-order="stroke">${escape(r.name)}</text>`
          : '')
      );
    })
    .join('');
}
