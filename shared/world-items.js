export const WORLD_ITEMS = {
  fang: { name: 'Colmillo del lobo', slot: 'weapon', icon: '🗡️', stat: 'atk', bonus: 4 },
  hide: { name: 'Armadura de pelaje', slot: 'armor', icon: '🛡️', stat: 'def', bonus: 4 },
  crystal: { name: 'Gema del espíritu', slot: 'relic', icon: '💎', stat: 'ability', bonus: 5 },
  blade: { name: 'Espada del guardián', slot: 'weapon', icon: '⚔️', stat: 'atk', bonus: 6 },
  plate: { name: 'Coraza de gólem', slot: 'armor', icon: '🛡️', stat: 'def', bonus: 7 },
  heart: { name: 'Corazón de piedra', slot: 'relic', icon: '🔮', stat: 'hp', bonus: 6 },
};
export const MONSTER_REWARDS = {
  wolf: { health: 70, coins: 12, xp: 15, items: ['fang', 'hide'] },
  spirit: { health: 85, coins: 18, xp: 20, items: ['crystal'] },
  skeleton: { health: 100, coins: 22, xp: 25, items: ['blade'] },
  golem: { health: 150, coins: 35, xp: 40, items: ['plate', 'heart'] },
};
export function initialWorldProgress() { return { coins: 40, potions: 3, mana: 3, items: [], equipped: {}, kills: 0 }; }
