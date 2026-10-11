import { QUEST_POSTS } from '../../shared/world-quests.js';
import {
  BoxGeometry,
  Float32BufferAttribute,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Fog,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Scene,
  Vector3,
  Quaternion,
} from 'three';
import {
  CITY_WORLD,
  CITY_ENCOUNTERS,
  biomeAt,
  businessWorldPosition,
} from '../../shared/city-world.js';
import { createWorld } from './world';
import type { ZoneWorld } from './zones';
import type { Store, StoreDetail } from './stores';
import { mountCityUrban, ROAD_SEGMENTS, URBAN_BUILDINGS } from './city-urban';
import { populateCityLife } from './city-life';
import { CITY_PARKS } from '../../shared/city-life.js';
export interface CityBuilding {
  store: Store;
  mesh: Group;
}
const material = (color: number) => new MeshLambertMaterial({ color });
function box(parent: Group, scale: Vector3, position: Vector3, color: number) {
  const m = new Mesh(new BoxGeometry(scale.x, scale.y, scale.z), material(color));
  m.position.copy(position);
  parent.add(m);
  return m;
}
export function createCityWorld(scene: Scene): ZoneWorld {
  const world = createWorld(scene, 'aldea');
  const actors = new Set([...world.npcs.map((n) => n.mesh), ...world.enemies.map((e) => e.mesh)]);
  for (const object of [...scene.children]) {
    if (!(object instanceof Group) || actors.has(object)) continue;
    object.traverse((n) => {
      if (n instanceof Mesh) {
        n.geometry.dispose();
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose();
      }
    });
    scene.remove(object);
  }
  const ground = scene.children.find(
    (n) => n instanceof Mesh && n.geometry instanceof PlaneGeometry
  ) as Mesh;
  if (ground) {
    ground.geometry.dispose();
    ground.geometry = new PlaneGeometry(CITY_WORLD.size, CITY_WORLD.size, 128, 128);
    ground.name = 'city-terrain';
    const positions = ground.geometry.getAttribute('position'),
      colors = new Float32Array(positions.count * 3);
    const tint = new Color(),
      secondary = new Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = -positions.getY(i);
      const nearest = [...CITY_WORLD.biomes].sort(
        (a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z)
      );
      const delta =
        Math.hypot(x - nearest[1].x, z - nearest[1].z) -
        Math.hypot(x - nearest[0].x, z - nearest[0].z);
      tint
        .setHex(nearest[0].color)
        .lerp(secondary.setHex(nearest[1].color), Math.max(0, 1 - delta / 120) * 0.5);
      tint.toArray(colors, i * 3);
    }
    ground.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const surface = ground.material as MeshLambertMaterial;
    surface.color.setHex(0xffffff);
    surface.vertexColors = true;
    surface.needsUpdate = true;
  }
  world.groundSize = CITY_WORLD.size;
  world.portals = [];
  scene.background = new Color(0x07151d);
  scene.fog = new Fog(0x102831, 28, 85);
  for (const b of CITY_WORLD.biomes) {
    const extraScene = new Scene(),
      extra = createWorld(extraScene, b.zone);
    for (const [i, enemy] of extra.enemies.slice(0, 2).entries()) {
      enemy.mesh.position.set(b.x + (i ? 8 : -8), 0, b.z + (i ? 6 : -6));
      enemy.spawnPosition.copy(enemy.mesh.position);
      enemy.name = b.name + ' · ' + enemy.name;
      world.enemies.push(enemy);
      scene.add(enemy.mesh);
    }
    extraScene.traverse((n) => {
      if (n instanceof Mesh) {
        n.geometry.dispose();
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose();
      }
    });
    extraScene.clear();
  }
  const templates = [...world.enemies];
  templates.forEach((e) => {
    e.hpBar.name = 'encounter-health-bar';
    scene.remove(e.mesh);
  });
  world.enemies = CITY_ENCOUNTERS.map((spec) => {
    const template = templates.find((e) => e.kind === spec.kind)!;
    const mesh = template.mesh.clone(true);
    mesh.position.set(spec.x, 0, spec.z);
    scene.add(mesh);
    return {
      ...template,
      mesh,
      hpBar: mesh.getObjectByName('encounter-health-bar') as Mesh,
      spawnPosition: mesh.position.clone(),
      name:
        (spec.park
          ? CITY_PARKS.find((p) => p.id === spec.park)?.name || 'Parque de combate'
          : biomeAt(spec.x, spec.z).name) +
        ' · ' +
        template.name,
    };
  });
  for (const post of QUEST_POSTS) {
    const mesh = new Group();
    mesh.name = 'quest-' + post.id;
    mesh.position.set(post.x, 0, post.z);
    box(mesh, new Vector3(0.3, 2.8, 0.3), new Vector3(0, 1.4, 0), 0x526c79);
    box(mesh, new Vector3(1.8, 1.2, 0.3), new Vector3(0, 2.2, 0), 0xe7cc87);
    scene.add(mesh);
  }
  const segments = ROAD_SEGMENTS;
  const urban = mountCityUrban(scene);
  // Index the real road network once; stream nearby segments instead of drawing the entire city.
  const roadCells = new Map<string, Set<number>>();
  segments.forEach(({ a, b }, i) => {
    for (
      let x = Math.floor(Math.min(a[0], b[0]) / 100);
      x <= Math.floor(Math.max(a[0], b[0]) / 100);
      x++
    )
      for (
        let z = Math.floor(Math.min(a[1], b[1]) / 100);
        z <= Math.floor(Math.max(a[1], b[1]) / 100);
        z++
      ) {
        const key = x + ':' + z;
        if (!roadCells.has(key)) roadCells.set(key, new Set());
        roadCells.get(key)!.add(i);
      }
  });
  const nearbyRoads = (x: number, z: number, radius: number) => {
    const ids = new Set<number>();
    for (let dx = -radius; dx <= radius; dx++)
      for (let dz = -radius; dz <= radius; dz++)
        for (const id of roadCells.get(
          Math.floor(x / 100) + dx + ':' + (Math.floor(z / 100) + dz)
        ) || [])
          ids.add(id);
    return [...ids].map((id) => segments[id]);
  };
  const segmentDistance = (x: number, z: number, a: number[], b: number[]) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared
      ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared))
      : 0;
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
  };
  const paths = new InstancedMesh(new BoxGeometry(1, 0.08, 1), material(0x293b43), 4096);
  paths.name = 'city-road-network';
  const matrix = new Matrix4();
  const roadRotation = new Quaternion();
  let previousRoadCell = '';
  const updateRoads = (position: Vector3) => {
    const key = Math.floor(position.x / 50) + ':' + Math.floor(position.z / 50);
    if (key === previousRoadCell) return;
    previousRoadCell = key;
    let count = 0;
    const localRoads = nearbyRoads(position.x, position.z, 3).filter(
      (s) => segmentDistance(position.x, position.z, s.a, s.b) <= 220
    );
    for (const { a, b, width, yA, yB } of localRoads) {
      if (count >= 4096 || segmentDistance(position.x, position.z, a, b) > 220) continue;
      const dx = b[0] - a[0],
        dz = b[1] - a[1];
      if (!dx && !dz) continue;
      roadRotation.setFromUnitVectors(
        new Vector3(0, 0, 1),
        new Vector3(dx, yB - yA, dz).normalize()
      );
      matrix.compose(
        new Vector3((a[0] + b[0]) / 2, 0.07 + (yA + yB) / 2, (a[1] + b[1]) / 2),
        roadRotation,
        new Vector3(width, 1, Math.hypot(dx, yB - yA, dz))
      );
      paths.setMatrixAt(count++, matrix);
    }
    paths.count = count;
    paths.instanceMatrix.needsUpdate = true;
    paths.computeBoundingSphere();
    urban.update(position, localRoads);
  };
  updateRoads(new Vector3());
  scene.add(paths);
  const distanceToRoad = (x: number, z: number) =>
    nearbyRoads(x, z, 1).reduce(
      (best, { a, b, width }) => Math.min(best, segmentDistance(x, z, a, b) - width / 2),
      Infinity
    );
  const vegetation = CITY_WORLD.biomes.map((b) => {
    const trunks = new InstancedMesh(
      new CylinderGeometry(0.17, 0.23, 2, 5),
      material(0x35504f),
      625
    );
    const leaves = new InstancedMesh(
      new ConeGeometry(b.id === 'selva' ? 1.6 : 1.15, 3.5, 7),
      material(b.id === 'nieve' ? 0xbedfe8 : b.id === 'fuego' ? 0x975055 : 0x3c8a70),
      625
    );
    trunks.name = 'city-trunks-' + b.id;
    leaves.name = 'city-leaves-' + b.id;
    trunks.count = leaves.count = 0;
    scene.add(trunks, leaves);
    return { b, trunks, leaves };
  });
  let previousCell = '';
  scene.userData.updateCityVegetation = (position: Vector3) => {
    updateRoads(position);
    const cellX = Math.floor(position.x / 12),
      cellZ = Math.floor(position.z / 12),
      key = cellX + ':' + cellZ;
    if (key === previousCell) return;
    previousCell = key;
    const counts = new Map(vegetation.map((v) => [v.b.id, 0]));
    for (let dx = -10; dx <= 10; dx++)
      for (let dz = -10; dz <= 10; dz++) {
        const cx = cellX + dx,
          cz = cellZ + dz;
        const hash = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) >>> 0;
        const x = cx * 12 + (hash % 100) / 20,
          z = cz * 12 + ((hash >>> 8) % 100) / 20;
        if (
          Math.hypot(x - position.x, z - position.z) > 100 ||
          Math.hypot(x, z) < 45 ||
          distanceToRoad(x, z) < 7 ||
          urban.buildingAt(x, z) ||
          Math.abs(x) > CITY_WORLD.size / 2 - 20 ||
          Math.abs(z) > CITY_WORLD.size / 2 - 20 ||
          CITY_WORLD.landmarks.some((l) => Math.hypot(x - l.x, z - l.z) < 18) ||
          CITY_WORLD.nodes.some((n) => Math.hypot(x - n.x, z - n.z) < 6)
        )
          continue;
        const owner = biomeAt(x, z),
          v = vegetation.find((v) => v.b.id === owner.id)!,
          i = counts.get(owner.id)!;
        matrix.makeTranslation(x, 1, z);
        v.trunks.setMatrixAt(i, matrix);
        matrix.makeTranslation(x, 3, z);
        v.leaves.setMatrixAt(i, matrix);
        counts.set(owner.id, i + 1);
      }
    for (const v of vegetation) {
      v.trunks.count = v.leaves.count = counts.get(v.b.id)!;
      v.trunks.instanceMatrix.needsUpdate = v.leaves.instanceMatrix.needsUpdate = true;
      v.trunks.computeBoundingSphere();
      v.leaves.computeBoundingSphere();
    }
  };
  scene.userData.updateCityVegetation(new Vector3());
  for (const node of CITY_WORLD.nodes) {
    const group = new Group();
    group.name = 'resource-' + node.id;
    group.position.set(node.x, 0, node.z);
    for (const side of [-1, 0, 1]) {
      const crystal = new Mesh(
        new ConeGeometry(node.pickup ? 0.4 : 0.55, node.pickup ? 0.7 : 2.2, 5),
        material(
          node.material === 'obsidiana'
            ? 0x9b5063
            : node.material === 'madera'
              ? 0x66a47c
              : 0x94d9df
        )
      );
      crystal.position.set(side * 0.65, 1, side * 0.2);
      crystal.rotation.z = side * 0.2;
      group.add(crystal);
    }
    scene.add(group);
  }
  const forge = new Group();
  forge.name = 'city-forge';
  forge.position.set(CITY_WORLD.forge.x, 0, CITY_WORLD.forge.z);
  box(forge, new Vector3(2, 0.8, 1.4), new Vector3(0, 0.4, 0), 0x526c79);
  box(forge, new Vector3(1, 0.3, 1), new Vector3(0, 0.95, 0), 0x83ddc4);
  scene.add(forge);
  const park = new Group();
  park.name = 'central-training-park';
  const parkLandmark = CITY_WORLD.landmarks.find((l) => l.type === 'parque')!;
  park.position.set(parkLandmark.x, 0, parkLandmark.z);
  const lawn = new Mesh(new CircleGeometry(40, 48), material(0x286c58));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.1;
  park.add(lawn);
  const field = new Mesh(new CircleGeometry(4, 32), material(0x527a80));
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0.12, -6);
  park.add(field);
  scene.add(park);
  for (const l of CITY_WORLD.landmarks) {
    if (l.type === 'parque') continue;
    const building = new Group();
    building.name = 'landmark-' + l.id;
    building.userData.label = l.name;
    building.position.set(l.x, 0, l.z);
    if (URBAN_BUILDINGS.some((b) => b.id === l.osmId)) {
      // The geographic footprint supplies the actual building; keep the interaction marker.
      building.userData.geographicBuilding = true;
      scene.add(building);
      continue;
    }
    box(
      building,
      new Vector3(l.type === 'comercial' ? 6 : 4, 3, 4),
      new Vector3(0, 1.5, 0),
      0x294550
    );
    box(
      building,
      new Vector3(6.5, 0.4, 4.5),
      new Vector3(0, 3.2, 0),
      l.type === 'universidad' ? 0x526c91 : 0x477e75
    );
    box(building, new Vector3(1.5, 2, 0.2), new Vector3(0, 1, 2.1), 0x83ddc4);
    scene.add(building);
  }
  world.enemies.forEach((e) => {
    if (Math.hypot(e.mesh.position.x, e.mesh.position.z) < 50) {
      e.mesh.position.x = e.mesh.position.x < 0 ? -55 : 55;
      e.spawnPosition.copy(e.mesh.position);
    }
  });
  populateCityLife(scene);
  return world;
}
export function addCityBusiness(scene: Scene, store: Store): CityBuilding | null {
  const position = businessWorldPosition(store);
  if (!position || !store.active) return null;
  const mesh = new Group();
  mesh.name = 'business-' + store.id;
  mesh.position.set(position.x, 0, position.z);
  box(mesh, new Vector3(4, 2.6, 0.3), new Vector3(0, 1.3, -1.8), 0x294550);
  for (const side of [-1, 1])
    box(mesh, new Vector3(0.3, 2.6, 3.6), new Vector3(side * 2, 1.3, 0), 0x294550);
  box(mesh, new Vector3(4.5, 0.35, 4.2), new Vector3(0, 2.9, 0), 0x477e75);
  box(mesh, new Vector3(2.5, 0.35, 0.15), new Vector3(0, 2.3, 1.9), 0x83ddc4);
  scene.add(mesh);
  return { store, mesh };
}
export function buildBusinessInterior(scene: Scene, store: StoreDetail): Group {
  const room = new Group();
  room.name = 'business-interior';
  room.position.set(1000, 0, 1000);
  box(room, new Vector3(14, 0.1, 14), new Vector3(0, -0.05, 0), 0x102831);
  box(room, new Vector3(14, 4, 0.3), new Vector3(0, 2, -7), 0x294550);
  for (const side of [-1, 1])
    box(room, new Vector3(0.3, 4, 14), new Vector3(side * 7, 2, 0), 0x294550);
  store.products.slice(0, 12).forEach((product, i) => {
    const x = ((i % 4) - 1.5) * 2.8,
      z = -4 + Math.floor(i / 4) * 2.5;
    const stand = new Group();
    stand.name = 'product-' + product.id;
    stand.position.set(x, 0, z);
    box(stand, new Vector3(1.4, 0.7, 1.1), new Vector3(0, 0.35, 0), 0x365660);
    box(stand, new Vector3(0.6, 0.65, 0.6), new Vector3(0, 1.05, 0), 0x83ddc4);
    room.add(stand);
  });
  scene.add(room);
  return room;
}
export { CITY_WORLD, biomeAt };
