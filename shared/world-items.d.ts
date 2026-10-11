export interface WorldProgress {
  parkKills?: number;
  gathered?: number;
  crafted?: number;
  acceptedQuests?: string[];
  claimedQuests?: string[];
  materials?: Record<string, number>;
  resourceCooldowns?: Record<string, number>;
  coins: number;
  potions: number;
  mana: number;
  items: string[];
  equipped: Record<string, Partial<Record<'weapon' | 'armor' | 'relic', string>>>;
  kills: number;
}
export const WORLD_ITEMS: Record<
  string,
  {
    name: string;
    slot: 'weapon' | 'armor' | 'relic';
    icon: string;
    stat: 'atk' | 'def' | 'ability' | 'hp';
    bonus: number;
  }
>;
export const MONSTER_REWARDS: Record<
  string,
  { health: number; coins: number; xp: number; items: string[] }
>;
export function initialWorldProgress(): WorldProgress;
