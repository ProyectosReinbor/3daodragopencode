export const SHOP_QUANTITIES = [1, 3, 5];
export const WORLD_CONSUMABLES = {
  potions: { name: 'Poción de vida', icon: '❤️', price: 15, description: 'Restaura 60% de tu vida máxima' },
  mana: { name: 'Elixir de maná', icon: '🧪', price: 12, description: 'Restaura 60 de maná' },
};

export function buyConsumables(world, item, quantity = 1) {
  if (typeof item !== 'string' || !Object.hasOwn(WORLD_CONSUMABLES, item)) throw new Error('Consumible desconocido.');
  if (!SHOP_QUANTITIES.includes(quantity)) throw new Error('Elige un paquete de 1, 3 o 5 unidades.');
  const total = WORLD_CONSUMABLES[item].price * quantity;
  if (!Number.isFinite(world.coins) || world.coins < total) throw new Error('No tienes suficientes monedas.');
  world.coins -= total;
  world[item] += quantity;
}
