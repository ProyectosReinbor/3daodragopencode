import { CITY_ENCOUNTERS } from '../../shared/city-world.js';
import { MONSTER_REWARDS } from '../../shared/world-items.js';
export const MONSTER_GUIDE = {
  wolf: { name: 'Lobo', tip: 'Prepara golpes rápidos. Sal del círculo antes de su embestida.' },
  skeleton: {
    name: 'Guardián esqueleto',
    tip: 'Su preparación es más lenta que la del lobo. Aprovecha la recuperación para atacar.',
  },
  spirit: {
    name: 'Espíritu',
    tip: 'Su golpe cubre un área amplia. Mantén espacio para esquivarlo.',
  },
  golem: {
    name: 'Gólem',
    tip: 'Tiene más vida y el círculo más grande. Su preparación larga permite alejarse.',
  },
};
export function nearestMonster(kind: string, position: { x: number; z: number }) {
  if (!Object.hasOwn(MONSTER_REWARDS, kind) || !Object.hasOwn(MONSTER_GUIDE, kind)) return null;
  const encounter = CITY_ENCOUNTERS.filter((value) => value.kind === kind).reduce<
    (typeof CITY_ENCOUNTERS)[number] | null
  >(
    (best, value) =>
      !best ||
      Math.hypot(value.x - position.x, value.z - position.z) <
        Math.hypot(best.x - position.x, best.z - position.z)
        ? value
        : best,
    null
  );
  return encounter
    ? {
        id: 'monster-' + kind,
        name: MONSTER_GUIDE[kind as keyof typeof MONSTER_GUIDE].name + ' · Zona de encuentro',
        x: encounter.x,
        z: encounter.z,
      }
    : null;
}
