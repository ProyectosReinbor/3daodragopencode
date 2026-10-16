import { WORLD_QUESTS, questProgress } from '../../shared/world-quests.js';
import type { WorldProgress } from '../../shared/world-items.js';

export type QuestStatus = 'available' | 'active' | 'ready' | 'completed';
export function questStatus(world: WorldProgress, id: string): QuestStatus {
  if (world.claimedQuests?.includes(id)) return 'completed';
  if (!world.acceptedQuests?.includes(id)) return 'available';
  return questProgress(world, id) >= WORLD_QUESTS[id].target ? 'ready' : 'active';
}
export interface QuestPlace {
  id: string;
  name: string;
  x: number;
  z: number;
}
/** Navigation is a suggestion, never proof that an objective was completed. */
export function nearestQuestPlace(
  metric: string,
  position: { x: number; z: number },
  nodes: QuestPlace[],
  parks: QuestPlace[],
  forge: QuestPlace
): QuestPlace | null {
  const places =
    metric === 'gathered'
      ? nodes
      : metric === 'kills' || metric === 'parkKills'
        ? parks
        : metric === 'crafted'
          ? [forge]
          : [];
  return places.reduce<QuestPlace | null>(
    (best, place) =>
      !best ||
      Math.hypot(place.x - position.x, place.z - position.z) <
        Math.hypot(best.x - position.x, best.z - position.z)
        ? place
        : best,
    null
  );
}
