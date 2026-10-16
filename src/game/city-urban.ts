import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
  Scene,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY_WORLD, geographicWorldPosition } from '../../shared/city-world.js';
import { VILLAVICENCIO_URBAN } from '../../shared/villavicencio-urban.js';
import { CITY_BUILDINGS, buildingHeight, buildingFloors } from '../../shared/city-life.js';

const project = (points: number[][]) =>
  points.map(([lng, lat]) => {
    const p = geographicWorldPosition(lat, lng);
    return [p.x, p.z];
  });
export const URBAN_BUILDINGS = CITY_BUILDINGS;
export interface RoadSegment {
  a: number[];
  b: number[];
  width: number;
  bridge: boolean;
  yA: number;
  yB: number;
  highway: string;
}
export const ROAD_SEGMENTS: RoadSegment[] = CITY_WORLD.roads.flatMap((r) => {
  let walked = 0;
  const length = r.points
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p[0] - r.points[i][0], p[1] - r.points[i][1]), 0);
  const height = Math.min(4, length * 0.1);
  const elevation = (distance: number) =>
    r.bridge ? Math.max(0, Math.min(height, distance / 5, (length - distance) / 5)) : 0;
  return r.points.slice(1).flatMap((b, i) => {
    const a = r.points[i],
      distance = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = r.bridge ? Math.max(1, Math.ceil(distance / 8)) : 1;
    const parts = Array.from({ length: count }, (_, n) => ({
      a: [a[0] + ((b[0] - a[0]) * n) / count, a[1] + ((b[1] - a[1]) * n) / count],
      b: [a[0] + ((b[0] - a[0]) * (n + 1)) / count, a[1] + ((b[1] - a[1]) * (n + 1)) / count],
      width: r.width,
      bridge: r.bridge,
      highway: r.highway,
      yA: elevation(walked + (distance * n) / count),
      yB: elevation(walked + (distance * (n + 1)) / count),
    }));
    walked += distance;
    return parts;
  });
});
const bridgeSegments = ROAD_SEGMENTS.filter((s) => s.bridge);
export function citySurfaceHeight(x: number, z: number): number {
  let height = 0;
  for (const s of bridgeSegments) {
    const dx = s.b[0] - s.a[0],
      dz = s.b[1] - s.a[1],
      square = dx * dx + dz * dz;
    if (!square) continue;
    const t = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / square));
    if (Math.hypot(x - s.a[0] - t * dx, z - s.a[1] - t * dz) < s.width / 2 + 0.3)
      height = Math.max(height, s.yA + (s.yB - s.yA) * t);
  }
  return height;
}
export function insideBuilding(x: number, z: number, b: (typeof URBAN_BUILDINGS)[number]): boolean {
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
  let inside = false;
  for (let i = 0, j = b.points.length - 1; i < b.points.length; j = i++) {
    const a = b.points[i],
      c = b.points[j];
    if (a[1] > z !== c[1] > z && x < ((c[0] - a[0]) * (z - a[1])) / (c[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}
const buildingCells = new Map<string, Set<number>>();
URBAN_BUILDINGS.forEach((b, i) => {
  for (let x = Math.floor(b.minX / 100); x <= Math.floor(b.maxX / 100); x++)
    for (let z = Math.floor(b.minZ / 100); z <= Math.floor(b.maxZ / 100); z++) {
      const key = x + ':' + z;
      if (!buildingCells.has(key)) buildingCells.set(key, new Set());
      buildingCells.get(key)!.add(i);
    }
});
export function buildingsNear(x: number, z: number, radius = 2) {
  const ids = new Set<number>();
  for (let dx = -radius; dx <= radius; dx++)
    for (let dz = -radius; dz <= radius; dz++)
      for (const i of buildingCells.get(
        Math.floor(x / 100) + dx + ':' + (Math.floor(z / 100) + dz)
      ) || [])
        ids.add(i);
  return [...ids].map((i) => URBAN_BUILDINGS[i]);
}
export function cityBuildingCollision(x: number, z: number, radius = 0.45): boolean {
  return buildingsNear(x, z, 1).some(
    (b) =>
      insideBuilding(x, z, b) ||
      insideBuilding(x - radius, z, b) ||
      insideBuilding(x + radius, z, b) ||
      insideBuilding(x, z - radius, b) ||
      insideBuilding(x, z + radius, b)
  );
}
function tintGeometry(geometry: BufferGeometry, hex: number) {
  const color = new Color(hex),
    colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}
export function mountCityUrban(scene: Scene) {
  const root = new Group();
  root.name = 'city-urban';
  scene.add(root);
  const bodies = new Mesh(new BufferGeometry(), new MeshLambertMaterial({ vertexColors: true }));
  bodies.name = 'city-buildings';
  const roofs = new Mesh(new BufferGeometry(), new MeshLambertMaterial({ vertexColors: true }));
  roofs.name = 'city-roofs';
  root.add(bodies, roofs);
  const instance = (name: string, color: number, capacity: number) => {
    const mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshLambertMaterial({ color }),
      capacity
    );
    mesh.name = name;
    mesh.count = 0;
    root.add(mesh);
    return mesh;
  };
  const windows = instance('city-windows', 0x8dbac1, 12000),
    doors = instance('city-doors', 0x24333b, 1000);
  const sidewalks = instance('city-sidewalks', 0x7f9293, 8192),
    markings = instance('city-road-markings', 0xe9e0ac, 8192);
  const crossings = instance('city-crosswalks', 0xe5eeee, 2048);
  const rails = instance('city-bridge-rails', 0x84a8b0, 4096),
    piers = instance('city-bridge-piers', 0x52636b, 2048);
  const lampPosts = instance('city-streetlights', 0x35434c, 2048),
    lampHeads = instance('city-lamp-heads', 0xb6e7e0, 2048);
  const water = instance('city-waterways', 0x245b78, 4096);
  const signalRoot = new Group();
  signalRoot.name = 'city-traffic-signals';
  root.add(signalRoot);
  const signals = VILLAVICENCIO_URBAN.signals.map((s) => ({
    ...s,
    ...geographicWorldPosition(s.lat, s.lng),
  }));
  const waterSegments = VILLAVICENCIO_URBAN.waterways.flatMap((r) => {
    const points = project(r.points);
    return points.slice(1).map((p, i) => ({ a: points[i], b: p, width: r.width }));
  });
  const matrix = new Matrix4(),
    rotation = new Quaternion(),
    counters = new Map<InstancedMesh, number>();
  const place = (
    mesh: InstancedMesh,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw = 0,
    slope = 0
  ) => {
    const i = counters.get(mesh) || 0;
    if (i >= mesh.instanceMatrix.count) return;
    rotation.setFromUnitVectors(
      new Vector3(0, 0, 1),
      new Vector3(Math.sin(yaw), slope, Math.cos(yaw)).normalize()
    );
    matrix.compose(new Vector3(x, y, z), rotation, new Vector3(sx, sy, sz));
    mesh.setMatrixAt(i, matrix);
    counters.set(mesh, i + 1);
  };
  let cell = '',
    activeBuildings: typeof URBAN_BUILDINGS = [],
    signalPhase = -1;
  let openBuildingId: string | null = null;
  let lastPosition: Vector3 | null = null;
  let lastRoads: RoadSegment[] = [];
  const replaceGeometry = (mesh: Mesh, parts: BufferGeometry[]) => {
    mesh.geometry.dispose();
    mesh.geometry = parts.length ? mergeGeometries(parts)! : new BufferGeometry();
    parts.forEach((g) => g.dispose());
    if (parts.length) mesh.geometry.computeBoundingSphere();
  };
  function update(position: Vector3, localRoads: RoadSegment[]) {
    lastPosition = position.clone();
    lastRoads = localRoads;
    const key = Math.floor(position.x / 50) + ':' + Math.floor(position.z / 50);
    if (key === cell) return;
    cell = key;
    counters.clear();
    activeBuildings = buildingsNear(position.x, position.z)
      .filter(
        (b) =>
          b.maxX > position.x - 180 &&
          b.minX < position.x + 180 &&
          b.maxZ > position.z - 180 &&
          b.minZ < position.z + 180
      )
      .slice(0, 500);
    const bodyParts: BufferGeometry[] = [],
      roofParts: BufferGeometry[] = [];
    for (const original of activeBuildings) {
      if (original.id === openBuildingId) continue;
      const b = { ...original, height: buildingHeight(original), levels: buildingFloors(original) };
      const points = b.points.slice(0, -1),
        shape = new Shape(points.map((p) => new Vector2(p[0], -p[1])));
      const hash = Number(b.id.split('-').at(-1)) || 0;
      const geometry = new ExtrudeGeometry(shape, {
        depth: b.height,
        bevelEnabled: false,
        steps: 1,
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, 0.18, 0);
      const pitched =
        ['house', 'residential', 'yes'].includes(b.kind) &&
        b.height <= 9 &&
        b.maxX - b.minX < 25 &&
        b.maxZ - b.minZ < 25;
      const pitchRoof = (g: BufferGeometry, walls = false) => {
        if (!pitched) return;
        const positions = g.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          if (walls && positions.getY(i) < b.height / 2) continue;
          const fraction = Math.abs(
            (positions.getX(i) - (b.minX + b.maxX) / 2) / Math.max(1, (b.maxX - b.minX) / 2)
          );
          positions.setY(i, positions.getY(i) + Math.max(0, 1 - fraction) * 1.5);
        }
        g.computeVertexNormals();
      };
      pitchRoof(geometry, true);
      bodyParts.push(
        tintGeometry(geometry, [0xaaa79a, 0x728592, 0xa58273, 0x7f9a8c, 0xc1b4a0][hash % 5])
      );
      const roof = new ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false, steps: 1 });
      roof.rotateX(-Math.PI / 2);
      roof.translate(0, b.height + 0.18, 0);
      pitchRoof(roof);
      roofParts.push(
        tintGeometry(roof, ['house', 'residential', 'yes'].includes(b.kind) ? 0x795b51 : 0x425866)
      );
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          c = points[(i + 1) % points.length],
          dx = c[0] - a[0],
          dz = c[1] - a[1],
          length = Math.hypot(dx, dz);
        if (length < 2) continue;
        const count = Math.min(12, Math.floor(length / 3)),
          yaw = Math.atan2(-dz, dx);
        for (let floor = 0; floor < Math.min(8, b.levels); floor++)
          for (let n = 0; n < count; n++) {
            const t = (n + 0.5) / count;
            place(
              windows,
              a[0] + dx * t,
              Math.min(b.height - 0.5, floor * 3 + 1.9),
              a[1] + dz * t,
              1.1,
              1.25,
              0.12,
              yaw
            );
          }
        if (i === 0) place(doors, (a[0] + c[0]) / 2, 1.15, (a[1] + c[1]) / 2, 1.3, 2, 0.15, yaw);
      }
    }
    replaceGeometry(bodies, bodyParts);
    replaceGeometry(roofs, roofParts);
    bodies.userData.buildingIds = activeBuildings.map((b) => b.id);
    for (const s of localRoads) {
      const dx = s.b[0] - s.a[0],
        dz = s.b[1] - s.a[1],
        length = Math.hypot(dx, dz);
      if (!length) continue;
      const yaw = Math.atan2(dx, dz),
        x = (s.a[0] + s.b[0]) / 2,
        z = (s.a[1] + s.b[1]) / 2,
        y = (s.yA + s.yB) / 2,
        slope = (s.yB - s.yA) / length;
      if (!['path', 'track', 'footway', 'cycleway', 'steps'].includes(s.highway)) {
        for (const side of [-1, 1]) {
          const offset = s.width / 2 + 0.9,
            sx = x + Math.cos(yaw) * offset * side,
            sz = z - Math.sin(yaw) * offset * side;
          place(
            sidewalks,
            sx,
            y + 0.16,
            sz,
            1.8,
            0.18,
            Math.hypot(length, s.yB - s.yA),
            yaw,
            slope
          );
          if (s.bridge) place(rails, sx, y + 1, sz, 0.16, 1.1, length, yaw, slope);
        }
        for (let d = 6; d < length; d += 16) {
          const t = d / length;
          place(
            markings,
            s.a[0] + dx * t,
            s.yA + (s.yB - s.yA) * t + 0.115,
            s.a[1] + dz * t,
            0.18,
            0.02,
            3,
            yaw,
            slope
          );
        }
      }
      if (s.bridge && y > 0.7) place(piers, x, y / 2, z, s.width * 0.65, y, 0.8, yaw);
      if (['primary', 'secondary', 'tertiary', 'residential'].includes(s.highway))
        for (let d = 12; d < length; d += 40) {
          const t = d / length,
            offset = s.width / 2 + 1.5,
            lx = s.a[0] + dx * t + Math.cos(yaw) * offset,
            lz = s.a[1] + dz * t - Math.sin(yaw) * offset,
            ly = s.yA + (s.yB - s.yA) * t;
          place(lampPosts, lx, ly + 2.6, lz, 0.14, 5.2, 0.14);
          place(lampHeads, lx, ly + 5.3, lz, 0.8, 0.18, 0.5, yaw);
        }
    }
    for (const s of waterSegments) {
      const x = (s.a[0] + s.b[0]) / 2,
        z = (s.a[1] + s.b[1]) / 2;
      if (Math.abs(x - position.x) > 350 || Math.abs(z - position.z) > 350) continue;
      place(
        water,
        x,
        0.015,
        z,
        s.width,
        0.01,
        Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]),
        Math.atan2(s.b[0] - s.a[0], s.b[1] - s.a[1])
      );
    }
    signalRoot.traverse((n) => {
      if (n instanceof Mesh) {
        n.geometry.dispose();
        (n.material as MeshLambertMaterial).dispose();
      }
    });
    signalRoot.clear();
    for (const s of signals.filter((s) => Math.hypot(s.x - position.x, s.z - position.z) < 200)) {
      const g = new Group();
      g.name = s.id;
      g.position.set(s.x + 1.2, citySurfaceHeight(s.x, s.z), s.z);
      const road = localRoads
        .filter((r) => !r.bridge && r.width >= 6)
        .sort(
          (a, b) =>
            Math.hypot((a.a[0] + a.b[0]) / 2 - s.x, (a.a[1] + a.b[1]) / 2 - s.z) -
            Math.hypot((b.a[0] + b.b[0]) / 2 - s.x, (b.a[1] + b.b[1]) / 2 - s.z)
        )[0];
      if (road) {
        const yaw = Math.atan2(road.b[0] - road.a[0], road.b[1] - road.a[1]);
        g.position.set(
          s.x + Math.cos(yaw) * (road.width / 2 + 1),
          0,
          s.z - Math.sin(yaw) * (road.width / 2 + 1)
        );
        g.rotation.y = yaw;
        for (let stripe = 0; stripe < 6; stripe++) {
          const d = -8 + stripe * 0.9;
          place(
            crossings,
            s.x + Math.sin(yaw) * d,
            0.12,
            s.z + Math.cos(yaw) * d,
            road.width,
            0.02,
            0.45,
            yaw
          );
        }
      }
      const pole = new Mesh(
        new BoxGeometry(0.15, 3.8, 0.15),
        new MeshLambertMaterial({ color: 0x465964 })
      );
      pole.position.y = 1.9;
      g.add(pole);
      const housing = new Mesh(
        new BoxGeometry(0.5, 1.4, 0.35),
        new MeshLambertMaterial({ color: 0x192832 })
      );
      housing.position.y = 3.3;
      g.add(housing);
      const lights = [0, 1, 2].map((n) => {
        const m = new Mesh(new SphereGeometry(0.13, 8, 6), new MeshLambertMaterial());
        m.position.set(0, 3.75 - n * 0.45, 0.21);
        g.add(m);
        return m;
      });
      g.userData.lights = lights;
      signalRoot.add(g);
    }
    signalPhase = -1;
    for (const mesh of [
      windows,
      doors,
      sidewalks,
      markings,
      crossings,
      rails,
      piers,
      lampPosts,
      lampHeads,
      water,
    ]) {
      mesh.count = counters.get(mesh) || 0;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }
  const animate = (seconds: number) => {
    const phase = Math.floor(seconds % 14);
    if (signalPhase === phase) return;
    signalPhase = phase;
    const active = phase < 6 ? 2 : phase < 8 ? 1 : 0;
    for (const g of signalRoot.children)
      (g.userData.lights as Mesh[]).forEach((m, i) => {
        const mat = m.material as MeshLambertMaterial,
          hex = i === active ? [0xff5b61, 0xffc867, 0x6cf3bb][i] : 0x28383d;
        mat.color.setHex(hex);
        mat.emissive.setHex(i === active ? hex : 0x000000);
        mat.emissiveIntensity = 0.5;
      });
  };
  scene.userData.citySurfaceHeight = citySurfaceHeight;
  scene.userData.setCityOpenBuilding = (id: string | null) => {
    openBuildingId = id;
    cell = '';
    if (lastPosition) update(lastPosition, lastRoads);
  };
  scene.userData.cityBuildingAt = (x: number, z: number) => cityBuildingCollision(x, z);
  scene.userData.animateCityUrban = animate;
  return {
    update,
    buildingAt: (x: number, z: number) => activeBuildings.some((b) => insideBuilding(x, z, b)),
  };
}
