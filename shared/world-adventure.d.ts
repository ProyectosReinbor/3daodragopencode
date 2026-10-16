import type { WorldProgress } from './world-items.js';
export interface AdventureState {
  version: number;
  stage: number;
  completed: boolean;
  baseline: { gathered: number; parkKills: number };
}
export interface AdventureObjective {
  stage: number;
  title: string;
  description: string;
  current: number;
  total: number;
  ready: boolean;
  destination: { x: number; z: number; name: string } | null | undefined;
  action: string;
}
export const ADVENTURE_GUIDE: { x: number; z: number; name: string };
export const ADVENTURE_REWARD: { coins: number; xp: number; potions: number; mana: number };
export function adventureObjective(world: WorldProgress, petId: string): AdventureObjective;
export function startAdventure(world: WorldProgress, position: unknown): void;
export function advanceAdventure(
  world: WorldProgress,
  petId: string,
  expectedStage: unknown,
  position: unknown
): typeof ADVENTURE_REWARD | null;
