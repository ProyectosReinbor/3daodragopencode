import { WORLD_ITEMS } from '../../shared/world-items.js';

export type EquipmentStats = Record<'atk' | 'def' | 'spd' | 'hp' | 'ability', number>;
export type Loadout = Partial<Record<'weapon' | 'armor' | 'relic', string>>;
export function equipmentStats(base: EquipmentStats, equipped: Loadout): EquipmentStats {
  const result = { ...base };
  for (const id of Object.values(equipped)) {
    const item = id && Object.hasOwn(WORLD_ITEMS, id) ? WORLD_ITEMS[id] : null;
    if (item) result[item.stat] += item.bonus;
  }
  return result;
}
export function previewEquipment(base: EquipmentStats, equipped: Loadout, id: string) {
  const item = Object.hasOwn(WORLD_ITEMS, id) ? WORLD_ITEMS[id] : null;
  if (!item) return null;
  const current = equipmentStats(base, equipped);
  const next = equipmentStats(base, { ...equipped, [item.slot]: id });
  const delta = { ...next };
  for (const stat of Object.keys(delta) as (keyof EquipmentStats)[]) delta[stat] -= current[stat];
  return { current, next, delta, replaced: equipped[item.slot] || null };
}
