import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { ZoneId } from './profile';
import { TRADES, type LootEntry, type LootResource } from './profile';
import { zoneConfig, type ZoneWorld, type Npc, type CraftingStation } from './zones';
import { getBossForZone, buildBossMesh, type ActiveBoss } from './bosses';

export const LOOT_TABLE: Record<
  string,
  { resource: LootResource; min: number; max: number; chance: number }[]
> = {
  wolf: [{ resource: 'hierba', min: 1, max: 2, chance: 0.6 }],
  spirit: [{ resource: 'esencia', min: 1, max: 2, chance: 0.7 }],
  skeleton: [
    { resource: 'mineral', min: 1, max: 2, chance: 0.5 },
    { resource: 'madera', min: 1, max: 1, chance: 0.3 },
  ],
  golem: [
    { resource: 'mineral', min: 2, max: 4, chance: 0.9 },
    { resource: 'esencia', min: 1, max: 3, chance: 0.6 },
  ],
};

export function rollLoot(creatureKind: string): LootEntry[] {
  const table = LOOT_TABLE[creatureKind];
  if (!table) return [];
  const drops: LootEntry[] = [];
  for (const entry of table) {
    if (Math.random() < entry.chance) {
      const amount = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
      drops.push({ resource: entry.resource, amount });
    }
  }
  return drops;
}

const material = (color: number) => new MeshLambertMaterial({ color, flatShading: true });

export type Enemy = {
  mesh: Group;
  health: number;
  maxHealth: number;
  alive: boolean;
  name: string;
  damage: number;
  speed: number;
  spawnPosition: Vector3;
  kind: 'wolf' | 'spirit' | 'skeleton' | 'golem';
  zone: ZoneId;
  hpBar: Mesh;
  hpBarBg: Mesh;
};
export type ResourceKind = 'trigo' | 'mineral' | 'esencia' | 'madera' | 'hierba';
export type ResourceNode = { mesh: Group; kind: ResourceKind; active: boolean };
export type World = { enemies: Enemy[]; resources: ResourceNode[]; boss: ActiveBoss | null };

export function createWorld(scene: Scene, zone: ZoneId): ZoneWorld {
  const cfg = zoneConfig(zone);
  scene.background = new Color(cfg.fogColor);
  scene.fog = new Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);

  const ground = new Mesh(
    new PlaneGeometry(cfg.groundSize, cfg.groundSize),
    material(cfg.groundColor)
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  scene.add(new HemisphereLight(0xd8edff, 0x273b28, 2.1));
  const sun = new DirectionalLight(0xfff0c9, 1.8);
  sun.position.set(8, 14, 5);
  scene.add(sun);

  const resourceMap: Record<ZoneId, (scene: Scene) => ResourceNode[]> = {
    aldea: createAldeaResources,
    bosque: createBosqueResources,
    ruinas: createRuinasResources,
    desierto: createDesiertoResources,
    cueva: createCuevaResources,
  };
  const enemyMap: Record<ZoneId, () => Enemy[]> = {
    aldea: createAldeaEnemies,
    bosque: createBosqueEnemies,
    ruinas: createRuinasEnemies,
    desierto: createDesiertoEnemies,
    cueva: createCuevaEnemies,
  };
  const resources = resourceMap[zone](scene);
  const enemies = enemyMap[zone]();
  enemies.forEach((e) => scene.add(e.mesh));
  const npcs = createNpcs(scene, zone);
  const stations = createStations(scene, zone);
  const portals = addPortals(scene, zone);
  const boss = createBoss(scene, zone);

  return {
    enemies,
    resources,
    boss,
    npcs,
    stations,
    portals,
    groundColor: cfg.groundColor,
    fogColor: cfg.fogColor,
    fogNear: cfg.fogNear,
    fogFar: cfg.fogFar,
    groundSize: cfg.groundSize,
  };
}

function createAldeaResources(scene: Scene): ResourceNode[] {
  const resources = [
    createResource('trigo', -3.5, -1.8),
    createResource('trigo', -5.2, 1.5),
    createResource('mineral', 5, 3.5),
    createResource('mineral', 7, 0.5),
    createResource('esencia', 1.5, 6),
    createResource('madera', -8, 4),
    createResource('madera', 8, -6),
    createResource('hierba', -2, 7),
    createResource('hierba', 6, -4),
  ];
  resources.forEach((r) => scene.add(r.mesh));

  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      if ((x * 7 + z * 3) % 4 === 0 && !(x === 0 && z === 0))
        addTree(scene, x * 4 + (z % 2), z * 4);
    }
  }
  addRuin(scene, -6, -5);
  addHouse(scene, 5, -3);
  addHouse(scene, -4, 5);

  return resources;
}

function createBosqueResources(scene: Scene): ResourceNode[] {
  const resources = [
    createResource('trigo', -6, -4),
    createResource('trigo', 4, -7),
    createResource('mineral', 7, 2),
    createResource('mineral', -8, 1),
    createResource('esencia', 0, -5),
    createResource('esencia', 3, 4),
    createResource('madera', -5, -8),
    createResource('madera', 6, -2),
    createResource('hierba', 2, 7),
    createResource('hierba', -3, 3),
    createResource('hierba', 8, -5),
  ];
  resources.forEach((r) => scene.add(r.mesh));

  for (let x = -6; x <= 6; x++) {
    for (let z = -6; z <= 6; z++) {
      if ((x * 5 + z * 7) % 3 === 0 && !(x === 0 && z === 8))
        addTree(scene, x * 3.5 + (z % 2), z * 3.5);
    }
  }
  addForestShrine(scene, 0, -8);

  return resources;
}

function createAldeaEnemies(): Enemy[] {
  const wolf = createCreature('Lobo ancestral', 6, 0x68656b, 'wolf', 'aldea');
  wolf.mesh.position.set(3.5, 0, -5);
  wolf.spawnPosition.copy(wolf.mesh.position);
  const guardian = createCreature('Guardian de las ruinas', 10, 0x4d657d, 'skeleton', 'aldea');
  guardian.mesh.position.set(-6, 0, -3);
  guardian.spawnPosition.copy(guardian.mesh.position);
  return [wolf, guardian];
}

function createBosqueEnemies(): Enemy[] {
  const w1 = createCreature('Lobo sombrio', 8, 0x4a3f4f, 'wolf', 'bosque');
  w1.mesh.position.set(-4, 0, -6);
  w1.spawnPosition.copy(w1.mesh.position);
  const w2 = createCreature('Lobo alfa', 12, 0x5c4f5e, 'wolf', 'bosque');
  w2.mesh.position.set(5, 0, -3);
  w2.spawnPosition.copy(w2.mesh.position);
  const spirit = createCreature('Espiritu del bosque', 15, 0x6b9fbf, 'spirit', 'bosque');
  spirit.mesh.position.set(0, 0, -10);
  spirit.spawnPosition.copy(spirit.mesh.position);
  const skeleton = createCreature('Guerrero ancestral', 14, 0x8a8a7a, 'skeleton', 'bosque');
  skeleton.mesh.position.set(-7, 0, 2);
  skeleton.spawnPosition.copy(skeleton.mesh.position);
  return [w1, w2, spirit, skeleton];
}

function createRuinasResources(scene: Scene): ResourceNode[] {
  const resources = [
    createResource('mineral', -5, -3),
    createResource('mineral', 6, 1),
    createResource('esencia', -2, -6),
    createResource('esencia', 4, -4),
    createResource('madera', -7, 3),
    createResource('madera', 3, 6),
    createResource('hierba', 1, -3),
    createResource('hierba', -4, 5),
    createResource('trigo', -6, -5),
    createResource('trigo', 5, -6),
  ];
  resources.forEach((r) => scene.add(r.mesh));
  addRuin(scene, -3, -4);
  addRuin(scene, 4, 3);
  addRuin(scene, -5, 6);
  addForestShrine(scene, 0, -8);
  return resources;
}

function createRuinasEnemies(): Enemy[] {
  const golem = createCreature('Golem anciano', 25, 0x7a6a5a, 'golem', 'ruinas');
  golem.mesh.position.set(0, 0, -5);
  golem.spawnPosition.copy(golem.mesh.position);
  const golem2 = createCreature('Golem de batalla', 18, 0x6b5b4b, 'golem', 'ruinas');
  golem2.mesh.position.set(-5, 0, 2);
  golem2.spawnPosition.copy(golem2.mesh.position);
  const phantom = createCreature('Fantom ancestral', 12, 0x8a7fbf, 'spirit', 'ruinas');
  phantom.mesh.position.set(5, 0, -3);
  phantom.spawnPosition.copy(phantom.mesh.position);
  return [golem, golem2, phantom];
}

function createDesiertoResources(scene: Scene): ResourceNode[] {
  const resources = [
    createResource('mineral', -7, -3),
    createResource('mineral', 8, 2),
    createResource('esencia', -3, -7),
    createResource('esencia', 5, -5),
    createResource('trigo', -6, 5),
    createResource('trigo', 7, 6),
    createResource('madera', -8, -6),
    createResource('madera', 4, 8),
    createResource('hierba', 2, -8),
    createResource('hierba', -5, 3),
  ];
  resources.forEach((r) => scene.add(r.mesh));

  for (let x = -6; x <= 6; x++) {
    for (let z = -6; z <= 6; z++) {
      if ((x * 3 + z * 5) % 7 === 0 && !(x === 0 && z === 0))
        addCactus(scene, x * 4 + (z % 2), z * 4);
    }
  }
  addRuin(scene, -5, -5);
  addRuin(scene, 6, 4);

  return resources;
}

function createDesiertoEnemies(): Enemy[] {
  const scorpion = createCreature('Escorpion del desierto', 20, 0xc2a050, 'wolf', 'desierto');
  scorpion.mesh.position.set(5, 0, -4);
  scorpion.spawnPosition.copy(scorpion.mesh.position);
  const serpent = createCreature('Serpiente de arena', 18, 0xb89040, 'spirit', 'desierto');
  serpent.mesh.position.set(-6, 0, 2);
  serpent.spawnPosition.copy(serpent.mesh.position);
  const mummy = createCreature('Momia ancestral', 30, 0xd4c4a0, 'skeleton', 'desierto');
  mummy.mesh.position.set(0, 0, -8);
  mummy.spawnPosition.copy(mummy.mesh.position);
  return [scorpion, serpent, mummy];
}

function createCuevaResources(scene: Scene): ResourceNode[] {
  const resources = [
    createResource('mineral', -5, -4),
    createResource('mineral', 6, 3),
    createResource('mineral', -3, 6),
    createResource('esencia', 4, -6),
    createResource('esencia', -7, -1),
    createResource('esencia', 2, 7),
    createResource('madera', -8, 4),
    createResource('madera', 7, -3),
    createResource('hierba', 1, -7),
    createResource('hierba', -4, 2),
    createResource('trigo', 5, 5),
  ];
  resources.forEach((r) => scene.add(r.mesh));

  addRuin(scene, -4, -5);
  addForestShrine(scene, 3, -8);

  return resources;
}

function createCuevaEnemies(): Enemy[] {
  const bat = createCreature('Murcielago cavernicola', 15, 0x3a3a4a, 'wolf', 'cueva');
  bat.mesh.position.set(4, 0, -5);
  bat.spawnPosition.copy(bat.mesh.position);
  const ghost = createCreature('Fantasma de la cueva', 22, 0x5a4a6a, 'spirit', 'cueva');
  ghost.mesh.position.set(-5, 0, 3);
  ghost.spawnPosition.copy(ghost.mesh.position);
  const golem = createCreature('Golem de obsidiana', 40, 0x2a2a35, 'golem', 'cueva');
  golem.mesh.position.set(0, 0, -6);
  golem.spawnPosition.copy(golem.mesh.position);
  return [bat, ghost, golem];
}

function createBoss(scene: Scene, zone: ZoneId): ActiveBoss | null {
  const bossDef = getBossForZone(zone);
  if (!bossDef) return null;

  const mesh = buildBossMesh(bossDef) as Group & { hpBar: Mesh; hpBarBg: Mesh; phaseBar: Mesh };
  const positions: Record<ZoneId, { x: number; z: number }> = {
    aldea: { x: -12, z: -15 },
    bosque: { x: 10, z: -12 },
    ruinas: { x: -8, z: -10 },
    desierto: { x: 0, z: -14 },
    cueva: { x: 0, z: -12 },
  };
  const pos = positions[zone];
  mesh.position.set(pos.x, 0, pos.z);
  scene.add(mesh);

  return {
    definition: bossDef,
    mesh,
    health: bossDef.maxHealth,
    maxHealth: bossDef.maxHealth,
    alive: true,
    currentPhase: 1,
    lastAttack: 0,
    lastAbilityUse: new Map(),
    enrageTimer: 0,
    enrageMaxTime: 45000,
    enraged: false,
    summonCount: 0,
    spawnPosition: new Vector3(pos.x, 0, pos.z),
    hpBar: mesh.hpBar,
    hpBarBg: mesh.hpBarBg,
    phaseBar: mesh.phaseBar,
  };
}

function createNpcs(scene: Scene, zone: ZoneId): Npc[] {
  const npcs: Npc[] = [];
  if (zone === 'aldea') {
    const merchant = createNpcMesh(0xc9a44a);
    merchant.position.set(3, 0, 2);
    scene.add(merchant);
    npcs.push({
      mesh: merchant,
      name: 'Mercader del pueblo',
      dialogue: 'Bienvenido, viajero. Puedo intercambiar recursos por otros.',
      tradeOffers: TRADES,
    });

    const elder = createNpcMesh(0x8a7560);
    elder.position.set(-3, 0, 3);
    scene.add(elder);
    npcs.push({
      mesh: elder,
      name: 'Sabio de la aldea',
      dialogue:
        'El bosque al norte esta infestado de criaturas. Completa la mision inicial para desbloquearlo.',
    });

    const smith = createNpcMesh(0x6b6b6b);
    smith.position.set(6, 0, -1);
    scene.add(smith);
    npcs.push({
      mesh: smith,
      name: 'Herrero local',
      dialogue: 'Traeme mineral y te fare un arma. O usa la fragua para fabricar.',
    });
  } else if (zone === 'bosque') {
    const mystic = createNpcMesh(0x7a6fbf);
    mystic.position.set(2, 0, 10);
    scene.add(mystic);
    npcs.push({
      mesh: mystic,
      name: 'Mistico del bosque',
      dialogue: 'Este bosque guarda secretos antiguos. Derrota al espiritu para progresar.',
    });

    const trader = createNpcMesh(0xbfa46a);
    trader.position.set(-2, 0, 12);
    scene.add(trader);
    npcs.push({
      mesh: trader,
      name: 'Comerciante errante',
      dialogue: 'Compro hierbas y esencias a buen precio.',
      tradeOffers: TRADES.filter((t) => t.give === 'hierba' || t.give === 'esencia'),
    });
  } else if (zone === 'ruinas') {
    const keeper = createNpcMesh(0x9a7a4a);
    keeper.position.set(3, 0, 5);
    scene.add(keeper);
    npcs.push({
      mesh: keeper,
      name: 'Guardian de las ruinas',
      dialogue: 'Estas ruinas guardan un poder antiguo. Derrota a los golem para reclamarlo.',
    });

    const merchant = createNpcMesh(0xc9a44a);
    merchant.position.set(-4, 0, 2);
    scene.add(merchant);
    npcs.push({
      mesh: merchant,
      name: 'Colector de reliquias',
      dialogue: 'Traeme minerales y esencias de los golem. Pago bien por ellos.',
      tradeOffers: TRADES.filter((t) => t.give === 'mineral' || t.give === 'esencia'),
    });
  } else if (zone === 'desierto') {
    const nomad = createNpcMesh(0xc9a44a);
    nomad.position.set(3, 0, 3);
    scene.add(nomad);
    npcs.push({
      mesh: nomad,
      name: 'Nomada del desierto',
      dialogue: 'El desierto es cruel pero guarda tesoros. Busca las momias para obtener esencia.',
      tradeOffers: TRADES,
    });

    const sage = createNpcMesh(0xbfa46a);
    sage.position.set(-3, 0, -2);
    scene.add(sage);
    npcs.push({
      mesh: sage,
      name: 'Sabio del oasis',
      dialogue: 'Las criaturas del desierto son fuertes. Preparate antes de aventurarte.',
    });
  } else {
    const miner = createNpcMesh(0x6b6b6b);
    miner.position.set(3, 0, 3);
    scene.add(miner);
    npcs.push({
      mesh: miner,
      name: 'Minero veterano',
      dialogue: 'La cueva es profunda y peligrosa. Los golem de obsidiana son formidables.',
      tradeOffers: TRADES.filter((t) => t.give === 'mineral' || t.give === 'esencia'),
    });

    const mystic = createNpcMesh(0x7a6fbf);
    mystic.position.set(-4, 0, -1);
    scene.add(mystic);
    npcs.push({
      mesh: mystic,
      name: 'Ermitano de la cueva',
      dialogue: 'He estudiado a las criaturas de aqui. Sus esencias son muy poderosas.',
    });
  }
  return npcs;
}

function createStations(scene: Scene, zone: ZoneId): CraftingStation[] {
  const stations: CraftingStation[] = [];
  if (zone === 'aldea') {
    const forge = createStationMesh(0x8b4513, 0xc0c0c0);
    forge.position.set(7, 0, 0);
    scene.add(forge);
    stations.push({ mesh: forge, name: 'Fragua', recipe: 'espada' });

    const cauldron = createStationMesh(0x555555, 0x44aa44);
    cauldron.position.set(-5, 0, 7);
    scene.add(cauldron);
    stations.push({ mesh: cauldron, name: 'Caldero', recipe: 'pocion' });
  } else if (zone === 'bosque') {
    const altar = createStationMesh(0x6a5acd, 0x9966cc);
    altar.position.set(0, 0, -6);
    scene.add(altar);
    stations.push({ mesh: altar, name: 'Altar ancestral', recipe: 'unguento' });

    const workbench = createStationMesh(0x8b6914, 0xa0a0a0);
    workbench.position.set(5, 0, 8);
    scene.add(workbench);
    stations.push({ mesh: workbench, name: 'Banco de trabajo', recipe: 'escudo' });
  } else if (zone === 'ruinas') {
    const forge = createStationMesh(0x6b3a1a, 0x9999aa);
    forge.position.set(5, 0, -2);
    scene.add(forge);
    stations.push({ mesh: forge, name: 'Fragua ancestral', recipe: 'espada' });

    const altar = createStationMesh(0x5a4a6a, 0xaa88dd);
    altar.position.set(-5, 0, -4);
    scene.add(altar);
    stations.push({ mesh: altar, name: 'Altar de poder', recipe: 'pocion' });
  } else if (zone === 'desierto') {
    const oasisForge = createStationMesh(0xc2a050, 0xddcc88);
    oasisForge.position.set(4, 0, 5);
    scene.add(oasisForge);
    stations.push({ mesh: oasisForge, name: 'Fragua del oasis', recipe: 'armadura' });

    const sandAltar = createStationMesh(0xb89040, 0xffcc00);
    sandAltar.position.set(-6, 0, -3);
    scene.add(sandAltar);
    stations.push({ mesh: sandAltar, name: 'Altar solar', recipe: 'amuleto' });
  } else {
    const deepForge = createStationMesh(0x2a2a35, 0x5555aa);
    deepForge.position.set(5, 0, 2);
    scene.add(deepForge);
    stations.push({ mesh: deepForge, name: 'Forja profunda', recipe: 'pocion_fuerza' });

    const crystalAltar = createStationMesh(0x3a3a4a, 0x7766cc);
    crystalAltar.position.set(-5, 0, -3);
    scene.add(crystalAltar);
    stations.push({ mesh: crystalAltar, name: 'Altar de cristal', recipe: 'gran_pocion' });
  }
  return stations;
}

function addPortals(scene: Scene, zone: ZoneId): import('./zones').ZonePortal[] {
  const buildPortal = (x: number, z: number, color = 0xe8ba66) => {
    const portal = new Group();
    const ring = new Mesh(new TorusGeometry(1.2, 0.15, 6, 12), material(color));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.2;
    const glow = new Mesh(new SphereGeometry(0.8, 6, 4), material(color));
    glow.position.y = 1.2;
    portal.add(ring, glow);
    portal.position.set(x, 0, z);
    scene.add(portal);
  };

  const portalConfigs: Record<ZoneId, { x: number; z: number; color: number }[]> = {
    aldea: [{ x: 0, z: -18, color: 0xe8ba66 }],
    bosque: [
      { x: 0, z: 18, color: 0xe8ba66 },
      { x: -10, z: -14, color: 0xaa88dd },
      { x: 12, z: -12, color: 0x44aaaa },
    ],
    ruinas: [
      { x: 0, z: 14, color: 0xe8ba66 },
      { x: -10, z: -12, color: 0xdd8844 },
    ],
    desierto: [
      { x: 0, z: 18, color: 0xaa88dd },
      { x: 10, z: -14, color: 0x555577 },
    ],
    cueva: [{ x: 0, z: 14, color: 0xdd8844 }],
  };

  for (const p of portalConfigs[zone]) {
    buildPortal(p.x, p.z, p.color);
  }

  const portals: import('./zones').ZonePortal[] =
    zone === 'aldea'
      ? [{ position: { x: 0, z: -18 }, targetZone: 'bosque' as ZoneId, label: 'Bosque Ancestral' }]
      : zone === 'bosque'
        ? [
            {
              position: { x: 0, z: 18 },
              targetZone: 'aldea' as ZoneId,
              label: 'Volver a la Aldea',
            },
            {
              position: { x: -10, z: -14 },
              targetZone: 'ruinas' as ZoneId,
              label: 'Ruinas Antiguas',
            },
            {
              position: { x: 12, z: -12 },
              targetZone: 'desierto' as ZoneId,
              label: 'Desierto Ardiente',
            },
          ]
        : zone === 'ruinas'
          ? [
              {
                position: { x: 0, z: 14 },
                targetZone: 'bosque' as ZoneId,
                label: 'Volver al Bosque',
              },
              {
                position: { x: -10, z: -12 },
                targetZone: 'cueva' as ZoneId,
                label: 'Cueva Profunda',
              },
            ]
          : zone === 'desierto'
            ? [
                {
                  position: { x: 0, z: 18 },
                  targetZone: 'bosque' as ZoneId,
                  label: 'Volver al Bosque',
                },
                {
                  position: { x: 10, z: -14 },
                  targetZone: 'cueva' as ZoneId,
                  label: 'Cueva Profunda',
                },
              ]
            : [
                {
                  position: { x: 0, z: 14 },
                  targetZone: 'ruinas' as ZoneId,
                  label: 'Volver a las Ruinas',
                },
              ];
  return portals;
}

function addTree(scene: Scene, x: number, z: number) {
  const tree = new Group();
  const trunk = new Mesh(cylinderGeometry(0.32, 2), material(0x62432c));
  trunk.position.y = 1;
  const crown = new Mesh(new ConeGeometry(1.3, 3.8, 6), material(0x28513b));
  crown.position.y = 3.2;
  tree.add(trunk, crown);
  tree.position.set(x, 0, z);
  tree.rotation.y = (x + z) * 0.5;
  scene.add(tree);
}

function addCactus(scene: Scene, x: number, z: number) {
  const cactus = new Group();
  const body = new Mesh(new CylinderGeometry(0.2, 0.25, 1.8, 6), material(0x4a8a3a));
  body.position.y = 0.9;
  cactus.add(body);
  if (Math.random() > 0.4) {
    const arm = new Mesh(new CylinderGeometry(0.12, 0.15, 0.8, 5), material(0x4a8a3a));
    arm.position.set(0.3, 1.2, 0);
    arm.rotation.z = -0.6;
    cactus.add(arm);
  }
  cactus.position.set(x, 0, z);
  cactus.rotation.y = Math.random() * Math.PI;
  scene.add(cactus);
}

function cylinderGeometry(radius: number, height: number) {
  return new ConeGeometry(radius, height, 6);
}

function addRuin(scene: Scene, x: number, z: number) {
  const ruin = new Group();
  for (const offset of [-1.5, 1.5]) {
    const column = new Mesh(new BoxGeometry(0.7, 2.8, 0.7), material(0x8c927b));
    column.position.set(offset, 1.4, 0);
    ruin.add(column);
  }
  const lintel = new Mesh(new BoxGeometry(3.8, 0.55, 0.8), material(0x8c927b));
  lintel.position.y = 2.8;
  ruin.add(lintel);
  ruin.position.set(x, 0, z);
  scene.add(ruin);
}

function addHouse(scene: Scene, x: number, z: number) {
  const house = new Group();
  const walls = new Mesh(new BoxGeometry(2.5, 2, 2.5), material(0x8b7355));
  walls.position.y = 1;
  const roof = new Mesh(new ConeGeometry(2.2, 1.5, 4), material(0x8b3a3a));
  roof.position.y = 2.75;
  roof.rotation.y = Math.PI / 4;
  const door = new Mesh(new BoxGeometry(0.6, 1.2, 0.1), material(0x5a3a1a));
  door.position.set(0, 0.6, 1.3);
  house.add(walls, roof, door);
  house.position.set(x, 0, z);
  scene.add(house);
}

function addForestShrine(scene: Scene, x: number, z: number) {
  const shrine = new Group();
  const base = new Mesh(new CylinderGeometry(0.8, 1, 0.4, 6), material(0x7a7a6a));
  base.position.y = 0.2;
  const pillar = new Mesh(new CylinderGeometry(0.2, 0.25, 2.2, 6), material(0x8a8a7a));
  pillar.position.y = 1.3;
  const crystal = new Mesh(new SphereGeometry(0.35, 5, 4), material(0x9c70cb));
  crystal.position.y = 2.6;
  shrine.add(base, pillar, crystal);
  shrine.position.set(x, 0, z);
  scene.add(shrine);
}

function createNpcMesh(color: number): Group {
  const npc = new Group();
  const body = new Mesh(new CapsuleGeometry(0.35, 0.7, 4, 6), material(color));
  body.position.y = 0.9;
  const head = new Mesh(new SphereGeometry(0.28, 7, 5), material(0xe0ad7d));
  head.position.y = 1.6;
  npc.add(body, head);
  return npc;
}

function createStationMesh(baseColor: number, accentColor: number): Group {
  const station = new Group();
  const base = new Mesh(new BoxGeometry(1.2, 0.6, 1.2), material(baseColor));
  base.position.y = 0.3;
  const top = new Mesh(new BoxGeometry(0.8, 0.4, 0.8), material(accentColor));
  top.position.y = 0.8;
  station.add(base, top);
  return station;
}

function createCreature(
  name: string,
  maxHealth: number,
  color: number,
  kind: 'wolf' | 'spirit' | 'skeleton' | 'golem',
  zone: ZoneId
): Enemy {
  const mesh = new Group();
  const hpHeight =
    kind === 'golem' ? 4.8 : kind === 'skeleton' ? 4.0 : kind === 'spirit' ? 3.8 : 3.0;
  const hpBarBg = new Mesh(new BoxGeometry(1.4, 0.14, 0.05), material(0x111111));
  const hpBar = new Mesh(new BoxGeometry(1.4, 0.14, 0.06), material(0xcc3333));
  hpBarBg.position.y = hpHeight;
  hpBar.position.y = hpHeight;
  hpBar.position.z = 0.01;

  if (kind === 'wolf') buildWolf(mesh, color, maxHealth);
  else if (kind === 'spirit') buildSpirit(mesh, color);
  else if (kind === 'skeleton') buildSkeleton(mesh, color);
  else buildGolem(mesh, color, maxHealth);

  const damageMap: Record<string, number> = {
    wolf: maxHealth * 2.5,
    spirit: maxHealth * 2.2,
    skeleton: maxHealth * 2,
    golem: maxHealth * 3,
  };
  const speedMap: Record<string, number> = { wolf: 1.3, spirit: 0.9, skeleton: 1.1, golem: 0.6 };

  mesh.add(hpBarBg, hpBar);
  return {
    mesh,
    health: maxHealth,
    maxHealth,
    alive: true,
    name,
    damage: damageMap[kind],
    speed: speedMap[kind],
    spawnPosition: new Vector3(),
    kind,
    zone,
    hpBar,
    hpBarBg,
  };
}

function buildWolf(mesh: Group, color: number, hp: number) {
  const fur = material(color);
  const darkFur = material(color - 0x1a1a1a);
  const belly = material(color + 0x181818);

  const torso = new Mesh(new BoxGeometry(2.2, 0.85, 0.95), fur);
  torso.position.y = 1.55;
  const chest = new Mesh(new BoxGeometry(1.0, 0.7, 1.0), fur);
  chest.position.set(0.6, 1.6, 0);

  const head = new Mesh(new BoxGeometry(0.85, 0.7, 0.8), fur);
  head.position.set(1.5, 1.85, 0);
  const snout = new Mesh(new BoxGeometry(0.7, 0.35, 0.45), belly);
  snout.position.set(2.1, 1.65, 0);
  const jaw = new Mesh(new BoxGeometry(0.55, 0.15, 0.4), material(0x883333));
  jaw.position.set(2.1, 1.48, 0);

  const ear1 = new Mesh(new ConeGeometry(0.15, 0.45, 4), darkFur);
  ear1.position.set(1.35, 2.35, -0.3);
  const ear2 = ear1.clone();
  ear2.position.z = 0.3;

  const eyeGlow = material(hp > 4 ? 0xff1111 : 0xff4400);
  const eye1 = new Mesh(new SphereGeometry(0.09, 5, 4), eyeGlow);
  eye1.position.set(1.8, 2.0, -0.28);
  const eye2 = eye1.clone();
  eye2.position.z = 0.28;

  const fang1 = new Mesh(new ConeGeometry(0.04, 0.22, 4), material(0xeeeecc));
  fang1.position.set(2.15, 1.4, -0.12);
  fang1.rotation.z = Math.PI;
  const fang2 = fang1.clone();
  fang2.position.z = 0.12;

  for (const z of [-0.35, 0.35]) {
    const fLeg = new Mesh(new BoxGeometry(0.28, 1.0, 0.28), darkFur);
    fLeg.position.set(0.55, 0.5, z);
    const bLeg = new Mesh(new BoxGeometry(0.25, 0.9, 0.25), darkFur);
    bLeg.position.set(-0.75, 0.45, z);
    mesh.add(fLeg, bLeg);
    const paw = new Mesh(new BoxGeometry(0.32, 0.12, 0.32), material(0x332222));
    paw.position.set(0.55, 0.06, z);
    mesh.add(paw);
  }

  const tail = new Mesh(new BoxGeometry(0.15, 1.0, 0.15), fur);
  tail.position.set(-1.5, 1.8, 0);
  tail.rotation.z = 0.8;
  const tailTip = new Mesh(new BoxGeometry(0.2, 0.3, 0.2), belly);
  tailTip.position.set(-1.85, 2.15, 0);
  tailTip.rotation.z = 0.6;

  const mane = new Mesh(new BoxGeometry(0.4, 0.35, 1.0), darkFur);
  mane.position.set(0.9, 2.05, 0);

  mesh.add(
    torso,
    chest,
    head,
    snout,
    jaw,
    ear1,
    ear2,
    eye1,
    eye2,
    fang1,
    fang2,
    tail,
    tailTip,
    mane
  );
}

function buildSpirit(mesh: Group, color: number) {
  const mat = material(color);
  const matLight = material(color + 0x222233);

  const core = new Mesh(new SphereGeometry(0.9, 8, 6), mat);
  core.position.y = 2.0;
  const innerGlow = new Mesh(new SphereGeometry(0.55, 6, 5), material(0xffffff));
  innerGlow.position.y = 2.0;
  innerGlow.position.z = 0.3;

  const aura = new Mesh(new SphereGeometry(1.3, 8, 6), material(color - 0x111122));
  aura.position.y = 2.0;

  const crown = new Mesh(new ConeGeometry(0.5, 0.6, 5), matLight);
  crown.position.y = 3.1;
  crown.rotation.z = Math.PI;

  const eyeHole1 = new Mesh(new SphereGeometry(0.15, 5, 4), material(0x000000));
  eyeHole1.position.set(-0.3, 2.2, 0.8);
  const eyeGlow1 = new Mesh(new SphereGeometry(0.08, 4, 3), material(0xffffff));
  eyeGlow1.position.set(-0.3, 2.2, 0.88);
  const eyeHole2 = eyeHole1.clone();
  eyeHole2.position.x = 0.3;
  const eyeGlow2 = eyeGlow1.clone();
  eyeGlow2.position.x = 0.3;

  const mouth = new Mesh(new BoxGeometry(0.4, 0.08, 0.1), material(0x000000));
  mouth.position.set(0, 1.8, 0.85);

  for (let i = 0; i < 5; i++) {
    const wisp = new Mesh(new BoxGeometry(0.15, 0.8 + i * 0.15, 0.15), matLight);
    const angle = (i / 5) * Math.PI * 2;
    wisp.position.set(Math.cos(angle) * 0.6, 1.0 - i * 0.1, Math.sin(angle) * 0.6);
    wisp.rotation.z = Math.cos(angle) * 0.3;
    mesh.add(wisp);
  }

  for (let i = 0; i < 3; i++) {
    const orb = new Mesh(new SphereGeometry(0.18, 5, 4), matLight);
    const a = (i / 3) * Math.PI * 2 + 0.5;
    orb.position.set(Math.cos(a) * 1.5, 2.2 + Math.sin(i) * 0.4, Math.sin(a) * 1.5);
    mesh.add(orb);
  }

  mesh.add(core, innerGlow, aura, crown, eyeHole1, eyeGlow1, eyeHole2, eyeGlow2, mouth);
}

function buildSkeleton(mesh: Group, color: number) {
  const bone = material(color);
  const boneDark = material(color - 0x151515);
  const metal = material(0x555566);

  const pelvis = new Mesh(new BoxGeometry(0.5, 0.2, 0.35), bone);
  pelvis.position.y = 1.2;

  const rib1 = new Mesh(new BoxGeometry(0.7, 0.1, 0.4), bone);
  rib1.position.set(0, 1.6, 0);
  const rib2 = new Mesh(new BoxGeometry(0.65, 0.1, 0.38), bone);
  rib2.position.set(0, 1.8, 0);
  const rib3 = new Mesh(new BoxGeometry(0.55, 0.1, 0.35), bone);
  rib3.position.set(0, 2.0, 0);
  const spine = new Mesh(new BoxGeometry(0.12, 1.1, 0.12), boneDark);
  spine.position.set(0, 1.7, -0.12);

  const skull = new Mesh(new BoxGeometry(0.55, 0.55, 0.5), bone);
  skull.position.set(0, 2.7, 0.05);
  const jawBone = new Mesh(new BoxGeometry(0.4, 0.12, 0.3), bone);
  jawBone.position.set(0, 2.35, 0.15);
  const eyeSocket1 = new Mesh(new SphereGeometry(0.1, 5, 4), material(0x000000));
  eyeSocket1.position.set(-0.13, 2.78, 0.3);
  const eyeGlow1 = new Mesh(new SphereGeometry(0.06, 4, 3), material(0x33ff88));
  eyeGlow1.position.set(-0.13, 2.78, 0.35);
  const eyeSocket2 = eyeSocket1.clone();
  eyeSocket2.position.x = 0.13;
  const eyeGlow2 = eyeGlow1.clone();
  eyeGlow2.position.x = 0.13;
  const noseHole = new Mesh(new BoxGeometry(0.08, 0.1, 0.08), material(0x000000));
  noseHole.position.set(0, 2.62, 0.3);

  const shoulderL = new Mesh(new BoxGeometry(0.2, 0.15, 0.2), boneDark);
  shoulderL.position.set(-0.5, 2.15, 0);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.5;

  const armL = new Mesh(new BoxGeometry(0.12, 1.0, 0.12), bone);
  armL.position.set(-0.55, 1.6, 0);
  armL.rotation.z = 0.15;
  const handL = new Mesh(new BoxGeometry(0.15, 0.15, 0.15), bone);
  handL.position.set(-0.6, 1.05, 0);

  const armR = new Mesh(new BoxGeometry(0.12, 1.0, 0.12), bone);
  armR.position.set(0.55, 1.6, 0);
  armR.rotation.z = -0.15;

  const swordBlade = new Mesh(new BoxGeometry(0.08, 1.8, 0.04), metal);
  swordBlade.position.set(0.65, 2.2, 0);
  swordBlade.rotation.z = -0.1;
  const swordHilt = new Mesh(new BoxGeometry(0.3, 0.1, 0.1), material(0x664422));
  swordHilt.position.set(0.6, 1.25, 0);
  const swordGuard = new Mesh(new BoxGeometry(0.04, 0.04, 0.35), metal);
  swordGuard.position.set(0.62, 1.3, 0);

  const shield = new Mesh(new BoxGeometry(0.08, 0.7, 0.6), material(0x445566));
  shield.position.set(-0.7, 1.65, 0.1);
  const shieldBoss = new Mesh(new SphereGeometry(0.1, 5, 4), metal);
  shieldBoss.position.set(-0.74, 1.65, 0.1);

  for (const z of [-0.14, 0.14]) {
    const leg = new Mesh(new BoxGeometry(0.14, 1.1, 0.14), bone);
    leg.position.set(z > 0 ? 0.12 : -0.12, 0.55, z);
    const foot = new Mesh(new BoxGeometry(0.18, 0.1, 0.25), boneDark);
    foot.position.set(z > 0 ? 0.12 : -0.12, 0.05, z + 0.05);
    mesh.add(leg, foot);
  }

  const cape = new Mesh(new BoxGeometry(0.5, 0.8, 0.08), material(0x332244));
  cape.position.set(0, 1.8, -0.25);

  mesh.add(
    pelvis,
    rib1,
    rib2,
    rib3,
    spine,
    skull,
    jawBone,
    eyeSocket1,
    eyeGlow1,
    eyeSocket2,
    eyeGlow2,
    noseHole,
    shoulderL,
    shoulderR,
    armL,
    handL,
    armR,
    swordBlade,
    swordHilt,
    swordGuard,
    shield,
    shieldBoss,
    cape
  );
}

function buildGolem(mesh: Group, color: number, hp: number) {
  const rock = material(color);
  const rockDark = material(color - 0x151515);
  const rockLight = material(color + 0x1a1a1a);
  const magma = material(hp > 5 ? 0xff8800 : 0xff4400);

  const pelvis = new Mesh(new BoxGeometry(1.3, 0.5, 1.1), rockDark);
  pelvis.position.y = 1.0;

  const torso = new Mesh(new BoxGeometry(1.5, 1.4, 1.2), rock);
  torso.position.y = 2.0;

  const chestPlate = new Mesh(new BoxGeometry(1.0, 0.8, 0.15), rockLight);
  chestPlate.position.set(0, 2.2, 0.62);

  const core = new Mesh(new SphereGeometry(0.25, 6, 5), magma);
  core.position.set(0, 2.0, 0.65);

  for (let i = 0; i < 4; i++) {
    const crack = new Mesh(new BoxGeometry(0.06, 0.3 + i * 0.08, 0.06), magma);
    const angle = (i / 4) * Math.PI * 0.8 - 0.4;
    crack.position.set(Math.sin(angle) * 0.4, 1.8 + i * 0.15, 0.62);
    crack.rotation.z = angle * 0.5;
    mesh.add(crack);
  }

  const head = new Mesh(new BoxGeometry(0.7, 0.6, 0.65), rock);
  head.position.y = 3.1;
  const brow = new Mesh(new BoxGeometry(0.75, 0.15, 0.3), rockDark);
  brow.position.set(0, 3.4, 0.3);
  const eye1 = new Mesh(new BoxGeometry(0.14, 0.1, 0.1), magma);
  eye1.position.set(-0.18, 3.2, 0.33);
  const eye2 = eye1.clone();
  eye2.position.x = 0.18;

  const shoulderL = new Mesh(new BoxGeometry(0.6, 0.45, 0.55), rockDark);
  shoulderL.position.set(-1.05, 2.6, 0);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 1.05;

  const armL = new Mesh(new BoxGeometry(0.5, 1.4, 0.45), rock);
  armL.position.set(-1.1, 1.5, 0);
  const fistL = new Mesh(new BoxGeometry(0.6, 0.5, 0.55), rockLight);
  fistL.position.set(-1.1, 0.6, 0);

  const armR = new Mesh(new BoxGeometry(0.5, 1.4, 0.45), rock);
  armR.position.set(1.1, 1.5, 0);
  const fistR = new Mesh(new BoxGeometry(0.6, 0.5, 0.55), rockLight);
  fistR.position.set(1.1, 0.6, 0);

  for (const z of [-0.3, 0.3]) {
    const leg = new Mesh(new BoxGeometry(0.45, 0.9, 0.4), rockDark);
    leg.position.set(0, 0.45, z);
    const foot = new Mesh(new BoxGeometry(0.5, 0.15, 0.55), rock);
    foot.position.set(0, 0.07, z + 0.05);
    mesh.add(leg, foot);
  }

  for (let i = 0; i < 3; i++) {
    const shard = new Mesh(new BoxGeometry(0.15 + i * 0.05, 0.3, 0.1), rockLight);
    const a = (i / 3) * Math.PI * 2;
    shard.position.set(Math.cos(a) * 1.6, 2.5 + i * 0.3, Math.sin(a) * 1.6);
    shard.rotation.set(i * 0.4, a, 0.3);
    mesh.add(shard);
  }

  mesh.add(
    pelvis,
    torso,
    chestPlate,
    core,
    head,
    brow,
    eye1,
    eye2,
    shoulderL,
    shoulderR,
    armL,
    fistL,
    armR,
    fistR
  );
}

function createResource(kind: ResourceKind, x: number, z: number): ResourceNode {
  const mesh = new Group();
  const colors: Record<ResourceKind, number> = {
    trigo: 0xd8bc4f,
    mineral: 0x788c9a,
    esencia: 0x9c70cb,
    madera: 0x71472e,
    hierba: 0x75b954,
  };
  const glowColors: Record<ResourceKind, number> = {
    trigo: 0xffee88,
    mineral: 0xaabbcc,
    esencia: 0xbb99ee,
    madera: 0x996644,
    hierba: 0x88dd66,
  };
  const geometry =
    kind === 'trigo'
      ? new ConeGeometry(0.5, 2.0, 5)
      : kind === 'madera'
        ? new BoxGeometry(0.7, 1.0, 0.7)
        : new SphereGeometry(0.6, 6, 4);
  const item = new Mesh(geometry, material(colors[kind]));
  item.position.y = kind === 'trigo' ? 1.0 : 0.55;
  const glow = new Mesh(new SphereGeometry(0.35, 5, 4), material(glowColors[kind]));
  glow.position.y = kind === 'trigo' ? 1.8 : 1.1;
  mesh.add(item, glow);
  mesh.position.set(x, 0, z);
  return { mesh, kind, active: true };
}
