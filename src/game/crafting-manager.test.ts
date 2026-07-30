import { describe, it, expect, beforeEach } from 'vitest';
import { CraftingManager, type RecipeId } from './crafting-manager';
import type { PlayerProfile } from './profile';

function makeProfile(): PlayerProfile {
  return {
    characters: {} as any,
    selectedCharacter: 'char_1',
    inventory: { trigo: 5, mineral: 3, esencia: 2, madera: 2, hierba: 1 },
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

function makeDailyQuestData() {
  return {
    date: '2024-01-01',
    quests: [],
    states: [],
    loginStreak: 0,
    lastLoginDate: '2024-01-01',
    totalClaimed: 0,
  };
}

describe('CraftingManager', () => {
  let manager: CraftingManager;
  let profile: PlayerProfile;
  let dailyQuestData: ReturnType<typeof makeDailyQuestData>;

  beforeEach(() => {
    manager = new CraftingManager();
    profile = makeProfile();
    dailyQuestData = makeDailyQuestData();
  });

  describe('getRecipe', () => {
    it('returns recipe for known id', () => {
      const recipe = manager.getRecipe('pocion');
      expect(recipe).toBeDefined();
      expect(recipe!.name).toBe('Pocion');
    });

    it('returns undefined for unknown id', () => {
      expect(manager.getRecipe('unknown' as RecipeId)).toBeUndefined();
    });
  });

  describe('canCraft', () => {
    it('returns true when player has enough resources', () => {
      expect(manager.canCraft(profile, 'racion')).toBe(true);
    });

    it('returns false when player lacks resources', () => {
      profile.inventory.trigo = 0;
      expect(manager.canCraft(profile, 'racion')).toBe(false);
    });

    it('returns false for unknown recipe', () => {
      expect(manager.canCraft(profile, 'unknown' as RecipeId)).toBe(false);
    });
  });

  describe('craft', () => {
    it('consumes resources and increments crafted count', () => {
      const result = manager.craft(profile, 'racion', dailyQuestData as any);
      expect(result.success).toBe(true);
      expect(profile.inventory.trigo).toBe(4);
      expect(profile.crafted.racion).toBe(1);
    });

    it('returns error message when resources insufficient', () => {
      profile.inventory.trigo = 0;
      const result = manager.craft(profile, 'racion', dailyQuestData as any);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Necesitas');
    });

    it('returns success null for unknown recipe', () => {
      const result = manager.craft(profile, 'unknown' as RecipeId, dailyQuestData as any);
      expect(result.success).toBe(false);
      expect(result.message).toBeNull();
    });

    it('includes station name in success message', () => {
      const result = manager.craft(profile, 'racion', dailyQuestData as any, 'Horno');
      expect(result.success).toBe(true);
      expect(result.message).toContain('en Horno');
    });
  });
});
