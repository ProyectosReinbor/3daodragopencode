import { CITY_ENCOUNTERS } from '../shared/city-world.js';
// Explicit defaults for existing combat fixtures; overrides exercise invalid requests.
export function attackPosition(body) {
  if (body?.action !== 'attack') return body;
  const spawn = body.enemy?.startsWith('city:') ? CITY_ENCOUNTERS[Number(body.enemy.slice(5))] : body.enemy === 'aldea:0' ? {x:3.5,z:-5} : {x:-6,z:-3};
  const position = { x:spawn?.x ?? 0, y:0, z:spawn?.z ?? 0 };
  return { position, enemyPosition:position, ...body };
}
