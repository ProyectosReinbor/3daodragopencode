import type { PlayerProfile, Inventory, CraftedItems } from './profile';
import type { DailyQuestData } from './daily-quests';
import { trackDailyCraft, saveDailyQuests } from './daily-quests';

export interface Recipe {
  ingredient: keyof Inventory;
  cost: number;
  name: string;
}

export type RecipeId = keyof CraftedItems;

const RECIPES: Record<RecipeId, Recipe> = {
  racion: { ingredient: 'trigo', cost: 1, name: 'Racion' },
  espada: { ingredient: 'mineral', cost: 2, name: 'Espada' },
  pocion: { ingredient: 'esencia', cost: 2, name: 'Pocion' },
  escudo: { ingredient: 'madera', cost: 2, name: 'Escudo' },
  unguento: { ingredient: 'hierba', cost: 2, name: 'Unguento' },
  armadura: { ingredient: 'mineral', cost: 3, name: 'Armadura' },
  amuleto: { ingredient: 'esencia', cost: 2, name: 'Amuleto' },
  pocion_fuerza: { ingredient: 'mineral', cost: 2, name: 'Pocion de Fuerza' },
  pocion_velocidad: { ingredient: 'hierba', cost: 2, name: 'Pocion de Velocidad' },
  antidoto: { ingredient: 'hierba', cost: 1, name: 'Antidoto' },
  gran_pocion: { ingredient: 'esencia', cost: 3, name: 'Gran Pocion' },
  elixir: { ingredient: 'esencia', cost: 4, name: 'Elixir' },
};

export interface CraftResult {
  success: boolean;
  message: string | null;
}

export class CraftingManager {
  getRecipe(id: RecipeId): Recipe | undefined {
    return RECIPES[id];
  }

  getAllRecipes(): Record<RecipeId, Recipe> {
    return RECIPES;
  }

  canCraft(profile: PlayerProfile, recipe: RecipeId): boolean {
    const def = RECIPES[recipe];
    if (!def) return false;
    return profile.inventory[def.ingredient] >= def.cost;
  }

  craft(
    profile: PlayerProfile,
    recipe: RecipeId,
    dailyQuestData: DailyQuestData,
    stationName?: string
  ): CraftResult {
    const def = RECIPES[recipe];
    if (!def) return { success: false, message: null };

    if (profile.inventory[def.ingredient] < def.cost) {
      return {
        success: false,
        message: `Necesitas ${def.cost} de ${def.ingredient} para fabricar ${def.name}${stationName ? ` en ${stationName}` : ''}.`,
      };
    }

    profile.inventory[def.ingredient] -= def.cost;
    profile.crafted[recipe] += 1;
    trackDailyCraft(dailyQuestData, 1);
    saveDailyQuests(dailyQuestData);

    return {
      success: true,
      message: `${def.name} fabricado${stationName ? ` en ${stationName}` : ''}.`,
    };
  }
}
