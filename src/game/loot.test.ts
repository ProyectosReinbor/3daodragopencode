import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LootManager } from './loot';
import type { LootEntry, LootResource } from './profile';

describe('LootManager', () => {
  let lootManager: LootManager;

  beforeEach(() => {
    lootManager = new LootManager();
  });

  describe('rollEnemyLoot', () => {
    it('returns drops for known creature kind', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const drops = lootManager.rollEnemyLoot('wolf');
      expect(drops.length).toBeGreaterThanOrEqual(1);
      expect(drops[0]).toHaveProperty('resource');
      expect(drops[0]).toHaveProperty('amount');
    });

    it('returns empty array for unknown creature kind', () => {
      const drops = lootManager.rollEnemyLoot('unknown');
      expect(drops).toEqual([]);
    });

    it('respects chance thresholds', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const drops = lootManager.rollEnemyLoot('wolf');
      expect(drops).toEqual([]);
    });
  });

  describe('rollBossLoot', () => {
    it('returns drops from boss loot table', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const drops = lootManager.rollBossLoot([{ resource: 'mineral', min: 1, max: 3, chance: 1 }]);
      expect(drops.length).toBe(1);
      expect(drops[0].resource).toBe('mineral');
    });

    it('returns empty when all rolls fail', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const drops = lootManager.rollBossLoot([
        { resource: 'mineral', min: 1, max: 3, chance: 0.5 },
      ]);
      expect(drops).toEqual([]);
    });
  });

  describe('applyDrops', () => {
    it('adds resources to inventory and loot array', () => {
      const inventory: Record<string, number> = { mineral: 5 };
      const loot: LootEntry[] = [];
      const drops: LootEntry[] = [{ resource: 'mineral' as LootResource, amount: 3 }];

      const texts = lootManager.applyDrops(drops, inventory, loot);
      expect(inventory.mineral).toBe(8);
      expect(loot).toHaveLength(1);
      expect(texts).toEqual(['+3 mineral']);
    });
  });
});
