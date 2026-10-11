import type { WorldProgress } from './world-items.js';
export const WORLD_QUESTS: Record<
  string,
  { name: string; description: string; metric: string; target: number; coins: number; xp: number }
>;
export const QUEST_POSTS: { id: string; name: string; x: number; z: number }[];
export function questProgress(world: WorldProgress, id: string): number;
