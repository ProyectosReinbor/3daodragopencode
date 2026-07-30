import { type LootEntry, type LootResource } from './profile';

interface LootTableEntry {
  resource: LootResource;
  min: number;
  max: number;
  chance: number;
}

const LOOT_TABLE: Record<string, LootTableEntry[]> = {
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

export class LootManager {
  rollEnemyLoot(creatureKind: string): LootEntry[] {
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

  rollBossLoot(lootTable: LootTableEntry[]): LootEntry[] {
    const drops: LootEntry[] = [];
    for (const entry of lootTable) {
      if (Math.random() < entry.chance) {
        const amount = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
        drops.push({ resource: entry.resource, amount });
      }
    }
    return drops;
  }

  applyDrops(drops: LootEntry[], inventory: Record<string, number>, loot: LootEntry[]): string[] {
    const texts: string[] = [];
    for (const drop of drops) {
      inventory[drop.resource] = (inventory[drop.resource] || 0) + drop.amount;
      loot.push(drop);
      texts.push(`+${drop.amount} ${drop.resource}`);
    }
    return texts;
  }
}
