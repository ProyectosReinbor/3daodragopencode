// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { APPEARANCE_ENUMS, APPEARANCE_NUMBERS, normalizeAppearance } from './pet-appearance.js';
import { PET_SPECIES_NAMES, petSpeciesName } from './pet-species.js';
import { generatePetTraits } from './pet-genetics.js';

function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}
const channels = (color: number) => [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];
const colorDistance = (left: number, right: number) => Math.hypot(...channels(left).map((value, index) => value - channels(right)[index]));

describe('diverse AODASE egg phenotypes', () => {
  it('has one distinct original family name for every supported species', () => {
    expect(Object.keys(PET_SPECIES_NAMES).sort()).toEqual([...APPEARANCE_ENUMS.species].sort());
    expect(new Set(Object.values(PET_SPECIES_NAMES)).size).toBe(14);
    for (const species of APPEARANCE_ENUMS.species) expect(petSpeciesName(species)).toBe(PET_SPECIES_NAMES[species]);
  });
  it('each theme allows all fourteen species and many independent patterns and palettes', () => {
    const coats = new Set<string>(), markings = new Set<string>(), eyes = new Set<string>(), tails = new Set<string>(), palettes = new Set<string>();
    for (const [index, theme] of (['forest', 'fire', 'water', 'mystery'] as const).entries()) {
      const random = seeded(91234 + index), species = new Set<string>();
      for (let sample = 0; sample < 512; sample++) {
        const traits = generatePetTraits(theme, random), appearance = traits.appearance;
        species.add(appearance.species); coats.add(appearance.coat); markings.add(appearance.markings); eyes.add(appearance.eyeColor); tails.add(appearance.tail);
        palettes.add([traits.primaryColor, traits.secondaryColor, traits.accentColor].join(':'));
        expect(normalizeAppearance(appearance)).toEqual(appearance);
        for (const [key, [min, max]] of Object.entries(APPEARANCE_NUMBERS)) {
          const value = (appearance as unknown as Record<string, number>)[key];
          expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(min); expect(value).toBeLessThanOrEqual(max);
        }
        expect([0, 2, 4, 6, 8]).toContain(traits.limbCount);
        if (appearance.species === 'fish') expect(traits.limbCount).toBe(0);
        if (appearance.species === 'bird') expect(traits.limbCount).toBe(2);
        expect(colorDistance(traits.primaryColor, traits.secondaryColor)).toBeGreaterThan(30);
        expect(colorDistance(traits.primaryColor, traits.accentColor)).toBeGreaterThan(60);
      }
      expect([...species].sort()).toEqual([...APPEARANCE_ENUMS.species].sort());
      expect(species.size).toBe(14);
    }
    for (const value of ['marbled', 'calico', 'tuxedo']) expect(coats.has(value)).toBe(true);
    expect([...markings].sort()).toEqual([...APPEARANCE_ENUMS.markings].sort());
    expect([...eyes].sort()).toEqual([...APPEARANCE_ENUMS.eyeColor].sort());
    for (const value of ['fluffy', 'fin', 'short']) expect(tails.has(value)).toBe(true);
    expect(palettes.size).toBeGreaterThan(2000);
  }, 15000);

  it('keeps attached heads and positions eyes on the head surface even for hybrids', () => {
    const random = seeded(45321);
    let hybridDetails = 0;
    for (let sample = 0; sample < 200; sample++) {
      const traits = generatePetTraits('mystery', random), a = traits.appearance;
      expect(a.headX).toBeGreaterThanOrEqual(-0.05); expect(a.headX).toBeLessThanOrEqual(0.05);
      expect(a.headY).toBeGreaterThanOrEqual(-0.15); expect(a.headY).toBeLessThanOrEqual(-0.05);
      for (const [eye, side] of [[a.eyeLeft, -1], [a.eyeRight, 1]] as const) {
        const nx = (side * 0.19 * a.headSize * a.eyeSpacing + eye.x) / (0.48 * a.headSize);
        const ny = (0.035 + a.eyeHeight + eye.y) / (0.41 * a.headSize);
        const surface = traits.headShape === 'cube' ? 1 : Math.sqrt(1 - nx * nx - ny * ny);
        expect(eye.z).toBeCloseTo(0.38 * a.headSize * (surface - 0.88) - 0.025, 2);
      }
      if (['cat', 'dog', 'rabbit', 'fox', 'bear'].includes(a.species) && a.wings !== 'none') hybridDetails++;
      expect(a.sculpt).toHaveLength(0);
    }
    expect(hybridDetails).toBeGreaterThan(0);
  });

  it('is deterministic with a supplied seed and rejects invalid randomness or themes', () => {
    expect(generatePetTraits('water', seeded(987))).toEqual(generatePetTraits('water', seeded(987)));
    for (const random of [() => 0, () => 0.999999]) {
      const traits = generatePetTraits('mystery', random);
      expect(normalizeAppearance(traits.appearance)).toEqual(traits.appearance);
    }
    expect(() => generatePetTraits('forest', () => 1)).toThrow();
    expect(() => generatePetTraits('forest', () => NaN)).toThrow();
    expect(() => generatePetTraits('invalid' as 'forest')).toThrow();
  });
});
