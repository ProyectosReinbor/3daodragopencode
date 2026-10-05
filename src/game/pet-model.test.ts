import { describe, it, expect } from 'vitest';
import { SphereGeometry } from 'three';
import {
  DEFAULT_APPEARANCE,
  PET_PRESETS,
  normalizeAppearance,
} from '../../shared/pet-appearance.js';
import { buildDesignedPet, sculptGeometry } from './pet-model';
import { generateNftFromPhone } from './nft';

describe('the Foodie studio model', () => {
  it('raises and dents actual vertices, with finite normals', () => {
    const raised = new SphereGeometry(1, 24, 16),
      dented = raised.clone();
    sculptGeometry(raised, [{ part: 'head', x: 0, y: 1, z: 0, radius: 0.3, strength: 0.2 }]);
    sculptGeometry(dented, [{ part: 'head', x: 0, y: 1, z: 0, radius: 0.3, strength: -0.2 }]);
    expect(raised.getAttribute('position').getY(0)).toBeCloseTo(1.2);
    expect(dented.getAttribute('position').getY(0)).toBeCloseTo(0.8);
    expect(Array.from(raised.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
  });
  it('renders the actual family details and individually placed eyes', () => {
    const base = generateNftFromPhone('pet-studio');
    for (const preset of PET_PRESETS) {
      const appearance = normalizeAppearance({
        ...DEFAULT_APPEARANCE,
        ...preset.appearance,
        eyeLeft: { x: 0.2, y: 0.1, z: 0 },
      })!;
      const model = buildDesignedPet({
        ...base.traits,
        headShape: 'round',
        bodyType: preset.bodyType,
        limbCount: preset.limbs,
        appearance,
      });
      expect(model.children.filter((child) => child.name === 'custom-limb')).toHaveLength(
        preset.limbs
      );
      expect(model.getObjectByName('eyeLeft')!.position.y).toBeGreaterThan(
        model.getObjectByName('eyeRight')!.position.y
      );
      if (appearance.coat === 'fluffy') expect(model.getObjectByName('fur')).toBeDefined();
      if (appearance.wings !== 'none')
        expect(model.children.filter((child) => child.name === 'wing')).toHaveLength(2);
      if (appearance.limbKind === 'hands') expect(model.getObjectByName('hand')).toBeDefined();
    }
  });
  it('validates persisted anatomy and rejects unbounded or invalid sculpture', () => {
    expect(normalizeAppearance({ species: 'alien', eyeSize: 1.7 })!.species).toBe('alien');
    expect(() => normalizeAppearance({ eyeSize: 500 })).toThrow();
    expect(() => normalizeAppearance({ eyeLeft: { x: 0, y: Infinity, z: 0 } })).toThrow();
    expect(() => normalizeAppearance({ coat: 'javascript' })).toThrow();
    expect(() =>
      normalizeAppearance({
        sculpt: Array(49).fill({ part: 'head', x: 0, y: 1, z: 0, radius: 0.3, strength: 0.1 }),
      })
    ).toThrow();
  });
});
