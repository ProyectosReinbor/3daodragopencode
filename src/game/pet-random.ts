import type { Character } from './characters';
import { getAllAbilities } from './abilities';
import { Color } from 'three';
import { PET_PRESETS, DEFAULT_APPEARANCE, APPEARANCE_ENUMS } from '../../shared/pet-appearance.js';

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
  pet.traits.element = pick(['fuego', 'agua', 'tierra', 'aire', 'sombra', 'luz'] as const);
  const family = pick(PET_PRESETS);
  const species = family.id;
  const appearance = { ...structuredClone(DEFAULT_APPEARANCE), ...family.appearance };
  pet.traits.bodyType = pick(['bestia', 'humanoid', 'golem', 'espectral'] as const);
  pet.traits.headShape = pick(
    species === 'monster'
      ? (['round', 'cube', 'diamond'] as const)
      : (['round', 'round', 'diamond'] as const)
  );
  pet.traits.limbCount = pick([0, 2, 4, 6, 8]);
  pet.traits.limbLength = number(0.5, 1.8, 0.1);
  // Independent saturated hues allow neon, contrasting and unusual palettes.
  const hue = random();
  pet.traits.primaryColor = new Color()
    .setHSL(hue, number(0.65, 1, 0.05), number(0.3, 0.65, 0.05))
    .getHex();
  pet.traits.secondaryColor = new Color()
    .setHSL(random(), number(0.55, 1, 0.05), number(0.35, 0.8, 0.05))
    .getHex();
  pet.traits.accentColor = new Color()
    .setHSL(random(), number(0.7, 1, 0.05), number(0.45, 0.75, 0.05))
    .getHex();
  appearance.mood = pick(['cute', 'cute', 'fierce', 'grumpy', 'odd'] as const);
  appearance.headSize = number(1.05, 1.35, 0.05);
  appearance.bodyWidth = number(0.6, 1.65, 0.05);
  appearance.bodyHeight = number(0.65, 1.6, 0.05);
  appearance.headX = number(-0.05, 0.05, 0.05);
  appearance.headY = number(-0.15, -0.05, 0.05);
  appearance.eyeSize = number(0.85, 1.15, 0.05);
  appearance.eyeSpacing = number(1, 1.15, 0.05);
  appearance.eyeHeight = number(-0.03, 0.03, 0.01);
  appearance.eyeTilt = number(-0.1, 0.1, 0.05);
  appearance.eyes =
    species === 'insect'
      ? pick(['bug', 'round'] as const)
      : species === 'alien'
        ? pick(['slit', 'round'] as const)
        : pick(['round', 'round', 'sleepy'] as const);
  appearance.earSize = number(0.5, 1.6, 0.05);
  appearance.wingSize = number(0.5, 1.7, 0.05);
  appearance.antennaLength =
    species === 'insect' || species === 'alien' ? number(0.4, 1.1, 0.05) : 0;
  appearance.furLength = number(0.04, 0.1, 0.01);
  appearance.roughness = number(0.1, 0.6, 0.05);
  appearance.spikes = species === 'dragon' || species === 'monster' ? number(1, 5, 1) : 0;
  // Mix species details independently, while retaining the protected face anatomy.
  for (const key of ['coat', 'ears', 'wings', 'limbKind', 'tail'] as const) {
    (appearance as unknown as Record<string, unknown>)[key] = pick(APPEARANCE_ENUMS[key]);
  }
  appearance.antennaLength = number(0, 1.5, 0.05);
  appearance.spikes = number(0, 8, 1);
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
  if (!pet.name.trim()) pet.name = `Pet-${Math.floor(random() * 0x100000000).toString(36)}`;
  return pet;
}
