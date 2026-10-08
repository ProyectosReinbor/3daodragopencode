import type { WorldProgress } from './world-items.js';
export const WORLD_MATERIALS: Record<string, string>;
export const WORLD_RECIPES: Record<
  string,
  { name: string; output: string; cost: Record<string, number> }
>;
export const MONSTER_MATERIALS: Record<string, { material: string; amount: number }>;
export function normalizeMaterials(world: WorldProgress): Record<string, number>;
export function craftWorldItem(
  world: WorldProgress,
  id: string
): { item: string; alreadyCrafted: boolean };
