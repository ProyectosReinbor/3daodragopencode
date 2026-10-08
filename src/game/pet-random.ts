import type { Character } from './characters';
import { getAllAbilities } from './abilities';
import { petSpeciesName } from '../../shared/pet-species.js';
import { generatePetTraits } from '../../shared/pet-genetics.js';

function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
}

/** Randomizes the editable design; dice, welcome rarity and pet identity stay separate. */
export function randomizePet(initial: Character, random: () => number = secureRandom): Character {
  const pet = structuredClone(initial);
  const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
  const number = (min: number, max: number, step: number) =>
    Number(
      (min + Math.floor(random() * (Math.floor((max - min) / step + 1e-8) + 1)) * step).toFixed(4)
    );
  const geneticDesign = generatePetTraits('mystery', random);
  const rarity = pet.traits.rarity;
  pet.traits = { ...pet.traits, ...geneticDesign, rarity };
  const appearance = geneticDesign.appearance;
  // Species anatomy is inherited from the shared genotype. Manual editing remains unrestricted.
  appearance.headX = number(-0.05, 0.05, 0.05);
  appearance.eyeTilt = number(-0.1, 0.1, 0.05);
  const eyeShift = number(-0.02, 0.02, 0.01),
    eyeLift = number(-0.01, 0.01, 0.01);
  for (const [eye, side] of [
    ['eyeLeft', -1],
    ['eyeRight', 1],
  ] as const) {
    const x = side * eyeShift;
    const nx =
      (side * 0.19 * appearance.headSize * appearance.eyeSpacing + x) /
      (0.48 * appearance.headSize);
    const ny = (0.035 + appearance.eyeHeight + eyeLift) / (0.41 * appearance.headSize);
    const surface = pet.traits.headShape === 'cube' ? 1 : Math.sqrt(1 - nx * nx - ny * ny);
    appearance[eye] = {
      x,
      y: eyeLift,
      z: Number((0.38 * appearance.headSize * (surface - 0.88) - 0.025).toFixed(2)),
    };
  }
  appearance.sculpt = Array.from({ length: number(5, 12, 1) }, () => {
    const part = pick(['head', 'body'] as const);
    const cube =
      part === 'head' ? pet.traits.headShape === 'cube' : pet.traits.bodyType === 'golem';
    const y = (random() * 2 - 1) * (part === 'body' ? 0.65 : 1),
      angle = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - y * y);
    const point = {
      x: Math.cos(angle) * radius,
      y,
      z: part === 'head' ? -Math.abs(Math.sin(angle) * radius) : Math.sin(angle) * radius,
    };
    if (cube) {
      const scale = 1 / Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z));
      point.x *= scale;
      point.y *= scale;
      point.z *= scale;
    }
    return {
      part,
      ...point,
      radius: number(0.2, 0.5, 0.01),
      strength: pick([-1, 1]) * number(0.04, part === 'head' ? 0.08 : 0.16, 0.01),
    };
  });
  pet.traits.appearance = appearance;
  const abilities = getAllAbilities().map((ability) => ability.id);
  const first = pick(abilities);
  pet.powers = [first, pick(abilities.filter((id) => id !== first))];
  if (!pet.name.trim()) pet.name = petSpeciesName(appearance.species);
  return pet;
}
