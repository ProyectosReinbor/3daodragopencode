import type { Inventory, CraftedItems } from './profile';

export interface Recipe {
  ingredient: keyof Inventory;
  cost: number;
  name: string;
}

export type RecipeId = keyof CraftedItems;

export const RECIPES: Record<RecipeId, Recipe> = {
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
