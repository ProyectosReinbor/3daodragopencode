import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { ZoneId } from './profile';
import type { LootResource } from './profile';

const material = (color: number) => new MeshLambertMaterial({ color, flatShading: true });

export type BossPhase = 1 | 2 | 3 | 4;

export type BossAbilityType = 'aoe' | 'summon' | 'enrage' | 'slam' | 'charge' | 'heal';

export interface BossAbility {
  type: BossAbilityType;
  name: string;
  damage: number;
  cooldown: number;
  range: number;
  description: string;
  phaseRequired: BossPhase;
}

export interface BossPhaseConfig {
  threshold: number;
  damageMultiplier: number;
  speedMultiplier: number;
  abilities: string[];
  message: string;
}

export interface BossLootEntry {
  resource: LootResource;
  min: number;
  max: number;
  chance: number;
}

export interface BossDefinition {
  id: string;
  name: string;
  zone: ZoneId;
  maxHealth: number;
  baseDamage: number;
  baseSpeed: number;
  attackRange: number;
  aggroRange: number;
  attackCooldown: number;
  xpReward: number;
  respawnTime: number;
  phases: BossPhaseConfig[];
  abilities: BossAbility[];
  loot: BossLootEntry[];
  color: number;
  scale: number;
}

export interface ActiveBoss {
  definition: BossDefinition;
  mesh: Group;
  health: number;
  maxHealth: number;
  alive: boolean;
  currentPhase: BossPhase;
  lastAttack: number;
  lastAbilityUse: Map<string, number>;
  enrageTimer: number;
  enrageMaxTime: number;
  enraged: boolean;
  summonCount: number;
  spawnPosition: Vector3;
  hpBar: Mesh;
  hpBarBg: Mesh;
  phaseBar: Mesh;
}

const BOSS_DEFINITIONS: BossDefinition[] = [
  {
    id: 'guardian_ancestral',
    name: 'Guardian Ancestral',
    zone: 'aldea',
    maxHealth: 120,
    baseDamage: 12,
    baseSpeed: 1.0,
    attackRange: 3.5,
    aggroRange: 14,
    attackCooldown: 1500,
    xpReward: 100,
    respawnTime: 120000,
    color: 0x6a5a4a,
    scale: 1.6,
    phases: [
      { threshold: 1.0, damageMultiplier: 1.0, speedMultiplier: 1.0, abilities: [], message: '' },
      {
        threshold: 0.75,
        damageMultiplier: 1.3,
        speedMultiplier: 1.1,
        abilities: ['ground_slam'],
        message: '¡El Guardian golpea el suelo con furia!',
      },
      {
        threshold: 0.5,
        damageMultiplier: 1.6,
        speedMultiplier: 1.2,
        abilities: ['summon_golems'],
        message: '¡El Guardian invoca fragmentos de piedra!',
      },
      {
        threshold: 0.25,
        damageMultiplier: 2.0,
        speedMultiplier: 1.4,
        abilities: ['enrage'],
        message: '¡El Guardian se ha enfurecido! ¡Ataca con todo!',
      },
    ],
    abilities: [
      {
        type: 'slam',
        name: 'Golpe de Tierra',
        damage: 20,
        cooldown: 4000,
        range: 4,
        description: 'Golpea el suelo creando una onda de choque.',
        phaseRequired: 2,
      },
      {
        type: 'summon',
        name: 'Invocar Fragmentos',
        damage: 0,
        cooldown: 12000,
        range: 0,
        description: 'Invoca 2 fragmentos de piedra que atacan al jugador.',
        phaseRequired: 3,
      },
      {
        type: 'enrage',
        name: 'Furia Ancestral',
        damage: 0,
        cooldown: 0,
        range: 0,
        description: 'Se enfurece aumentando su dano y velocidad.',
        phaseRequired: 4,
      },
    ],
    loot: [
      { resource: 'mineral', min: 5, max: 10, chance: 1.0 },
      { resource: 'esencia', min: 3, max: 6, chance: 0.8 },
      { resource: 'madera', min: 2, max: 5, chance: 0.5 },
    ],
  },
  {
    id: 'senor_bosque',
    name: 'Señor del Bosque',
    zone: 'bosque',
    maxHealth: 250,
    baseDamage: 18,
    baseSpeed: 1.4,
    attackRange: 3.8,
    aggroRange: 16,
    attackCooldown: 1300,
    xpReward: 200,
    respawnTime: 150000,
    color: 0x2a5a2a,
    scale: 1.8,
    phases: [
      { threshold: 1.0, damageMultiplier: 1.0, speedMultiplier: 1.0, abilities: [], message: '' },
      {
        threshold: 0.75,
        damageMultiplier: 1.4,
        speedMultiplier: 1.2,
        abilities: ['howl_debuff'],
        message: '¡El Señor del Bosque aúlla! Te sientes más lento.',
      },
      {
        threshold: 0.5,
        damageMultiplier: 1.8,
        speedMultiplier: 1.3,
        abilities: ['summon_wolves'],
        message: '¡El Señor del Bosque invoca lobos espirituales!',
      },
      {
        threshold: 0.25,
        damageMultiplier: 2.5,
        speedMultiplier: 1.5,
        abilities: ['charge_attack'],
        message: '¡El Señor del Bosque carga con desesperación!',
      },
    ],
    abilities: [
      {
        type: 'aoe',
        name: 'Aullido Espectral',
        damage: 15,
        cooldown: 5000,
        range: 6,
        description: 'Un aullido que daña y reduce velocidad.',
        phaseRequired: 2,
      },
      {
        type: 'summon',
        name: 'Invocar Lobos',
        damage: 0,
        cooldown: 15000,
        range: 0,
        description: 'Invoca 2 lobos espirituales.',
        phaseRequired: 3,
      },
      {
        type: 'charge',
        name: 'Carga Feroz',
        damage: 35,
        cooldown: 6000,
        range: 20,
        description: 'Carga rápidamente hacia el jugador.',
        phaseRequired: 4,
      },
    ],
    loot: [
      { resource: 'hierba', min: 5, max: 10, chance: 1.0 },
      { resource: 'esencia', min: 4, max: 8, chance: 0.85 },
      { resource: 'madera', min: 3, max: 7, chance: 0.6 },
    ],
  },
  {
    id: 'rey_golem',
    name: 'Rey Golem',
    zone: 'ruinas',
    maxHealth: 400,
    baseDamage: 25,
    baseSpeed: 0.7,
    attackRange: 4.0,
    aggroRange: 12,
    attackCooldown: 1800,
    xpReward: 350,
    respawnTime: 180000,
    color: 0x5a4a3a,
    scale: 2.2,
    phases: [
      { threshold: 1.0, damageMultiplier: 1.0, speedMultiplier: 1.0, abilities: [], message: '' },
      {
        threshold: 0.7,
        damageMultiplier: 1.5,
        speedMultiplier: 1.0,
        abilities: ['seismic_slam'],
        message: '¡El Rey Golem golpea con fuerza sísmica!',
      },
      {
        threshold: 0.4,
        damageMultiplier: 2.0,
        speedMultiplier: 1.3,
        abilities: ['summon_pillars'],
        message: '¡El Rey Golem invoca columnas de piedra!',
      },
      {
        threshold: 0.15,
        damageMultiplier: 3.0,
        speedMultiplier: 1.6,
        abilities: ['enrage', 'heal'],
        message: '¡El Rey Golem absorbe energía de las ruinas!',
      },
    ],
    abilities: [
      {
        type: 'slam',
        name: 'Golpe Sísmico',
        damage: 30,
        cooldown: 5000,
        range: 5,
        description: 'Un golpe devastador que sacude el suelo.',
        phaseRequired: 2,
      },
      {
        type: 'summon',
        name: 'Columnas de Piedra',
        damage: 0,
        cooldown: 18000,
        range: 0,
        description: 'Invoca 3 columnas de piedra.',
        phaseRequired: 3,
      },
      {
        type: 'enrage',
        name: 'Absorción de Ruinas',
        damage: 0,
        cooldown: 0,
        range: 0,
        description: 'Se fortalece absorbiendo energía.',
        phaseRequired: 4,
      },
      {
        type: 'heal',
        name: 'Regeneración',
        damage: 0,
        cooldown: 20000,
        range: 0,
        description: 'Recupera 15% de vida máxima.',
        phaseRequired: 4,
      },
    ],
    loot: [
      { resource: 'mineral', min: 8, max: 15, chance: 1.0 },
      { resource: 'esencia', min: 5, max: 10, chance: 0.9 },
      { resource: 'hierba', min: 3, max: 6, chance: 0.5 },
    ],
  },
  {
    id: 'faraon',
    name: 'Faraón Olvidado',
    zone: 'desierto',
    maxHealth: 550,
    baseDamage: 30,
    baseSpeed: 1.1,
    attackRange: 4.2,
    aggroRange: 15,
    attackCooldown: 1600,
    xpReward: 500,
    respawnTime: 240000,
    color: 0xc2a050,
    scale: 2.0,
    phases: [
      { threshold: 1.0, damageMultiplier: 1.0, speedMultiplier: 1.0, abilities: [], message: '' },
      {
        threshold: 0.75,
        damageMultiplier: 1.3,
        speedMultiplier: 1.2,
        abilities: ['sandstorm'],
        message: '¡El Faraón desata una tormenta de arena!',
      },
      {
        threshold: 0.45,
        damageMultiplier: 1.7,
        speedMultiplier: 1.3,
        abilities: ['summon_mummies'],
        message: '¡El Faraón invoca a sus guardianes eternos!',
      },
      {
        threshold: 0.2,
        damageMultiplier: 2.5,
        speedMultiplier: 1.6,
        abilities: ['curse'],
        message: '¡El Faraón lanza una maldición ancestral!',
      },
    ],
    abilities: [
      {
        type: 'aoe',
        name: 'Tormenta de Arena',
        damage: 22,
        cooldown: 5000,
        range: 7,
        description: 'Una tormenta que daña todo a su alrededor.',
        phaseRequired: 2,
      },
      {
        type: 'summon',
        name: 'Invocar Momias',
        damage: 0,
        cooldown: 16000,
        range: 0,
        description: 'Invoca 2 momias guardianes.',
        phaseRequired: 3,
      },
      {
        type: 'aoe',
        name: 'Maldición del Faraón',
        damage: 40,
        cooldown: 10000,
        range: 8,
        description: 'Maldición que causa daño continuo.',
        phaseRequired: 4,
      },
    ],
    loot: [
      { resource: 'esencia', min: 8, max: 15, chance: 1.0 },
      { resource: 'mineral', min: 5, max: 12, chance: 0.9 },
      { resource: 'hierba', min: 4, max: 8, chance: 0.6 },
    ],
  },
  {
    id: 'senor_profundidades',
    name: 'Señor de las Profundidades',
    zone: 'cueva',
    maxHealth: 750,
    baseDamage: 38,
    baseSpeed: 0.9,
    attackRange: 4.5,
    aggroRange: 13,
    attackCooldown: 1700,
    xpReward: 750,
    respawnTime: 300000,
    color: 0x2a1a35,
    scale: 2.5,
    phases: [
      { threshold: 1.0, damageMultiplier: 1.0, speedMultiplier: 1.0, abilities: [], message: '' },
      {
        threshold: 0.7,
        damageMultiplier: 1.5,
        speedMultiplier: 1.2,
        abilities: ['dark_pulse'],
        message: '¡El Señor emite un pulso de oscuridad!',
      },
      {
        threshold: 0.4,
        damageMultiplier: 2.0,
        speedMultiplier: 1.4,
        abilities: ['summon_shadows'],
        message: '¡El Señor invoca sombras de la cueva!',
      },
      {
        threshold: 0.15,
        damageMultiplier: 3.0,
        speedMultiplier: 1.8,
        abilities: ['abyssal_roar'],
        message: '¡El rugido del abismo te paraliza!',
      },
    ],
    abilities: [
      {
        type: 'aoe',
        name: 'Pulso Oscuro',
        damage: 28,
        cooldown: 5000,
        range: 6,
        description: 'Un pulso de energía oscuridad.',
        phaseRequired: 2,
      },
      {
        type: 'summon',
        name: 'Invocar Sombras',
        damage: 0,
        cooldown: 14000,
        range: 0,
        description: 'Invoca 3 sombras espectrales.',
        phaseRequired: 3,
      },
      {
        type: 'aoe',
        name: 'Rugido del Abismo',
        damage: 50,
        cooldown: 12000,
        range: 9,
        description: 'Un rugido devastador que daña todo.',
        phaseRequired: 4,
      },
    ],
    loot: [
      { resource: 'esencia', min: 10, max: 20, chance: 1.0 },
      { resource: 'mineral', min: 8, max: 15, chance: 0.95 },
      { resource: 'madera', min: 5, max: 10, chance: 0.7 },
    ],
  },
];

export function getBossForZone(zone: ZoneId): BossDefinition | undefined {
  return BOSS_DEFINITIONS.find((b) => b.zone === zone);
}

export function getAllBossDefinitions(): BossDefinition[] {
  return BOSS_DEFINITIONS;
}

export function getBossPhase(healthRatio: number, phases: BossPhaseConfig[]): BossPhase {
  for (let i = phases.length - 1; i >= 0; i--) {
    if (healthRatio <= phases[i].threshold) continue;
    return (i + 1) as BossPhase;
  }
  return 1;
}

export function rollBossLoot(
  definition: BossDefinition
): { resource: LootResource; amount: number }[] {
  const drops: { resource: LootResource; amount: number }[] = [];
  for (const entry of definition.loot) {
    if (Math.random() < entry.chance) {
      const amount = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
      drops.push({ resource: entry.resource, amount });
    }
  }
  return drops;
}

export function buildBossMesh(definition: BossDefinition): Group {
  const mesh = new Group();
  const bossColor = definition.color;
  const accentColor = bossColor + 0x222222;
  const darkColor = bossColor - 0x151515;
  const glowColor = 0xff6600;

  const bodyMat = material(bossColor);
  const accentMat = material(accentColor);
  const darkMat = material(darkColor);
  const glowMat = material(glowColor);

  switch (definition.id) {
    case 'guardian_ancestral':
      buildGuardianBoss(mesh, bodyMat, accentMat, darkMat, glowMat);
      break;
    case 'senor_bosque':
      buildForestLordBoss(mesh, bodyMat, accentMat, darkMat, glowMat);
      break;
    case 'rey_golem':
      buildGolemKingBoss(mesh, bodyMat, accentMat, darkMat, glowMat);
      break;
    case 'faraon':
      buildPharaohBoss(mesh, bodyMat, accentMat, darkMat, glowMat);
      break;
    case 'senor_profundidades':
      buildDeepLordBoss(mesh, bodyMat, accentMat, darkMat, glowMat);
      break;
  }

  const hpHeight = 5.5;
  const hpBarBg = new Mesh(new BoxGeometry(2.0, 0.18, 0.05), material(0x111111));
  const hpBar = new Mesh(new BoxGeometry(2.0, 0.18, 0.06), material(0xcc3333));
  const phaseBar = new Mesh(new BoxGeometry(2.0, 0.06, 0.05), material(0xffcc00));
  hpBarBg.position.y = hpHeight;
  hpBar.position.y = hpHeight;
  hpBar.position.z = 0.01;
  phaseBar.position.y = hpHeight - 0.15;
  phaseBar.position.z = 0.01;
  mesh.add(hpBarBg, hpBar, phaseBar);
  mesh.scale.setScalar(definition.scale);

  return mesh as Group & { hpBar: Mesh; hpBarBg: Mesh; phaseBar: Mesh };
}

function buildGuardianBoss(
  mesh: Group,
  bodyMat: MeshLambertMaterial,
  accentMat: MeshLambertMaterial,
  darkMat: MeshLambertMaterial,
  glowMat: MeshLambertMaterial
) {
  const torso = new Mesh(new BoxGeometry(2.0, 1.8, 1.4), bodyMat);
  torso.position.y = 2.2;
  const chest = new Mesh(new BoxGeometry(1.2, 1.0, 0.2), accentMat);
  chest.position.set(0, 2.5, 0.7);

  const core = new Mesh(new SphereGeometry(0.3, 6, 5), glowMat);
  core.position.set(0, 2.3, 0.75);

  const head = new Mesh(new BoxGeometry(1.0, 0.9, 0.9), bodyMat);
  head.position.y = 3.5;
  const brow = new Mesh(new BoxGeometry(1.1, 0.2, 0.4), darkMat);
  brow.position.set(0, 3.95, 0.35);
  const eye1 = new Mesh(new SphereGeometry(0.12, 5, 4), glowMat);
  eye1.position.set(-0.25, 3.5, 0.45);
  const eye2 = eye1.clone();
  eye2.position.x = 0.25;

  for (const side of [-1, 1]) {
    const shoulder = new Mesh(new BoxGeometry(0.6, 0.5, 0.6), darkMat);
    shoulder.position.set(side * 1.3, 2.8, 0);
    const arm = new Mesh(new BoxGeometry(0.45, 1.6, 0.4), bodyMat);
    arm.position.set(side * 1.3, 1.4, 0);
    const fist = new Mesh(new BoxGeometry(0.55, 0.5, 0.55), accentMat);
    fist.position.set(side * 1.3, 0.4, 0);
    mesh.add(shoulder, arm, fist);
  }

  for (const z of [-0.35, 0.35]) {
    const leg = new Mesh(new BoxGeometry(0.5, 1.0, 0.45), darkMat);
    leg.position.set(0, 0.5, z);
    const foot = new Mesh(new BoxGeometry(0.55, 0.15, 0.55), bodyMat);
    foot.position.set(0, 0.07, z);
    mesh.add(leg, foot);
  }

  for (let i = 0; i < 4; i++) {
    const shard = new Mesh(new BoxGeometry(0.12, 0.4, 0.08), accentMat);
    const a = (i / 4) * Math.PI * 2;
    shard.position.set(Math.cos(a) * 1.2, 3.8 + i * 0.15, Math.sin(a) * 1.2);
    shard.rotation.set(i * 0.3, a, 0.4);
    mesh.add(shard);
  }

  mesh.add(torso, chest, core, head, brow, eye1, eye2);
}

function buildForestLordBoss(
  mesh: Group,
  bodyMat: MeshLambertMaterial,
  accentMat: MeshLambertMaterial,
  darkMat: MeshLambertMaterial,
  glowMat: MeshLambertMaterial
) {
  const torso = new Mesh(new BoxGeometry(2.5, 1.0, 1.2), bodyMat);
  torso.position.y = 2.0;
  const chest = new Mesh(new BoxGeometry(1.2, 0.8, 1.2), accentMat);
  chest.position.set(0.6, 2.1, 0);

  const head = new Mesh(new BoxGeometry(1.0, 0.8, 0.9), bodyMat);
  head.position.set(1.8, 2.3, 0);
  const snout = new Mesh(new BoxGeometry(0.8, 0.4, 0.5), accentMat);
  snout.position.set(2.6, 2.0, 0);
  const jaw = new Mesh(new BoxGeometry(0.6, 0.15, 0.45), material(0x883333));
  jaw.position.set(2.5, 1.75, 0);

  for (const side of [-1, 1]) {
    const ear = new Mesh(new ConeGeometry(0.18, 0.55, 4), darkMat);
    ear.position.set(1.65, 2.95, side * 0.35);
    const eye = new Mesh(new SphereGeometry(0.1, 5, 4), glowMat);
    eye.position.set(2.3, 2.4, side * 0.3);
  }

  const mane = new Mesh(new BoxGeometry(0.5, 0.6, 1.2), darkMat);
  mane.position.set(0.9, 2.5, 0);

  for (const z of [-0.4, 0.4]) {
    const fLeg = new Mesh(new BoxGeometry(0.3, 1.1, 0.3), darkMat);
    fLeg.position.set(0.6, 0.9, z);
    const bLeg = new Mesh(new BoxGeometry(0.28, 1.0, 0.28), darkMat);
    bLeg.position.set(-0.9, 0.85, z);
    mesh.add(fLeg, bLeg);
  }

  const tail = new Mesh(new BoxGeometry(0.18, 1.2, 0.18), bodyMat);
  tail.position.set(-1.8, 2.3, 0);
  tail.rotation.z = 0.9;

  for (let i = 0; i < 6; i++) {
    const vine = new Mesh(new BoxGeometry(0.06, 0.8 + i * 0.12, 0.06), accentMat);
    const a = (i / 6) * Math.PI * 2;
    vine.position.set(Math.cos(a) * 1.4, 1.2 - i * 0.08, Math.sin(a) * 1.4);
    mesh.add(vine);
  }

  mesh.add(torso, chest, head, snout, jaw, mane, tail);
}

function buildGolemKingBoss(
  mesh: Group,
  bodyMat: MeshLambertMaterial,
  accentMat: MeshLambertMaterial,
  darkMat: MeshLambertMaterial,
  glowMat: MeshLambertMaterial
) {
  const pelvis = new Mesh(new BoxGeometry(1.6, 0.6, 1.3), darkMat);
  pelvis.position.y = 1.2;
  const torso = new Mesh(new BoxGeometry(2.0, 1.8, 1.5), bodyMat);
  torso.position.y = 2.5;
  const chestPlate = new Mesh(new BoxGeometry(1.4, 1.0, 0.2), accentMat);
  chestPlate.position.set(0, 2.8, 0.78);
  const core = new Mesh(new SphereGeometry(0.35, 6, 5), glowMat);
  core.position.set(0, 2.5, 0.82);

  const head = new Mesh(new BoxGeometry(0.9, 0.8, 0.85), bodyMat);
  head.position.y = 3.8;
  const brow = new Mesh(new BoxGeometry(0.95, 0.2, 0.4), darkMat);
  brow.position.set(0, 4.2, 0.35);
  const eye1 = new Mesh(new BoxGeometry(0.16, 0.12, 0.12), glowMat);
  eye1.position.set(-0.22, 3.9, 0.43);
  const eye2 = eye1.clone();
  eye2.position.x = 0.22;

  for (const side of [-1, 1]) {
    const shoulder = new Mesh(new BoxGeometry(0.8, 0.6, 0.7), darkMat);
    shoulder.position.set(side * 1.4, 3.2, 0);
    const arm = new Mesh(new BoxGeometry(0.6, 1.8, 0.55), bodyMat);
    arm.position.set(side * 1.4, 1.6, 0);
    const fist = new Mesh(new BoxGeometry(0.75, 0.65, 0.7), accentMat);
    fist.position.set(side * 1.4, 0.5, 0);
    mesh.add(shoulder, arm, fist);
  }

  for (const z of [-0.35, 0.35]) {
    const leg = new Mesh(new BoxGeometry(0.55, 1.1, 0.5), darkMat);
    leg.position.set(0, 0.55, z);
    const foot = new Mesh(new BoxGeometry(0.6, 0.18, 0.65), bodyMat);
    foot.position.set(0, 0.09, z + 0.05);
    mesh.add(leg, foot);
  }

  for (let i = 0; i < 5; i++) {
    const crack = new Mesh(new BoxGeometry(0.08, 0.35 + i * 0.1, 0.08), glowMat);
    const angle = (i / 5) * Math.PI * 0.8 - 0.4;
    crack.position.set(Math.sin(angle) * 0.5, 2.2 + i * 0.18, 0.78);
    crack.rotation.z = angle * 0.5;
    mesh.add(crack);
  }

  mesh.add(pelvis, torso, chestPlate, core, head, brow, eye1, eye2);
}

function buildPharaohBoss(
  mesh: Group,
  bodyMat: MeshLambertMaterial,
  accentMat: MeshLambertMaterial,
  darkMat: MeshLambertMaterial,
  glowMat: MeshLambertMaterial
) {
  const robe = new Mesh(new CylinderGeometry(0.7, 1.2, 2.5, 6), bodyMat);
  robe.position.y = 1.6;
  const chest = new Mesh(new BoxGeometry(1.0, 0.6, 0.6), accentMat);
  chest.position.set(0, 2.8, 0.2);

  const head = new Mesh(new BoxGeometry(0.75, 0.8, 0.7), bodyMat);
  head.position.y = 3.5;
  const crown = new Mesh(new ConeGeometry(0.55, 0.8, 6), accentMat);
  crown.position.y = 4.2;
  const eye1 = new Mesh(new SphereGeometry(0.1, 5, 4), glowMat);
  eye1.position.set(-0.18, 3.55, 0.35);
  const eye2 = eye1.clone();
  eye2.position.x = 0.18;
  const mouth = new Mesh(new BoxGeometry(0.3, 0.06, 0.1), material(0x000000));
  mouth.position.set(0, 3.25, 0.36);

  for (const side of [-1, 1]) {
    const arm = new Mesh(new BoxGeometry(0.25, 1.4, 0.25), darkMat);
    arm.position.set(side * 0.7, 2.0, 0);
    const hand = new Mesh(new SphereGeometry(0.15, 5, 4), material(0xc9a44a));
    hand.position.set(side * 0.7, 1.2, 0);
    mesh.add(arm, hand);
  }

  const staff = new Mesh(new CylinderGeometry(0.04, 0.04, 3.0, 5), material(0xc9a44a));
  staff.position.set(0.9, 2.0, 0);
  const staffGem = new Mesh(new SphereGeometry(0.15, 5, 4), glowMat);
  staffGem.position.set(0.9, 3.5, 0);

  for (let i = 0; i < 3; i++) {
    const bandage = new Mesh(new BoxGeometry(1.0 + i * 0.1, 0.12, 0.7), material(0xd4c4a0));
    bandage.position.set(0, 1.8 + i * 0.5, 0);
    bandage.rotation.y = i * 0.3;
    mesh.add(bandage);
  }

  mesh.add(robe, chest, head, crown, eye1, eye2, mouth, staff, staffGem);
}

function buildDeepLordBoss(
  mesh: Group,
  bodyMat: MeshLambertMaterial,
  accentMat: MeshLambertMaterial,
  darkMat: MeshLambertMaterial,
  glowMat: MeshLambertMaterial
) {
  const body = new Mesh(new SphereGeometry(1.2, 8, 6), bodyMat);
  body.position.y = 2.5;
  const core = new Mesh(new SphereGeometry(0.5, 6, 5), glowMat);
  core.position.set(0, 2.5, 0.8);

  const head = new Mesh(new BoxGeometry(1.0, 0.7, 0.9), bodyMat);
  head.position.y = 4.0;
  const mouth = new Mesh(new BoxGeometry(0.7, 0.3, 0.2), material(0x440000));
  mouth.position.set(0, 3.7, 0.5);
  const eye1 = new Mesh(new SphereGeometry(0.14, 5, 4), glowMat);
  eye1.position.set(-0.25, 4.1, 0.45);
  const eye2 = eye1.clone();
  eye2.position.x = 0.25;

  for (let i = 0; i < 5; i++) {
    const tentacle = new Mesh(new CylinderGeometry(0.12, 0.06, 2.0, 5), darkMat);
    const a = (i / 5) * Math.PI * 2;
    tentacle.position.set(Math.cos(a) * 1.0, 1.5, Math.sin(a) * 1.0);
    tentacle.rotation.z = Math.cos(a) * 0.8;
    tentacle.rotation.x = Math.sin(a) * 0.8;
    mesh.add(tentacle);
  }

  for (let i = 0; i < 4; i++) {
    const spike = new Mesh(new ConeGeometry(0.12, 0.5, 4), accentMat);
    const a = (i / 4) * Math.PI * 2 + 0.3;
    spike.position.set(Math.cos(a) * 1.3, 3.5 + i * 0.15, Math.sin(a) * 1.3);
    spike.rotation.set(i * 0.3, a, 0.5);
    mesh.add(spike);
  }

  const aura = new Mesh(new SphereGeometry(1.8, 8, 6), material(0x1a0a2a));
  aura.position.y = 2.5;
  aura.scale.y = 0.6;

  mesh.add(body, core, head, mouth, eye1, eye2, aura);
}

export function buildBossMinion(
  kind: 'stone_fragment' | 'spirit_wolf' | 'stone_pillar' | 'mummy_guardian' | 'shadow',
  _zone: ZoneId
): Group {
  const mesh = new Group();
  const color = kind === 'shadow' ? 0x1a1a2a : kind === 'spirit_wolf' ? 0x4a3f4f : 0x8a7a6a;
  const mat = material(color);
  const glowMat = material(kind === 'shadow' ? 0x6644aa : 0xff6600);

  if (kind === 'stone_fragment' || kind === 'stone_pillar') {
    const body = new Mesh(new BoxGeometry(0.6, 0.8, 0.6), mat);
    body.position.y = 0.4;
    const glow = new Mesh(new SphereGeometry(0.15, 4, 3), glowMat);
    glow.position.y = 0.9;
    mesh.add(body, glow);
  } else if (kind === 'spirit_wolf') {
    const body = new Mesh(new BoxGeometry(0.8, 0.5, 0.4), mat);
    body.position.y = 0.6;
    const head = new Mesh(new BoxGeometry(0.35, 0.3, 0.3), mat);
    head.position.set(0.5, 0.75, 0);
    const eye = new Mesh(new SphereGeometry(0.05, 4, 3), glowMat);
    eye.position.set(0.6, 0.8, 0.12);
    mesh.add(body, head, eye);
  } else if (kind === 'mummy_guardian') {
    const body = new Mesh(new CapsuleGeometry(0.25, 0.8, 4, 6), mat);
    body.position.y = 0.8;
    const head = new Mesh(new SphereGeometry(0.2, 5, 4), mat);
    head.position.y = 1.5;
    const eye = new Mesh(new SphereGeometry(0.06, 4, 3), glowMat);
    eye.position.set(0, 1.5, 0.18);
    mesh.add(body, head, eye);
  } else {
    const body = new Mesh(new SphereGeometry(0.35, 6, 5), mat);
    body.position.y = 1.0;
    const glow = new Mesh(new SphereGeometry(0.2, 5, 4), glowMat);
    glow.position.y = 1.0;
    glow.position.z = 0.2;
    const trail = new Mesh(new BoxGeometry(0.15, 0.6, 0.15), mat);
    trail.position.y = 0.5;
    mesh.add(body, glow, trail);
  }

  return mesh;
}

export type { ZoneId };
