import {
  BoxGeometry,
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
} from 'three';
import { CITY_WORLD, biomeAt, businessWorldPosition } from '../../shared/city-world.js';
import { createWorld } from './world';
import type { ZoneWorld } from './zones';
import type { Store, StoreDetail } from './stores';
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
  const ground = scene.children.find(
    (n) => n instanceof Mesh && n.geometry instanceof PlaneGeometry
  ) as Mesh;
  if (ground) {
    ground.geometry.dispose();
    ground.geometry = new PlaneGeometry(CITY_WORLD.size, CITY_WORLD.size);
    (ground.material as MeshLambertMaterial).color.setHex(0x163d3c);
  }
  world.groundSize = CITY_WORLD.size;
  world.portals = [];
  scene.background = new Color(0x07151d);
  scene.fog = new Fog(0x102831, 28, 85);
  const terrains = new Group();
  terrains.name = 'city-biomes';
  scene.add(terrains);
  for (const b of CITY_WORLD.biomes) {
    const patch = new Mesh(new CircleGeometry(b.radius, 40), material(b.color));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(b.x, 0.025, b.z);
    terrains.add(patch);
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
  const segments = CITY_WORLD.roads.flatMap((r) =>
    r.points.slice(1).map((p, i) => ({ a: r.points[i], b: p }))
  );
  const paths = new InstancedMesh(
    new BoxGeometry(2.6, 0.06, 1),
    material(0x618580),
    segments.length
  );
  paths.name = 'city-road-network';
  const matrix = new Matrix4();
  segments.forEach(({ a, b }, i) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    matrix.makeRotationY(Math.atan2(dx, dz));
    matrix.scale(new Vector3(1, 1, Math.hypot(dx, dz)));
    matrix.setPosition((a[0] + b[0]) / 2, 0.07, (a[1] + b[1]) / 2);
    paths.setMatrixAt(i, matrix);
  });
  scene.add(paths);
  const distanceToRoad = (x: number, z: number) =>
    segments.reduce((best, { a, b }) => {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      return Math.min(best, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
    }, Infinity);
  let seed = 8147;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (const b of CITY_WORLD.biomes) {
    const positions: Vector3[] = [];
    for (let i = 0; i < 64; i++) {
      const x = b.x + (random() - 0.5) * b.radius * 1.6,
        z = b.z + (random() - 0.5) * b.radius * 1.6;
      if (
        Math.abs(x) > 83 ||
        Math.abs(z) > 83 ||
        Math.hypot(x, z) < 12 ||
        distanceToRoad(x, z) < 4 ||
        CITY_WORLD.nodes.some((n) => Math.hypot(x - n.x, z - n.z) < 5)
      )
        continue;
      positions.push(new Vector3(x, 0, z));
    }
    const trunks = new InstancedMesh(
        new CylinderGeometry(0.17, 0.23, 2, 5),
        material(0x35504f),
        positions.length
      ),
      leaves = new InstancedMesh(
        new ConeGeometry(b.id === 'selva' ? 1.6 : 1.15, 3.5, 7),
        material(b.id === 'nieve' ? 0xbedfe8 : b.id === 'fuego' ? 0x975055 : 0x3c8a70),
        positions.length
      );
    positions.forEach((p, i) => {
      matrix.makeTranslation(p.x, 1, p.z);
      trunks.setMatrixAt(i, matrix);
      matrix.makeTranslation(p.x, 3, p.z);
      leaves.setMatrixAt(i, matrix);
    });
    scene.add(trunks, leaves);
  }
  for (const node of CITY_WORLD.nodes) {
    const group = new Group();
    group.name = 'resource-' + node.id;
    group.position.set(node.x, 0, node.z);
    for (const side of [-1, 0, 1]) {
      const crystal = new Mesh(
        new ConeGeometry(0.55, 2.2, 5),
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
  const lawn = new Mesh(new CircleGeometry(12, 48), material(0x286c58));
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
    if (Math.hypot(e.mesh.position.x, e.mesh.position.z) < 15) {
      e.mesh.position.x = e.mesh.position.x < 0 ? -20 : 20;
      e.spawnPosition.copy(e.mesh.position);
    }
  });
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
