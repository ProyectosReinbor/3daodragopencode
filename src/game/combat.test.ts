import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Group,
  PerspectiveCamera,
  Scene,
  Vector3,
  Mesh,
  BoxGeometry,
  MeshLambertMaterial,
} from 'three';
import { CombatManager, type CombatServices } from './combat';
import { CharacterManager, createStarterCharacter, createEmptyCollection } from './characters';
import { type Enemy } from './world';
import type { ActiveBoss, BossDefinition } from './bosses';
import type { PlayerProfile } from './profile';

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  const hpBar = new Mesh(new BoxGeometry(1.2, 0.08, 0.08), new MeshLambertMaterial());
  const hpBarBg = new Mesh(new BoxGeometry(1.2, 0.08, 0.08), new MeshLambertMaterial());
  const mesh = new Group();
  mesh.position.set(2, 0, 2);
  return {
    mesh,
    health: 30,
    maxHealth: 30,
    alive: true,
    name: 'Lobo',
    damage: 5,
    speed: 2.5,
    spawnPosition: mesh.position.clone(),
    kind: 'wolf',
    zone: 'aldea',
    hpBar,
    hpBarBg,
    ...overrides,
  };
}

function makeBoss(overrides: Partial<ActiveBoss> = {}): ActiveBoss {
  const hpBar = new Mesh(new BoxGeometry(1.8, 0.1, 0.1), new MeshLambertMaterial());
  const hpBarBg = new Mesh(new BoxGeometry(1.8, 0.1, 0.1), new MeshLambertMaterial());
  const phaseBar = new Mesh(new BoxGeometry(1.8, 0.08, 0.08), new MeshLambertMaterial());
  const mesh = new Group();
  mesh.position.set(5, 0, 5);
  const definition: BossDefinition = {
    id: 'guardian_ruinas',
    name: 'Guardian de las Ruinas',
    zone: 'ruinas',
    maxHealth: 200,
    baseDamage: 12,
    baseSpeed: 1.5,
    attackRange: 4,
    aggroRange: 10,
    attackCooldown: 2000,
    xpReward: 80,
    respawnTime: 60000,
    phases: [
      { threshold: 1, damageMultiplier: 1, speedMultiplier: 1, abilities: ['slam'], message: '' },
      {
        threshold: 0.6,
        damageMultiplier: 1.2,
        speedMultiplier: 1.1,
        abilities: ['aoe'],
        message: 'Fase 2',
      },
    ],
    abilities: [
      {
        type: 'slam',
        name: 'Golpe',
        damage: 15,
        cooldown: 5000,
        range: 5,
        description: 'Golpe potente',
        phaseRequired: 1,
      },
    ],
    loot: [{ resource: 'mineral', min: 1, max: 3, chance: 1 }],
    color: 0x886633,
    scale: 1,
  };
  return {
    definition,
    mesh,
    health: 200,
    maxHealth: 200,
    alive: true,
    currentPhase: 1,
    lastAttack: 0,
    lastAbilityUse: new Map(),
    enrageTimer: 0,
    enrageMaxTime: 10000,
    enraged: false,
    summonCount: 0,
    spawnPosition: mesh.position.clone(),
    hpBar,
    hpBarBg,
    phaseBar,
    ...overrides,
  };
}

function makeProfile(): PlayerProfile {
  const collection = createEmptyCollection();
  const starter = createStarterCharacter();
  collection.characters.push(starter);
  collection.selectedId = starter.id;
  return {
    characters: collection,
    selectedCharacter: starter.id,
    inventory: { trigo: 0, mineral: 0, esencia: 0, madera: 0, hierba: 0 },
    crafted: {
      racion: 0,
      espada: 0,
      pocion: 0,
      escudo: 0,
      unguento: 0,
      armadura: 0,
      amuleto: 0,
      pocion_fuerza: 0,
      pocion_velocidad: 0,
      antidoto: 0,
      gran_pocion: 0,
      elixir: 0,
    },
    redeemedRewards: [],
    quest: { resources: 0, creatures: 0, completed: false },
    quests: [{ id: 'bosque_lobo', completed: false }],
    attributePoints: 0,
    currentZone: 'aldea',
    unlockedZones: ['aldea'],
    loot: [],
    achievements: [],
    dailyQuests: {
      date: '2024-01-01',
      quests: [],
      states: [],
      loginStreak: 0,
      lastLoginDate: '2024-01-01',
      totalClaimed: 0,
    },
  };
}

function makeServices(): CombatServices {
  return {
    hint: vi.fn(),
    updateQuest: vi.fn(),
    updateProfilePanel: vi.fn(),
    addExperience: vi.fn(),
    onPlayerDeath: vi.fn(),
    onEnemyKilled: vi.fn(),
    onBossKilled: vi.fn(),
  };
}

describe('CombatManager', () => {
  let combat: CombatManager;
  let player: Group;
  let services: ReturnType<typeof makeServices>;
  let profile: PlayerProfile;
  beforeEach(() => {
    player = new Group();
    services = makeServices();
    profile = makeProfile();

    const characters = new CharacterManager(profile.characters!);
    const audio = {
      playAttack: vi.fn(),
      playDamage: vi.fn(),
      playDeath: vi.fn(),
      playHeal: vi.fn(),
      playLevelUp: vi.fn(),
      playBossWarning: vi.fn(),
      playCollect: vi.fn(),
      playQuestComplete: vi.fn(),
      startZoneAmbient: vi.fn(),
      toggleMute: vi.fn(),
    } as any;
    const visuals = {
      spawnDeathBurst: vi.fn(),
      spawnBossKillBurst: vi.fn(),
      flashDamage: vi.fn(),
      flashHeal: vi.fn(),
      flashLevelUp: vi.fn(),
      flashBossWarning: vi.fn(),
      spawnLevelUpBurst: vi.fn(),
      spawnCollectBurst: vi.fn(),
      update: vi.fn(),
      setWeather: vi.fn(),
    } as any;
    const ui = {
      showDamageNumber: vi.fn(),
      showHealNumber: vi.fn(),
      updateHud: vi.fn(),
      updateTarget: vi.fn(),
    } as any;
    const camera = new PerspectiveCamera();

    combat = new CombatManager(
      player,
      camera,
      new Scene(),
      audio,
      visuals,
      characters,
      ui,
      services
    );
    combat.initAbilities();
    combat.health = 100;
    combat.energy = 100;
  });

  // ─── Damage Tests ───────────────────────────────────

  describe('damage', () => {
    it('attack reduces enemy health', () => {
      const enemy = makeEnemy();
      combat.enemies = [enemy];
      combat.cachedNearestEnemy = enemy;
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.attack(profile);
      expect(enemy.health).toBeLessThan(30);
    });

    it('attack applies minimum damage', () => {
      const enemy = makeEnemy({ health: 1, maxHealth: 1 });
      combat.enemies = [enemy];
      combat.cachedNearestEnemy = enemy;
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.attack(profile);
      expect(enemy.health).toBeLessThanOrEqual(0);
    });

    it('attack cooldown prevents double-attack', () => {
      const enemy = makeEnemy({ health: 999 });
      combat.enemies = [enemy];
      combat.cachedNearestEnemy = enemy;
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      expect(combat.attack(profile)).toBe(true);
      const healthAfterFirst = enemy.health;
      expect(combat.attack(profile)).toBe(false);
      expect(enemy.health).toBe(healthAfterFirst);
    });

    it('attack returns true when no target is near', () => {
      combat.enemies = [makeEnemy({ mesh: new Group() })];
      combat.enemies[0].mesh.position.set(20, 0, 20);
      const result = combat.attack(profile);
      expect(result).toBe(true);
      expect(services.hint).toHaveBeenCalledWith('No hay criaturas cerca.');
    });
  });

  // ─── Combat Cycle Tests ─────────────────────────────

  describe('combat cycles', () => {
    it('targets nearest alive enemy', () => {
      const far = makeEnemy({ mesh: new Group(), spawnPosition: new Vector3() });
      far.mesh.position.set(10, 0, 10);
      const near = makeEnemy({ mesh: new Group(), spawnPosition: new Vector3() });
      near.mesh.position.set(1.5, 0, 1.5);
      combat.enemies = [far, near];
      player.position.set(0, 0, 0);
      combat.update(0.016, profile);
      expect(combat.cachedNearestEnemy).toBe(near);
    });

    it('switches target when current enemy dies', () => {
      const e1 = makeEnemy({
        health: 1,
        maxHealth: 1,
        mesh: new Group(),
        spawnPosition: new Vector3(),
      });
      e1.mesh.position.set(1.5, 0, 1.5);
      const e2 = makeEnemy({ mesh: new Group(), spawnPosition: new Vector3() });
      e2.mesh.position.set(3, 0, 3);
      combat.enemies = [e1, e2];
      player.position.set(0, 0, 0);
      combat.cachedNearestEnemy = e1;
      combat.attack(profile);
      expect(e1.alive).toBe(false);
      combat.update(0.016, profile);
      expect(combat.cachedNearestEnemy).toBe(e2);
    });

    it('enemy within range can be attacked', () => {
      const enemy = makeEnemy();
      combat.enemies = [enemy];
      combat.cachedNearestEnemy = enemy;
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      const result = combat.attack(profile);
      expect(result).toBe(true);
      expect(enemy.health).toBeLessThan(30);
    });

    it('no target returns hint', () => {
      combat.enemies = [];
      combat.cachedNearestEnemy = null;
      player.position.set(0, 0, 0);
      combat.attack(profile);
      expect(services.hint).toHaveBeenCalledWith('No hay criaturas cerca.');
    });
  });

  // ─── Enemy Tests ────────────────────────────────────

  describe('enemies', () => {
    it('enemy chases player when within range', () => {
      const enemy = makeEnemy({ speed: 2 });
      combat.enemies = [enemy];
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(5, 0, 5);
      const posBefore = enemy.mesh.position.clone();
      combat.update(1, profile);
      const distAfter = player.position.distanceTo(enemy.mesh.position);
      expect(distAfter).toBeLessThan(player.position.distanceTo(posBefore));
    });

    it('enemy deals damage to player on contact', () => {
      const enemy = makeEnemy({ damage: 8 });
      combat.enemies = [enemy];
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.update(1, profile);
      expect(combat.health).toBeLessThan(100);
    });

    it('enemy dies and triggers rewards', () => {
      const enemy = makeEnemy({ health: 1, maxHealth: 1 });
      combat.enemies = [enemy];
      combat.cachedNearestEnemy = enemy;
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.attack(profile);
      expect(enemy.alive).toBe(false);
      expect(enemy.mesh.visible).toBe(false);
      expect(services.addExperience).toHaveBeenCalledWith(15);
      expect(services.onEnemyKilled).toHaveBeenCalled();
    });

    it('dead enemy does not attack', () => {
      const enemy = makeEnemy({ alive: false, health: 0 });
      combat.enemies = [enemy];
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      const healthBefore = combat.health;
      combat.update(1, profile);
      expect(combat.health).toBe(healthBefore);
    });
  });

  // ─── Boss Tests ─────────────────────────────────────

  describe('bosses', () => {
    it('player can damage boss with attack', () => {
      const boss = makeBoss();
      combat.activeBoss = boss;
      combat.enemies = [];
      player.position.set(0, 0, 0);
      boss.mesh.position.set(2, 0, 2);
      combat.attack(profile);
      expect(boss.health).toBeLessThan(200);
    });

    it('boss chases player within aggro range', () => {
      const boss = makeBoss();
      combat.activeBoss = boss;
      player.position.set(0, 0, 0);
      boss.mesh.position.set(7, 0, 7);
      const posBefore = boss.mesh.position.clone();
      combat.update(1, profile);
      const distAfter = player.position.distanceTo(boss.mesh.position);
      expect(distAfter).toBeLessThan(player.position.distanceTo(posBefore));
    });

    it('Guardian de las Ruinas boss is handled by CombatManager', () => {
      const boss = makeBoss({
        definition: {
          id: 'guardian_ruinas',
          name: 'Guardian de las Ruinas',
          zone: 'ruinas',
          maxHealth: 200,
          baseDamage: 12,
          baseSpeed: 1.5,
          attackRange: 4,
          aggroRange: 10,
          attackCooldown: 2000,
          xpReward: 80,
          respawnTime: 60000,
          phases: [
            {
              threshold: 1,
              damageMultiplier: 1,
              speedMultiplier: 1,
              abilities: ['slam'],
              message: '',
            },
          ],
          abilities: [
            {
              type: 'slam',
              name: 'Golpe',
              damage: 15,
              cooldown: 5000,
              range: 5,
              description: '',
              phaseRequired: 1,
            },
          ],
          loot: [{ resource: 'mineral', min: 1, max: 3, chance: 1 }],
          color: 0x886633,
          scale: 1,
        },
      });
      combat.activeBoss = boss;
      player.position.set(0, 0, 0);
      boss.mesh.position.set(2, 0, 2);
      combat.attack(profile);
      expect(boss.health).toBeLessThanOrEqual(200);
    });

    it('Golem Ancestral boss is handled by CombatManager', () => {
      const boss = makeBoss({
        definition: {
          id: 'golem_ancestral',
          name: 'Golem Ancestral',
          zone: 'ruinas',
          maxHealth: 300,
          baseDamage: 18,
          baseSpeed: 0.8,
          attackRange: 4.5,
          aggroRange: 12,
          attackCooldown: 3000,
          xpReward: 120,
          respawnTime: 90000,
          phases: [
            {
              threshold: 1,
              damageMultiplier: 1,
              speedMultiplier: 1,
              abilities: ['summon'],
              message: '',
            },
            {
              threshold: 0.5,
              damageMultiplier: 1.3,
              speedMultiplier: 1.2,
              abilities: ['aoe'],
              message: 'Furia',
            },
          ],
          abilities: [
            {
              type: 'summon',
              name: 'Invocacion',
              damage: 0,
              cooldown: 15000,
              range: 0,
              description: '',
              phaseRequired: 1,
            },
            {
              type: 'aoe',
              name: 'Terremoto',
              damage: 20,
              cooldown: 10000,
              range: 6,
              description: '',
              phaseRequired: 2,
            },
          ],
          loot: [{ resource: 'mineral', min: 2, max: 5, chance: 1 }],
          color: 0x554433,
          scale: 1.5,
        },
        health: 300,
        maxHealth: 300,
      });
      combat.activeBoss = boss;
      player.position.set(0, 0, 0);
      boss.mesh.position.set(2, 0, 2);
      combat.attack(profile);
      expect(boss.health).toBeLessThanOrEqual(300);
    });

    it('Senor del Fuego boss is handled by CombatManager', () => {
      const boss = makeBoss({
        definition: {
          id: 'senor_fuego',
          name: 'Senor del Fuego',
          zone: 'desierto',
          maxHealth: 400,
          baseDamage: 22,
          baseSpeed: 1.2,
          attackRange: 3.5,
          aggroRange: 14,
          attackCooldown: 2500,
          xpReward: 150,
          respawnTime: 120000,
          phases: [
            {
              threshold: 1,
              damageMultiplier: 1,
              speedMultiplier: 1,
              abilities: ['charge'],
              message: '',
            },
            {
              threshold: 0.5,
              damageMultiplier: 1.4,
              speedMultiplier: 1.3,
              abilities: ['enrage'],
              message: 'Furia',
            },
          ],
          abilities: [
            {
              type: 'charge',
              name: 'Embestida',
              damage: 25,
              cooldown: 8000,
              range: 8,
              description: '',
              phaseRequired: 1,
            },
            {
              type: 'enrage',
              name: 'Enfurecer',
              damage: 0,
              cooldown: 20000,
              range: 0,
              description: '',
              phaseRequired: 2,
            },
          ],
          loot: [{ resource: 'esencia', min: 2, max: 4, chance: 1 }],
          color: 0xff4422,
          scale: 1.3,
        },
        health: 400,
        maxHealth: 400,
      });
      combat.activeBoss = boss;
      player.position.set(0, 0, 0);
      boss.mesh.position.set(2, 0, 2);
      combat.attack(profile);
      expect(boss.health).toBeLessThanOrEqual(400);
    });

    it('boss warning timer decrements', () => {
      const boss = makeBoss();
      combat.activeBoss = boss;
      combat.update(0.016, profile);
      expect(combat.bossWarning).toBe(0);
    });
  });

  // ─── Ability Tests ──────────────────────────────────

  describe('abilities', () => {
    beforeEach(() => {
      combat.abilities.forEach((a) => {
        a.lastUsed = -999999;
      });
    });

    it('useAbility consumes energy', () => {
      const energyBefore = combat.energy;
      combat.abilities[0].energyCost = 10;
      combat.useAbility(0, profile);
      expect(combat.energy).toBe(energyBefore - 10);
    });

    it('ability cooldown prevents reuse', () => {
      combat.abilities[0].energyCost = 0;
      combat.abilities[0].cooldown = 5000;
      combat.abilities[0].lastUsed = performance.now();
      const result = combat.useAbility(0, profile);
      expect(result).toBeNull();
      expect(services.hint).toHaveBeenCalledWith(expect.stringContaining('enfriamiento'));
    });

    it('insufficient energy blocks ability use', () => {
      combat.energy = 0;
      combat.abilities[0].energyCost = 50;
      const result = combat.useAbility(0, profile);
      expect(result).toBeNull();
      expect(services.hint).toHaveBeenCalledWith(expect.stringContaining('Energia insuficiente'));
    });

    it('damage ability damages nearest enemy', () => {
      const enemy = makeEnemy({ health: 100 });
      combat.enemies = [enemy];
      combat.cachedNearestEnemy = enemy;
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.abilities[0].id = 'fireball';
      combat.abilities[0].energyCost = 0;
      combat.useAbility(0, profile);
      expect(enemy.health).toBeLessThan(100);
    });

    it('shield ability absorbs incoming damage', () => {
      const enemy = makeEnemy({ damage: 20 });
      combat.enemies = [enemy];
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.abilities[0].id = 'frost_shield';
      combat.abilities[0].energyCost = 0;
      combat.useAbility(0, profile);
      combat.update(1, profile);
      expect(combat.health).toBe(100);
    });

    it('stun ability pauses enemy movement', () => {
      const enemy = makeEnemy({ speed: 2.5 });
      combat.enemies = [enemy];
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.abilities[0].id = 'earthquake';
      combat.abilities[0].energyCost = 0;
      combat.useAbility(0, profile);
      expect(enemy.speed).toBe(0);
    });

    it('lifesteal ability damages enemy and heals player', () => {
      const enemy = makeEnemy({ health: 100 });
      combat.enemies = [enemy];
      combat.cachedNearestEnemy = enemy;
      combat.health = 50;
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.abilities[0].id = 'dark_pulse';
      combat.abilities[0].energyCost = 0;
      const healthBefore = combat.health;
      combat.useAbility(0, profile);
      expect(enemy.health).toBeLessThan(100);
      expect(combat.health).toBeGreaterThan(healthBefore);
    });

    it('heal ability restores player health', () => {
      combat.health = 30;
      combat.abilities[0].id = 'heal_wave';
      combat.abilities[0].energyCost = 0;
      combat.useAbility(0, profile);
      expect(combat.health).toBeGreaterThan(30);
    });

    it('dash ability returns direction vector', () => {
      combat.abilities[0].id = 'dash';
      combat.abilities[0].energyCost = 0;
      const result = combat.useAbility(0, profile);
      expect(result).not.toBeNull();
      expect(result!.dashDirection).toBeDefined();
    });

    it('invalid ability index returns null', () => {
      const result = combat.useAbility(999, profile);
      expect(result).toBeNull();
    });

    it('AoE ability damages all nearby enemies', () => {
      const e1 = makeEnemy({ mesh: new Group(), spawnPosition: new Vector3() });
      e1.mesh.position.set(2, 0, 2);
      const e2 = makeEnemy({ mesh: new Group(), spawnPosition: new Vector3() });
      e2.mesh.position.set(3, 0, 3);
      combat.enemies = [e1, e2];
      player.position.set(0, 0, 0);
      combat.abilities[0].id = 'flame_burst';
      combat.abilities[0].energyCost = 0;
      combat.useAbility(0, profile);
      expect(e1.health).toBeLessThan(30);
      expect(e2.health).toBeLessThan(30);
    });
  });

  // ─── State Tests ───────────────────────────────────

  describe('states', () => {
    it('player blocked by full energy', () => {
      combat.abilities[0].lastUsed = -999999;
      combat.abilities[0].energyCost = 200;
      const result = combat.useAbility(0, profile);
      expect(result).toBeNull();
      expect(services.hint).toHaveBeenCalledWith(expect.stringContaining('Energia insuficiente'));
    });

    it('attack returns true even with no target', () => {
      combat.enemies = [];
      const result = combat.attack(profile);
      expect(result).toBe(true);
    });

    it('respawn restores health and energy', () => {
      combat.health = 0;
      const enemy = makeEnemy({ damage: 999 });
      combat.enemies = [enemy];
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.update(1, profile);
      expect(combat.health).toBeGreaterThan(0);
      expect(services.onPlayerDeath).toHaveBeenCalled();
    });

    it('session kills increment on enemy kill', () => {
      const enemy = makeEnemy({
        health: 1,
        maxHealth: 1,
        mesh: new Group(),
        spawnPosition: new Vector3(),
      });
      enemy.mesh.position.set(1, 0, 1);
      combat.enemies = [enemy];
      combat.cachedNearestEnemy = enemy;
      player.position.set(0, 0, 0);
      const killsBefore = combat.sessionKills;
      combat.attack(profile);
      expect(combat.sessionKills).toBe(killsBefore + 1);
    });

    it('onEnemyKilled called with enemy and profile on kill', () => {
      const enemy = makeEnemy({ health: 1, maxHealth: 1 });
      combat.enemies = [enemy];
      combat.cachedNearestEnemy = enemy;
      player.position.set(0, 0, 0);
      enemy.mesh.position.set(1, 0, 1);
      combat.attack(profile);
      expect(services.onEnemyKilled).toHaveBeenCalledWith(enemy, profile);
    });
  });

  // ─── Edge Cases ────────────────────────────────────

  describe('edge cases', () => {
    it('boss kill increments session boss kills', () => {
      const boss = makeBoss({ health: 1, maxHealth: 1 });
      combat.activeBoss = boss;
      player.position.set(0, 0, 0);
      boss.mesh.position.set(2, 0, 2);
      const before = combat.sessionBossKills;
      combat.attack(profile);
      expect(combat.sessionBossKills).toBe(before + 1);
    });

    it('boss phases progress when damaged', () => {
      const boss = makeBoss({ health: 200, maxHealth: 200 });
      combat.activeBoss = boss;
      player.position.set(0, 0, 0);
      boss.mesh.position.set(2, 0, 2);
      boss.health = 60;
      combat.attack(profile);
      expect(boss.currentPhase).toBeGreaterThanOrEqual(1);
    });

    it('cachedNearestEnemy stays null when no enemies', () => {
      combat.enemies = [];
      combat.update(0.016, profile);
      expect(combat.cachedNearestEnemy).toBeNull();
    });

    it('no crash when attacking without enemies', () => {
      combat.enemies = [];
      combat.activeBoss = null;
      const result = combat.attack(profile);
      expect(result).toBe(true);
    });

    it('player can attack boss directly', () => {
      const boss = makeBoss();
      combat.activeBoss = boss;
      combat.enemies = [makeEnemy({ mesh: new Group() })];
      combat.enemies[0].mesh.position.set(10, 0, 10);
      player.position.set(0, 0, 0);
      boss.mesh.position.set(2, 0, 2);
      combat.attack(profile);
      expect(boss.health).toBeLessThan(200);
    });
  });
});
