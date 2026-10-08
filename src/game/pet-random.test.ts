import { describe, expect, it } from 'vitest';
import { createStarterCharacter } from './characters';
import { mulberry32 } from './nft';
import { randomizePet } from './pet-random';
import { buildDesignedPet, disposePetModel } from './pet-model';
import { petSpeciesName } from '../../shared/pet-species.js';
import { Box3, Raycaster, Vector3 } from 'three';
import {
  normalizeAppearance,
  APPEARANCE_ENUMS,
  APPEARANCE_NUMBERS,
} from '../../shared/pet-appearance.js';

describe('random Foodie designs', () => {
  it('varies coherent species designs while keeping all designs valid', () => {
    const original = createStarterCharacter();
    const random = mulberry32(17345);
    const designs = Array.from({ length: 250 }, () => randomizePet(original, random));
    expect(new Set(designs.map((pet) => JSON.stringify(pet.traits))).size).toBe(designs.length);
    for (const pet of designs) {
      expect(normalizeAppearance(pet.traits.appearance)).toEqual(pet.traits.appearance);
      expect(new Set(pet.powers).size).toBe(2);
      expect(pet.traits.limbLength).toBeGreaterThanOrEqual(0.5);
      expect(pet.traits.limbLength).toBeLessThanOrEqual(1.8);
      expect([0, 2, 4, 6, 8]).toContain(pet.traits.limbCount);
      const species = pet.traits.appearance!.species;
      expect(pet.traits.limbCount).toBe(
        species === 'fish'
          ? 0
          : species === 'bird' || species === 'spirit'
            ? 2
            : species === 'insect'
              ? 6
              : 4
      );
      expect(pet.traits.appearance!.mood).not.toBe('odd');
      if (species === 'fish') expect(pet.traits.appearance!.tail).toBe('fin');
      for (const color of [
        pet.traits.primaryColor,
        pet.traits.secondaryColor,
        pet.traits.accentColor,
      ]) {
        expect(Number.isInteger(color)).toBe(true);
        expect(color).toBeGreaterThanOrEqual(0);
        expect(color).toBeLessThan(0x1000000);
      }
    }
    for (const [key, values] of Object.entries(APPEARANCE_ENUMS)) {
      const seen = new Set(
        designs.map((p) => (p.traits.appearance as unknown as Record<string, unknown>)[key])
      );
      expect(seen.size).toBeGreaterThan(0);
      for (const value of seen) expect(values).toContain(value);
    }
    for (const key of Object.keys(APPEARANCE_NUMBERS)) {
      const seen = new Set(
        designs.map((p) => (p.traits.appearance as unknown as Record<string, unknown>)[key])
      );
      expect(seen.size).toBeGreaterThan(1);
    }
  });
  it('preserves the chosen name, identity, statistics and welcome reward without mutating the source', () => {
    const original = createStarterCharacter();
    original.name = 'Mi Pet';
    const snapshot = structuredClone(original);
    const pet = randomizePet(original, mulberry32(80));
    expect(original).toEqual(snapshot);
    expect(pet.name).toBe(original.name);
    expect(pet.id).toBe(original.id);
    expect(pet.baseStats).toEqual(original.baseStats);
    expect(pet.upgrades).toEqual(original.upgrades);
    expect(pet.traits.rarity).toBe(original.traits.rarity);
    expect(pet.level).toBe(original.level);
  });
  it('keeps the eyes touching the head and the head connected to the body', () => {
    const random = mulberry32(791);
    for (let i = 0; i < 24; i++) {
      const pet = randomizePet(createStarterCharacter(), random);
      const model = buildDesignedPet(pet.traits);
      model.updateMatrixWorld(true);
      const head = new Box3().setFromObject(model.getObjectByName('sculpt-head')!);
      const body = new Box3().setFromObject(model.getObjectByName('sculpt-body')!);
      expect(head.intersectsBox(body)).toBe(true);
      for (const limb of model.children.filter((object) => object.name === 'custom-limb')) {
        expect(body.containsPoint(limb.userData.attachment)).toBe(true);
        expect(body.intersectsBox(new Box3().setFromObject(limb))).toBe(true);
      }
      for (const eye of ['eyeLeft', 'eyeRight']) {
        const bounds = new Box3().setFromObject(model.getObjectByName(eye)!);
        expect(head.intersectsBox(bounds)).toBe(true);
        const white = model.getObjectByName(eye)!.getObjectByName('eye-white')!;
        const center = white.getWorldPosition(new Vector3());
        const ray = new Raycaster(
          new Vector3(center.x, center.y, head.max.z + 1),
          new Vector3(0, 0, -1)
        );
        const face = ray.intersectObject(model.getObjectByName('sculpt-head')!, false);
        expect(face.length).toBeGreaterThan(0);
        expect(new Box3().setFromObject(white).max.z).toBeGreaterThan(face[0].point.z);
      }
      expect(Math.abs(pet.traits.appearance!.headX)).toBeLessThanOrEqual(0.05);
      expect(
        pet.traits.appearance!.sculpt.every(
          (s) => Math.abs(s.strength) <= (s.part === 'head' ? 0.08 : 0.16)
        )
      ).toBe(true);
      disposePetModel(model);
    }
  });
  it('gives an unnamed pet an editable default name', () => {
    const original = createStarterCharacter();
    original.name = '';
    const pet = randomizePet(original, mulberry32(6));
    expect(pet.name).toBe(petSpeciesName(pet.traits.appearance!.species));
  });
});
