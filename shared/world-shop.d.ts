import type { WorldProgress } from './world-items.js';
export const SHOP_QUANTITIES: readonly number[];
export const WORLD_CONSUMABLES: Record<'potions' | 'mana', { name: string; icon: string; price: number; description: string }>;
export function buyConsumables(world: WorldProgress, item: unknown, quantity?: unknown): void;
