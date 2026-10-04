import { type Element, type NftStats } from './nft';
import type { Character } from './characters';
import { Group, Mesh, SphereGeometry, MeshLambertMaterial, Vector3 } from 'three';

export interface Ability {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  energyCost: number;
  icon: string;
}

export interface ActiveAbility extends Ability {
  lastUsed: number;
  currentCooldown: number;
}

const ELEMENT_ABILITIES: Record<Element, Ability[]> = {
  fuego: [
    {
      id: 'fireball',
      name: 'Bola de Fuego',
      description: 'Dano foco alto al enemigo mas cercano',
      cooldown: 5000,
      energyCost: 25,
      icon: '🔥',
    },
    {
      id: 'flame_burst',
      name: 'Explosion de Llamas',
      description: 'Dano a todos los enemigos cercanos',
      cooldown: 12000,
      energyCost: 40,
      icon: '💥',
    },
  ],
  agua: [
    {
      id: 'heal_wave',
      name: 'Ola Curativa',
      description: 'Restaura vida basado en habilidad',
      cooldown: 8000,
      energyCost: 30,
      icon: '💧',
    },
    {
      id: 'frost_shield',
      name: 'Escudo de Hielo',
      description: 'Reduce dano recibido 50% por 5 segundos',
      cooldown: 15000,
      energyCost: 35,
      icon: '🛡️',
    },
  ],
  tierra: [
    {
      id: 'stone_wall',
      name: 'Muro de Piedra',
      description: 'Bloquea el proximo ataque recibido',
      cooldown: 10000,
      energyCost: 20,
      icon: '🪨',
    },
    {
      id: 'earthquake',
      name: 'Terremoto',
      description: 'Stunea enemigos cercanos por 2 segundos',
      cooldown: 18000,
      energyCost: 45,
      icon: '🌋',
    },
  ],
  aire: [
    {
      id: 'dash',
      name: 'Dash',
      description: 'Movimiento rapido hacia adelante',
      cooldown: 4000,
      energyCost: 15,
      icon: '💨',
    },
    {
      id: 'wind_blade',
      name: 'Hoja de Viento',
      description: 'Ataque a distancia medio',
      cooldown: 6000,
      energyCost: 20,
      icon: '🌀',
    },
  ],
  sombra: [
    {
      id: 'shadow_step',
      name: 'Paso Sombrío',
      description: 'Teletransporta detras del enemigo',
      cooldown: 8000,
      energyCost: 30,
      icon: '👤',
    },
    {
      id: 'dark_pulse',
      name: 'Pulso Oscuro',
      description: 'Dano + robo de vida',
      cooldown: 10000,
      energyCost: 35,
      icon: '🌑',
    },
  ],
  luz: [
    {
      id: 'divine_smite',
      name: 'Castigo Divino',
      description: 'Dano alto a enemigo + curacion menor',
      cooldown: 9000,
      energyCost: 35,
      icon: '✨',
    },
    {
      id: 'holy_barrier',
      name: 'Barrera Sagrada',
      description: 'Escudo que absorbe 50 de dano',
      cooldown: 14000,
      energyCost: 40,
      icon: '🛡️',
    },
  ],
};

export function getElementAbilities(element: Element): Ability[] {
  return ELEMENT_ABILITIES[element] || ELEMENT_ABILITIES.fuego;
}

export function getAllAbilities(): Ability[] { return Object.values(ELEMENT_ABILITIES).flat(); }

export function createActiveAbilities(character: Character): ActiveAbility[] {
  const abilities = character.powers?.length ? getAllAbilities().filter(a => character.powers!.includes(a.id)) : getElementAbilities(character.traits.element);
  return abilities.map((a) => ({
    ...a,
    lastUsed: 0,
    currentCooldown: 0,
  }));
}

export interface AbilityEffect {
  type: 'damage' | 'heal' | 'shield' | 'dash' | 'stun' | 'lifesteal';
  value: number;
  duration?: number;
  targets: 'single' | 'aoe';
}

export function calculateAbilityEffect(
  ability: Ability,
  stats: NftStats,
  level: number
): AbilityEffect {
  const abilityPower = stats.ability * 2 + level * 3;
  const damageBase = stats.atk * 1.5 + abilityPower;

  switch (ability.id) {
    case 'fireball':
      return { type: 'damage', value: Math.round(damageBase * 1.8), targets: 'single' };
    case 'flame_burst':
      return { type: 'damage', value: Math.round(damageBase * 1.2), targets: 'aoe' };
    case 'heal_wave':
      return {
        type: 'heal',
        value: Math.round(30 + stats.ability * 3 + level * 2),
        targets: 'single',
      };
    case 'frost_shield':
      return { type: 'shield', value: 50, duration: 5, targets: 'single' };
    case 'stone_wall':
      return { type: 'shield', value: 100, duration: 0.1, targets: 'single' };
    case 'earthquake':
      return { type: 'stun', value: 2, targets: 'aoe' };
    case 'dash':
      return { type: 'dash', value: 8, targets: 'single' };
    case 'wind_blade':
      return { type: 'damage', value: Math.round(damageBase * 1.4), targets: 'single' };
    case 'shadow_step':
      return { type: 'dash', value: 5, targets: 'single' };
    case 'dark_pulse':
      return { type: 'lifesteal', value: Math.round(damageBase * 1.3), targets: 'single' };
    case 'divine_smite':
      return { type: 'damage', value: Math.round(damageBase * 2), targets: 'single' };
    case 'holy_barrier':
      return {
        type: 'shield',
        value: Math.round(50 + stats.ability * 2),
        duration: 8,
        targets: 'single',
      };
    default:
      return { type: 'damage', value: Math.round(damageBase), targets: 'single' };
  }
}

export function createAbilityProjectile(
  position: Vector3,
  target: Vector3,
  element: Element,
  effect: AbilityEffect
): Group {
  const g = new Group();
  const colorMap: Record<Element, number> = {
    fuego: 0xff4422,
    agua: 0x3399ff,
    tierra: 0x886633,
    aire: 0xaaddff,
    sombra: 0x6633aa,
    luz: 0xffee88,
  };
  const mat = new MeshLambertMaterial({
    color: colorMap[element],
    emissive: colorMap[element],
    emissiveIntensity: 0.6,
  });

  const size = effect.targets === 'aoe' ? 0.4 : 0.25;
  const mesh = new Mesh(new SphereGeometry(size, 6, 4), mat);
  g.add(mesh);
  g.position.copy(position);
  g.position.y = 1;

  return g;
}
