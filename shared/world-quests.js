export const WORLD_QUESTS = {
  supplies: {
    name: 'Provisiones del camino',
    description: 'Recoge 6 materiales del mundo.',
    metric: 'gathered',
    target: 6,
    coins: 35,
    xp: 30,
  },
  patrol: {
    name: 'Patrulla del bosque',
    description: 'Derrota 5 monstruos.',
    metric: 'kills',
    target: 5,
    coins: 50,
    xp: 45,
  },
  artisan: {
    name: 'Tu primera creación',
    description: 'Fabrica una pieza en la forja.',
    metric: 'crafted',
    target: 1,
    coins: 40,
    xp: 35,
  },
};
export const QUEST_POSTS = [
  { id: 'camp', name: 'Guía del campamento', x: -5, z: -5 },
  { id: 'forest', name: 'Guardabosques', x: 200, z: 0 },
  { id: 'catama', name: 'Exploradora de Catama', x: 700, z: -300 },
];
export function questProgress(world, id) {
  const quest = WORLD_QUESTS[id];
  if (!Object.hasOwn(WORLD_QUESTS, id)) return 0;
  return Math.min(quest.target, world[quest.metric] || 0);
}
