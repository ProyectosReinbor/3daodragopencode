import type { PlayerProfile } from './profile';
import type { Character, CharacterManager } from './characters';
import { totalStats as characterTotalStats } from './characters';
import type { StatName } from './nft';

export type ConsumableItem =
  | 'racion'
  | 'pocion'
  | 'unguento'
  | 'pocion_fuerza'
  | 'pocion_velocidad'
  | 'antidoto'
  | 'gran_pocion'
  | 'elixir';

export function useConsumable(
  item: ConsumableItem,
  profile: PlayerProfile,
  characters: CharacterManager
): {
  healthDelta: number;
  energyDelta: number;
  buff?: { stat: StatName; amount: number; duration: number; message: string };
} | null {
  if (profile.crafted[item] <= 0) return null;
  profile.crafted[item] -= 1;

  const stats = characterTotalStats(characters.getActive());
  let healthDelta = 0;
  let energyDelta = 0;
  let buff: { stat: StatName; amount: number; duration: number; message: string } | undefined;

  switch (item) {
    case 'racion':
      energyDelta = 50;
      break;
    case 'pocion':
      healthDelta = 45 + stats.ability * 2;
      break;
    case 'unguento':
      healthDelta = 25 + stats.ability;
      break;
    case 'gran_pocion':
      healthDelta = 80 + stats.ability * 3;
      break;
    case 'elixir':
      healthDelta = 100 + stats.ability * 4;
      energyDelta = 50;
      break;
    case 'pocion_fuerza':
      buff = { stat: 'atk', amount: 2, duration: 60000, message: 'Ataque +2 por 60 segundos.' };
      break;
    case 'pocion_velocidad':
      buff = { stat: 'spd', amount: 3, duration: 45000, message: 'Velocidad +3 por 45 segundos.' };
      break;
    case 'antidoto':
      healthDelta = 20;
      break;
  }

  return { healthDelta, energyDelta, buff };
}

export function applyBuffToCharacter(
  character: Character,
  stat: StatName,
  amount: number,
  duration: number,
  activeBuffs: { stat: StatName; amount: number; timerId: ReturnType<typeof setTimeout> }[],
  onExpired: () => void
): ReturnType<typeof setTimeout> {
  const existing = activeBuffs.find((b) => b.stat === stat);
  if (existing) {
    clearTimeout(existing.timerId);
    character.baseStats[stat] -= existing.amount;
    activeBuffs.splice(activeBuffs.indexOf(existing), 1);
  }
  character.baseStats[stat] += amount;
  const timerId = setTimeout(() => {
    character.baseStats[stat] -= amount;
    const idx = activeBuffs.findIndex((b) => b.stat === stat && b.amount === amount);
    if (idx !== -1) activeBuffs.splice(idx, 1);
    onExpired();
  }, duration);
  activeBuffs.push({ stat, amount, timerId });
  return timerId;
}

export function clearBuffsFromCharacter(
  character: Character,
  activeBuffs: { stat: StatName; amount: number; timerId: ReturnType<typeof setTimeout> }[]
) {
  for (const buff of activeBuffs) {
    clearTimeout(buff.timerId);
    character.baseStats[buff.stat] -= buff.amount;
  }
  activeBuffs.length = 0;
}
