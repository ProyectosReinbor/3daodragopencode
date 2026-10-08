export const WORLD_MATERIALS = {
  mineral: 'Mineral',
  madera: 'Madera',
  esencia: 'Esencia',
  cristal: 'Cristal de nieve',
  obsidiana: 'Obsidiana',
};
export const WORLD_RECIPES = {
  hoja: { name: 'Hoja del explorador', output: 'explorer_blade', cost: { mineral: 4, madera: 2 } },
  coraza: {
    name: 'Coraza de obsidiana',
    output: 'obsidian_armor',
    cost: { mineral: 4, obsidiana: 3 },
  },
  gema: { name: 'Gema auroral', output: 'aurora_gem', cost: { cristal: 3, esencia: 3 } },
};
export const MONSTER_MATERIALS = {
  wolf: { material: 'madera', amount: 1 },
  spirit: { material: 'esencia', amount: 1 },
  skeleton: { material: 'mineral', amount: 1 },
  golem: { material: 'obsidiana', amount: 1 },
};
export function normalizeMaterials(world) {
  world.materials ||= {};
  world.resourceCooldowns ||= {};
  return world.materials;
}
export function craftWorldItem(world, recipeId) {
  const recipe = Object.hasOwn(WORLD_RECIPES, recipeId) ? WORLD_RECIPES[recipeId] : null;
  if (!recipe) throw Error('Receta desconocida.');
  const materials = normalizeMaterials(world);
  if (world.items.includes(recipe.output)) return { item: recipe.output, alreadyCrafted: true };
  for (const [id, count] of Object.entries(recipe.cost))
    if (!Number.isInteger(materials[id]) || materials[id] < count)
      throw Error('Te faltan materiales para esta receta.');
  for (const [id, count] of Object.entries(recipe.cost)) materials[id] -= count;
  world.items.push(recipe.output);
  return { item: recipe.output, alreadyCrafted: false };
}
