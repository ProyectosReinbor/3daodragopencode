import { WORLD_ITEMS } from '../../shared/world-items.js';
import { WORLD_MATERIALS } from '../../shared/world-crafting.js';
export interface RewardEntry {
  source: string;
  lines: string[];
  level: number | null;
}
export function rewardEntry(
  action: string,
  reward: Record<string, unknown> | null | undefined,
  previousLevel: number,
  level: number
): RewardEntry | null {
  const labels: Record<string, string> = {
    attack: 'Combate',
    pickup: 'Hallazgo',
    gather: 'Extracción',
    craft: 'Fabricación',
    claim_quest: 'Misión completada',
    adventure_advance: 'Primera aventura',
  };
  if (!Object.hasOwn(labels, action)) return null;
  const lines: string[] = [];
  const amount = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  for (const [key, label] of Object.entries({
    coins: 'monedas',
    xp: 'XP',
    potions: 'pociones',
    mana: 'elixires de maná',
  })) {
    const n = amount(reward?.[key]);
    if (n) lines.push(`+${n} ${label}`);
  }
  const item = reward?.item;
  if (typeof item === 'string' && Object.hasOwn(WORLD_ITEMS, item) && !reward?.alreadyCrafted)
    lines.push(WORLD_ITEMS[item].name);
  const material = reward?.material,
    n = amount(reward?.amount);
  if (typeof material === 'string' && Object.hasOwn(WORLD_MATERIALS, material) && n)
    lines.push(`+${n} ${WORLD_MATERIALS[material]}`);
  const newLevel = Number.isInteger(level) && level > previousLevel ? level : null;
  return lines.length || newLevel ? { source: labels[action], lines, level: newLevel } : null;
}
export function appendReward(entries: RewardEntry[], entry: RewardEntry): RewardEntry[] {
  return [entry, ...entries].slice(0, 20);
}
