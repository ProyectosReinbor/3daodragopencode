import type { PlayerProfile } from './profile';
import { RECIPES, type RecipeId } from './recipes';
import type { DailyQuestData } from './daily-quests';
import { trackDailyCraft, saveDailyQuests } from './daily-quests';

export function canCraft(profile: PlayerProfile, recipe: RecipeId): boolean {
  const def = RECIPES[recipe];
  if (!def) return false;
  return profile.inventory[def.ingredient] >= def.cost;
}

export function performCraft(
  profile: PlayerProfile,
  recipe: RecipeId,
  dailyQuestData: DailyQuestData,
  stationName?: string
): string | null {
  const def = RECIPES[recipe];
  if (!def) return null;

  if (profile.inventory[def.ingredient] < def.cost) {
    return `Necesitas ${def.cost} de ${def.ingredient} para fabricar ${def.name}${stationName ? ` en ${stationName}` : ''}.`;
  }

  profile.inventory[def.ingredient] -= def.cost;
  profile.crafted[recipe] += 1;
  trackDailyCraft(dailyQuestData, 1);
  saveDailyQuests(dailyQuestData);

  return `${def.name} fabricado${stationName ? ` en ${stationName}` : ''}.`;
}
