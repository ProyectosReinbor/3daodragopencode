import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import {
  CITY_BUILDINGS,
  CITY_CITIZENS,
  CITY_PARKS,
  CITY_VENUES,
  buildingFloors,
  type UrbanBuilding,
} from '../../shared/city-life.js';
import { buildingsNear } from './city-urban';
const block = (
  g: Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: number
) => {
  const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
};
export function disposeCityRoom(room: Group) {
  room.traverse((n) => {
    if (n instanceof Mesh) {
      n.geometry.dispose();
      for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose();
    }
  });
  room.removeFromParent();
}
export interface CityRoom {
  building: UrbanBuilding;
  group: Group;
  floor: number;
  terrace: boolean;
  floors: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  name: string;
  venue: (typeof CITY_VENUES)[number] | undefined;
}
export function openCityRoom(scene: Scene, building: UrbanBuilding, floor = 0): CityRoom {
  const floors = buildingFloors(building),
    level = Math.max(0, Math.min(floors, Math.trunc(floor))),
    terrace = level === floors;
  const room = new Group();
  room.name = 'city-accessible-interior';
  const height = level * 4 + 0.25;
  const width = Math.max(6, Math.min(28, building.maxX - building.minX - 1)),
    depth = Math.max(6, Math.min(28, building.maxZ - building.minZ - 1));
  room.position.set(building.x, height, building.z);
  block(room, 0, -0.12, 0, width, 0.24, depth, terrace ? 0x395d59 : 0x203640);
  for (const side of [-1, 1]) {
    block(room, (side * width) / 2, 0.55, 0, 0.2, 1.1, depth, 0x52777b);
    block(room, 0, 0.55, (side * depth) / 2, width, 1.1, 0.2, 0x52777b);
    if (!terrace) {
      for (let x = -width / 2; x <= width / 2; x += 3)
        block(room, x, 2, (side * depth) / 2, 0.12, 4, 0.12, 0x789d9e);
      for (let z = -depth / 2; z <= depth / 2; z += 3)
        block(room, (side * width) / 2, 2, z, 0.12, 4, 0.12, 0x789d9e);
      const glass = new Mesh(
        new BoxGeometry(width, 2.6, 0.04),
        new MeshLambertMaterial({
          color: 0x83dcca,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        })
      );
      glass.position.set(0, 2.4, (side * depth) / 2);
      room.add(glass);
    }
  }
  block(room, -width / 2 + 1.2, 1.5, -depth / 2 + 1.2, 1.8, 3, 1.8, 0x426373);
  block(room, -width / 2 + 1.2, 1.6, -depth / 2 + 2.15, 0.5, 0.8, 0.08, 0x83ddc4);
  const venue = CITY_VENUES.find((v) => v.buildingId === building.id);
  if (terrace) {
    for (const side of [-1, 1]) {
      block(room, side * (width / 2 - 2), 0.4, 0, 1.5, 0.8, 1.5, 0x496765);
      const plant = new Mesh(
        new SphereGeometry(0.9, 8, 6),
        new MeshLambertMaterial({ color: 0x428d6c })
      );
      plant.position.set(side * (width / 2 - 2), 1.25, 0);
      room.add(plant);
    }
    block(room, 0, 0.45, -depth / 2 + 3, 3, 0.9, 1, 0x6e8c88);
  } else {
    block(room, width / 2 - 2, 0.8, -depth / 2 + 3, 2.2, 1.6, 3, 0x5c787d);
    block(room, width / 2 - 2, 2.1, -depth / 2 + 3, 1.6, 0.9, 1.4, 0xa5d5b9);
    block(room, 0, 0.75, -depth / 2 + 3, 3.2, 1.5, 1.2, 0x497974);
    for (const x of [-2, 2]) {
      block(room, x, 0.65, 1, 1.4, 0.15, 1.4, 0x8a7e6b);
      block(room, x, 0.3, 1, 0.2, 0.6, 0.2, 0x445660);
    }
    const vendor = createCitizen(0x7ac7b3);
    vendor.position.set(0, 0, -depth / 2 + 1.8);
    room.add(vendor);
  }
  scene.add(room);
  scene.userData.setCityOpenBuilding?.(building.id);
  return {
    building,
    group: room,
    floor: level,
    terrace,
    floors,
    x: building.x,
    z: building.z,
    width,
    depth,
    height,
    name: venue?.name || 'Edificio urbano',
    venue,
  };
}
export function closeCityRoom(scene: Scene, room: CityRoom) {
  disposeCityRoom(room.group);
  scene.userData.setCityOpenBuilding?.(null);
}
export function nearbyCityEntrance(position: Vector3) {
  return buildingsNear(position.x, position.z, 1)
    .filter((b) => b.maxX - b.minX >= 7 && b.maxZ - b.minZ >= 7)
    .map((b) => ({ b, d: Math.hypot(b.entrance.x - position.x, b.entrance.z - position.z) }))
    .filter((p) => p.d < 4)
    .sort((a, b) => a.d - b.d)[0]?.b;
}
function createCitizen(color: number): Group {
  const g = new Group();
  block(g, 0, 0.9, 0, 0.6, 0.85, 0.4, color);
  const head = new Mesh(
    new SphereGeometry(0.3, 10, 8),
    new MeshLambertMaterial({ color: 0xd9c39d })
  );
  head.position.y = 1.65;
  g.add(head);
  for (const side of [-1, 1]) {
    block(g, side * 0.17, 0.35, 0, 0.2, 0.7, 0.22, 0x344b64);
    const arm = block(g, side * 0.4, 1, 0, 0.17, 0.7, 0.2, color);
    arm.name = 'citizen-arm';
  }
  return g;
}
export function populateCityLife(scene: Scene) {
  const root = new Group();
  root.name = 'city-life';
  scene.add(root);
  for (const x of [-15, 15]) {
    const stall = new Group();
    stall.position.set(x, 0, -16);
    block(stall, 0, 0.7, 0, 3.2, 1.4, 1.5, 0x53676c);
    block(stall, 0, 2.5, 0, 3.6, 0.2, 2.4, x < 0 ? 0x719588 : 0x99816c);
    for (const side of [-1, 1]) block(stall, side * 1.4, 1.8, 0, 0.12, 1.5, 0.12, 0x415863);
    root.add(stall);
  }
  for (const side of [-1, 1])
    for (const z of [12, 22]) {
      block(root, side * 16, 0.5, z, 3, 0.18, 1, 0x8c8873);
      block(root, side * 16, 0.25, z, 0.3, 0.5, 0.8, 0x425a61);
    }
  for (const npc of CITY_CITIZENS) {
    const g = createCitizen(npc.quest === 'park_patrol' ? 0x72b590 : 0x8d9fcb);
    g.name = 'citizen-' + npc.id;
    g.position.set(npc.x, 0, npc.z);
    g.userData.npc = npc;
    const marker = new Mesh(
      new CylinderGeometry(0.15, 0.15, 0.5, 6),
      new MeshLambertMaterial({ color: 0xffdc83, emissive: 0x725c19 })
    );
    marker.position.y = 2.35;
    g.add(marker);
    root.add(g);
  }
  for (const venue of CITY_VENUES) {
    const gate = new Group();
    gate.name = 'venue-entry-' + venue.id;
    gate.position.set(venue.x, 0, venue.z);
    block(gate, 0, 1.8, 0, 2.4, 3.6, 0.18, 0x38576b);
    block(gate, 0, 1.8, 0.12, 1.8, 3.1, 0.12, 0x83ddc4);
    block(gate, 0, 3.8, 0, 3.2, 0.6, 0.4, 0x527b86);
    root.add(gate);
  }
  for (const p of CITY_PARKS) {
    const park = new Group();
    park.name = 'combat-park-' + p.id;
    const ground = new Mesh(
      new ShapeGeometry(new Shape(p.points.slice(0, -1).map((v) => new Vector2(v[0], -v[1])))),
      new MeshLambertMaterial({ color: 0x2c6a52 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.035;
    park.add(ground);
    for (const side of [-1, 1]) {
      block(park, p.x + side * 18, 0.55, p.z, 3, 0.2, 1, 0x7f8070);
      block(park, p.x + side * 18, 0.3, p.z, 0.2, 0.6, 0.8, 0x455f60);
    }
    const arena = new Mesh(
      new CircleGeometry(16, 32),
      new MeshLambertMaterial({ color: 0x375c57 })
    );
    arena.rotation.x = -Math.PI / 2;
    arena.position.set(p.x, 0.05, p.z);
    park.add(arena);
    root.add(park);
  }
  const animate = (seconds: number, position: Vector3) => {
    root.children.forEach((g) => {
      if (!g.name.startsWith('citizen-')) return;
      g.visible = Math.hypot(g.position.x - position.x, g.position.z - position.z) < 180;
      g.children
        .filter((n) => n.name === 'citizen-arm')
        .forEach((arm, i) => {
          arm.rotation.x = Math.sin(seconds * 1.8 + i) * 0.13;
        });
    });
  };
  scene.userData.animateCityLife = animate;
}
export { CITY_BUILDINGS };
