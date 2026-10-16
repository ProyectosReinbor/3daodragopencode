import { WORLD_RECIPES } from '../../shared/world-crafting.js';
import type { WorldProgress } from '../../shared/world-items.js';
import type { CityResource, CityPoint } from '../../shared/city-world.js';

export function planRecipe(world: WorldProgress, id: string) {
  if (!Object.hasOwn(WORLD_RECIPES, id)) return null;
  const recipe = WORLD_RECIPES[id];
  const ingredients = Object.entries(recipe.cost).map(([material, required]) => {
    const owned = Math.max(0, world.materials?.[material] || 0);
    return { material, required, owned, missing: Math.max(0, required - owned) };
  });
  const owned = world.items.includes(recipe.output);
  return { recipe, ingredients, owned, ready: !owned && ingredients.every((i) => i.missing === 0) };
}
export function nearestMaterialSource(
  material: string,
  position: CityPoint,
  nodes: CityResource[],
  cooldowns: Record<string, number>,
  now: number
) {
  const candidates = nodes.filter((node) => node.material === material);
  const available = candidates.filter((node) => (cooldowns[node.id] || 0) <= now);
  const pool = available.length ? available : candidates;
  const node = pool.reduce<CityResource | null>(
    (best, candidate) =>
      !best ||
      Math.hypot(candidate.x - position.x, candidate.z - position.z) <
        Math.hypot(best.x - position.x, best.z - position.z)
        ? candidate
        : best,
    null
  );
  return node
    ? { node, waitSeconds: Math.max(0, Math.ceil(((cooldowns[node.id] || 0) - now) / 1000)) }
    : null;
}
