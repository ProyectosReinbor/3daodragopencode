import { CITY_WORLD } from './city-world.js';
import { CITY_PARKS } from './city-life.js';
export const ADVENTURE_GUIDE = { x: -5, z: -5, name: 'Ari, guía de la ciudad' };
export const ADVENTURE_REWARD = { coins: 75, xp: 100, potions: 2, mana: 2 };
export function adventureObjective(world, petId) {
  const adventure = world.adventure;
  if (!adventure)
    return {
      stage: -1,
      title: 'Tu primera aventura',
      description: 'Habla con Ari junto al punto inicial para comenzar.',
      current: 0,
      total: 1,
      ready: false,
      destination: ADVENTURE_GUIDE,
      action: 'guide',
    };
  if (adventure.completed)
    return {
      stage: 5,
      title: 'Aventura completada',
      description: 'Tu Hoja del explorador y la ciudad te esperan.',
      current: 1,
      total: 1,
      ready: false,
      destination: null,
      action: 'done',
    };
  const materialTarget = () => {
    const id =
      (world.materials?.mineral || 0) < 4
        ? 'starter-ore'
        : (world.materials?.madera || 0) < 2
          ? 'starter-wood'
          : 'starter-crystal';
    return CITY_WORLD.nodes.find((n) => n.id === id);
  };
  const stage = adventure.stage;
  if (stage === 0) {
    const current = Math.min(6, Math.max(0, (world.gathered || 0) - adventure.baseline.gathered));
    return {
      stage,
      title: 'Reúne tus provisiones',
      description:
        'Recoge 6 materiales. Para tu arma necesitarás 4 minerales y 2 maderas. Extrae mineral con F; la veta reaparece después de 30 segundos.',
      current,
      total: 6,
      ready: current >= 6,
      destination: materialTarget(),
      action: 'gather',
    };
  }
  if (stage === 1) {
    const current = Math.min(3, Math.max(0, (world.parkKills || 0) - adventure.baseline.parkKills));
    const park = CITY_PARKS[0];
    return {
      stage,
      title: 'Protege el parque',
      description:
        'Derrota 3 monstruos de los parques. Ataca con Espacio y usa Q, W, E y R; recupera vida con 1 y maná con 2.',
      current,
      total: 3,
      ready: current >= 3,
      destination: park,
      action: 'fight',
    };
  }
  if (stage === 2) {
    const ready = world.items.includes('explorer_blade');
    const enough = (world.materials?.mineral || 0) >= 4 && (world.materials?.madera || 0) >= 2;
    return {
      stage,
      title: 'Fabrica tu primera arma',
      description:
        'En la forja crea la Hoja del explorador con 4 minerales y 2 maderas. Si ya tienes una, puedes continuar.',
      current: ready ? 1 : 0,
      total: 1,
      ready,
      destination:
        ready || enough ? { ...CITY_WORLD.forge, name: 'Forja del campamento' } : materialTarget(),
      action: 'craft',
    };
  }
  if (stage === 3) {
    const ready = world.equipped[petId]?.weapon === 'explorer_blade';
    return {
      stage,
      title: 'Equipa la Hoja del explorador',
      description: 'Abre Equipo y equipa tu nueva arma para mejorar el ataque de esta mascota.',
      current: ready ? 1 : 0,
      total: 1,
      ready,
      destination: null,
      action: 'equip',
    };
  }
  return {
    stage: 4,
    title: 'Vuelve con Ari',
    description:
      'Regresa al guía para terminar la aventura y recoger tus monedas, XP y consumibles.',
    current: 0,
    total: 1,
    ready: true,
    destination: ADVENTURE_GUIDE,
    action: 'return',
  };
}
export function startAdventure(world, position) {
  if (world.adventure) throw Error('Esta aventura ya comenzó. Continúa tu objetivo actual.');
  requireGuide(position);
  world.adventure = {
    version: 1,
    stage: 0,
    completed: false,
    baseline: { gathered: world.gathered || 0, parkKills: world.parkKills || 0 },
  };
}
function requireGuide(position) {
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.z) ||
    Math.hypot(position.x - ADVENTURE_GUIDE.x, position.z - ADVENTURE_GUIDE.z) > 6
  )
    throw Error('Acércate a Ari para hablar con él.');
}
export function advanceAdventure(world, petId, expectedStage, position) {
  const adventure = world.adventure;
  if (
    !adventure ||
    adventure.completed ||
    !Number.isInteger(expectedStage) ||
    adventure.stage !== expectedStage
  )
    throw Error('Este paso ya cambió. Consulta tu aventura actual.');
  const objective = adventureObjective(world, petId);
  if (!objective.ready) throw Error('Completa el objetivo antes de continuar.');
  if (adventure.stage === 4) {
    requireGuide(position);
    adventure.completed = true;
    adventure.stage = 5;
    return { ...ADVENTURE_REWARD };
  }
  adventure.stage++;
  return null;
}
