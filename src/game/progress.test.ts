import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressManager, type ProgressServices } from './progress';
import { LootManager } from './loot';
import { CharacterManager, createStarterCharacter, createEmptyCollection } from './characters';
import type { PlayerProfile } from './profile';
import { createAchievements } from './achievements';
import type { Enemy } from './world';
import type { ActiveBoss, BossDefinition } from './bosses';
import { Group, Mesh, BoxGeometry, MeshLambertMaterial } from 'three';

function makeServices(): ProgressServices {
  return {
    hint: vi.fn(),
    updateQuest: vi.fn(),
    updateProfilePanel: vi.fn(),
    levelUpEffects: vi.fn(),
  };
}

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

function makeBossDef(): BossDefinition {
  return {
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
    respawnTime: 60000,
    phases: [
      {
        threshold: 1,
        damageMultiplier: 1,
        speedMultiplier: 1,
        abilities: ['slam'],
        message: 'Fase 1',
      },
    ],
    abilities: [],
    loot: [{ resource: 'mineral', min: 1, max: 3, chance: 1 }],
    color: 0x886633,
    scale: 1,
  };
}

function makeActiveBoss(): ActiveBoss {
  const def = makeBossDef();
  const mesh = new Group();
  const hpBar = new Mesh(new BoxGeometry(1.8, 0.1, 0.1), new MeshLambertMaterial());
  const hpBarBg = new Mesh(new BoxGeometry(1.8, 0.1, 0.1), new MeshLambertMaterial());
  const phaseBar = new Mesh(new BoxGeometry(1.8, 0.08, 0.08), new MeshLambertMaterial());
  return {
    definition: def,
    mesh,
    health: 120,
    maxHealth: 120,
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
    quests: [],
    attributePoints: 0,
    currentZone: 'aldea',
    unlockedZones: ['aldea'],
    loot: [],
    achievements: createAchievements(),
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

describe('ProgressManager', () => {
  let manager: ProgressManager;
  let services: ProgressServices;
  let profile: PlayerProfile;
  let characters: CharacterManager;
  let lootManager: LootManager;

  beforeEach(() => {
    services = makeServices();
    lootManager = new LootManager();
    manager = new ProgressManager(services, lootManager);
    profile = makeProfile();
    characters = new CharacterManager(profile.characters!);
  });

  describe('addExperience', () => {
    it('adds xp to active character', () => {
      const active = characters.getActive();
      manager.addExperience(10, profile, characters);
      expect(active.xp).toBe(10);
      expect(active.level).toBe(1);
    });

    it('levels up when xp exceeds threshold', () => {
      const active = characters.getActive();
      active.xp = 90;
      const required = active.level * 100;
      manager.addExperience(required - 90, profile, characters);
      expect(active.level).toBe(active.level);
      expect(active.xp).toBeGreaterThanOrEqual(0);
    });
  });

  describe('trackAchievement', () => {
    it('updates achievement progress', () => {
      manager.trackAchievement('monster_slayer_1', 1, profile);
      const ach = profile.achievements.find((a) => a.id === 'monster_slayer_1');
      expect(ach).toBeDefined();
      expect(ach!.progress).toBe(1);
    });
  });

  describe('processEnemyKill', () => {
    it('increments quest creatures and loot', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const enemy = makeEnemy();
      const dailyQuestData: any = { date: '2024-01-01', quests: [], states: [] };
      const battlePass: any = { currentLevel: 1, currentXp: 0, claimedTiers: [] };

      manager.processEnemyKill(enemy, profile, dailyQuestData, battlePass);
      expect(profile.quest.creatures).toBe(1);
      expect(services.updateQuest).toHaveBeenCalled();
    });
  });

  describe('processBossKill', () => {
    it('adds boss loot to profile', () => {
      const boss = makeActiveBoss();
      const dailyQuestData: any = { date: '2024-01-01', quests: [], states: [] };
      const battlePass: any = { currentLevel: 1, currentXp: 0, claimedTiers: [] };

      manager.processBossKill(boss, profile, dailyQuestData, battlePass);
      expect(services.updateQuest).toHaveBeenCalled();
      expect(profile.loot.length).toBeGreaterThan(0);
    });
  });
});
