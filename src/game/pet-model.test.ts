import { describe, it, expect } from 'vitest';
import {
  Box3,
  DataTexture,
  Group,
  InstancedMesh,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
  Vector3,
  type WebGLRenderer,
} from 'three';
import {
  DEFAULT_APPEARANCE,
  APPEARANCE_ENUMS,
  PET_PRESETS,
  normalizeAppearance,
} from '../../shared/pet-appearance.js';
import { buildDesignedPet, disposePetModel, PET_IRIS_COLORS, sculptGeometry } from './pet-model';
import { generateNftFromPhone } from './nft';

describe('the AODASE studio model', () => {
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

describe('original toon species and anatomy', () => {
  const requiredAnatomy: Record<string, string[]> = {
    cat: ['muzzle', 'whisker', 'nose'],
    insect: ['insect-shell-seam', 'antenna-tip'],
    alien: ['hand', 'antenna-tip'],
    monster: ['fang', 'spike'],
    dragon: ['dragon-muzzle', 'wing-membrane', 'nostril'],
    spirit: ['spirit-wisp', 'tentacle'],
    dog: ['dog-muzzle', 'nose'],
    rabbit: ['rabbit-teeth', 'whisker'],
    fox: ['fox-muzzle', 'fluffy-tail'],
    bear: ['bear-muzzle', 'earLeft'],
    bird: ['beak', 'bird-toe', 'feather'],
    axolotl: ['axolotl-gills', 'gill-frond', 'axolotl-smile'],
    turtle: ['turtle-shell', 'shell-plate', 'turtle-muzzle'],
    fish: ['fish-lips', 'fish-gill', 'pectoral-fin', 'dorsal-fin', 'tail-fin'],
  };
  it('provides 14 visibly distinct anatomy presets and colored irises', () => {
    expect(PET_PRESETS).toHaveLength(14);
    expect(new Set(PET_PRESETS.map((preset) => preset.id)).size).toBe(14);
    const traits = generateNftFromPhone('species-art-contract').traits;
    for (const preset of PET_PRESETS) {
      const appearance = normalizeAppearance({ ...DEFAULT_APPEARANCE, ...preset.appearance })!;
      const model = buildDesignedPet({
        ...traits,
        primaryColor: parseInt(preset.color.slice(1), 16),
        bodyType: preset.bodyType,
        headShape: 'round',
        limbCount: preset.limbs,
        appearance,
      });
      for (const feature of requiredAnatomy[preset.id])
        expect(model.getObjectByName(feature), `${preset.id}: ${feature}`).toBeDefined();
      const iris = model.getObjectByName('iris') as Mesh;
      expect((iris.material as MeshToonMaterial).color.getHex()).toBe(
        PET_IRIS_COLORS[appearance.eyeColor]
      );
      for (const eye of ['eyeLeft', 'eyeRight']) {
        expect(model.getObjectByName(eye)!.parent!.name).toBe('eyes');
        expect(model.getObjectByName(eye)!.userData.editableEye).toBe(eye);
      }
      expect(model.getObjectByName('mouth')!.parent!.name).toBe('head');
      disposePetModel(model);
    }
  });
  it('keeps limbs and eyes connected and all geometry finite at both editor proportion limits', () => {
    const base = generateNftFromPhone('anatomy-boundary').traits;
    for (const large of [false, true])
      for (const headShape of ['round', 'cube', 'diamond'] as const) {
        const appearance = normalizeAppearance({
          ...DEFAULT_APPEARANCE,
          species: 'axolotl',
          coat: 'fluffy',
          ears: 'rabbit',
          tail: 'fin',
          wings: 'bat',
          limbKind: 'hands',
          headSize: large ? 1.6 : 0.65,
          bodyWidth: large ? 1.65 : 0.6,
          bodyHeight: large ? 1.6 : 0.65,
          headX: large ? 0.35 : -0.35,
          headY: large ? 0.35 : -0.2,
          eyeSize: large ? 1.7 : 0.6,
          eyeSpacing: large ? 1.6 : 0.65,
          eyeHeight: large ? 0.18 : -0.16,
          eyeLeft: { x: -0.5, y: 0.5, z: 0.5 },
          eyeRight: { x: 0.5, y: -0.5, z: -0.5 },
          earSize: 1.6,
          spikes: 8,
          antennaLength: 1.5,
        })!;
        const model = buildDesignedPet({
          ...base,
          bodyType: 'bestia',
          headShape,
          limbCount: 8,
          limbLength: large ? 1.8 : 0.5,
          appearance,
        });
        model.updateMatrixWorld(true);
        const body = new Box3().setFromObject(model.getObjectByName('sculpt-body')!);
        const head = new Box3().setFromObject(model.getObjectByName('sculpt-head')!);
        expect(body.intersectsBox(head)).toBe(true);
        for (const limb of model.children.filter((object) => object.name === 'custom-limb')) {
          expect(body.containsPoint(limb.userData.attachment)).toBe(true);
          expect(body.intersectsBox(new Box3().setFromObject(limb))).toBe(true);
          expect(limb.position.equals(limb.userData.attachment)).toBe(true);
        }
        for (const eye of ['eyeLeft', 'eyeRight'])
          expect(head.intersectsBox(new Box3().setFromObject(model.getObjectByName(eye)!))).toBe(
            true
          );
        model.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          expect(
            Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite)
          ).toBe(true);
          const normal = object.geometry.getAttribute('normal');
          if (normal) expect(Array.from(normal.array).every(Number.isFinite)).toBe(true);
        });
        disposePetModel(model);
      }
  });
  it('moves face, ears and fur with the head while keeping the sculpt surfaces addressable', () => {
    const model = buildDesignedPet({
      ...generateNftFromPhone('rig-art').traits,
      appearance: structuredClone(DEFAULT_APPEARANCE),
    });
    const head = model.getObjectByName('head') as Group;
    const eye = model.getObjectByName('eyeLeft')!;
    const before = eye.getWorldPosition(new Vector3());
    head.rotation.z = 0.18;
    model.updateMatrixWorld(true);
    expect(eye.getWorldPosition(new Vector3()).equals(before)).toBe(false);
    expect(model.getObjectByName('fur')!.parent).toBe(head);
    expect(model.getObjectByName('sculpt-head')!.userData.part).toBe('head');
    expect(model.getObjectByName('sculpt-body')!.userData.part).toBe('body');
    expect(model.getObjectByName('earLeft')!.userData.petPart).toBe('ear-left');
    disposePetModel(model);
  });
});

describe('coat, markings and rendering limits', () => {
  it('keeps old designs valid and validates every new persisted option', () => {
    const legacy = { ...DEFAULT_APPEARANCE } as Record<string, unknown>;
    delete legacy.markings;
    delete legacy.eyeColor;
    expect(normalizeAppearance(legacy)).toMatchObject({ markings: 'none', eyeColor: 'mint' });
    for (const [key, values] of Object.entries(APPEARANCE_ENUMS))
      for (const value of values)
        expect(
          (normalizeAppearance({ [key]: value }) as unknown as Record<string, unknown>)[key]
        ).toBe(value);
    expect(() => normalizeAppearance({ markings: '<script>' })).toThrow();
    expect(() => normalizeAppearance({ eyeColor: 0x123456 })).toThrow();
  });
  it('binds all coat/marking patterns to editable skin and clips the belly to its actual curved surface', () => {
    const base = generateNftFromPhone('surface-art').traits;
    for (const coat of ['marbled', 'calico', 'tuxedo'] as const)
      for (const markings of APPEARANCE_ENUMS.markings) {
        const appearance = normalizeAppearance({ coat, markings })!;
        const model = buildDesignedPet({ ...base, appearance });
        const skin = (model.getObjectByName('sculpt-head') as Mesh).material as MeshToonMaterial;
        const shader = {
          uniforms: {},
          vertexShader: '#include <begin_vertex>',
          fragmentShader: '#include <color_fragment>',
        } as unknown as Parameters<MeshToonMaterial['onBeforeCompile']>[0];
        skin.onBeforeCompile(shader, {} as WebGLRenderer);
        expect(shader.uniforms.petCoat.value).toBe(APPEARANCE_ENUMS.coat.indexOf(coat));
        expect(shader.uniforms.petMarkings.value).toBe(APPEARANCE_ENUMS.markings.indexOf(markings));
        expect(shader.fragmentShader).toContain('diffuseColor.rgb = mix');
        expect(shader.fragmentShader).not.toMatch(
          /\b(?:float|vec[234]|int)\s+(?:patch|sample|input|output|filter|common)\b/
        );
        const body = model.getObjectByName('sculpt-body') as Mesh,
          belly = model.getObjectByName('belly') as Mesh;
        expect(belly.geometry).toBe(body.geometry);
        expect(belly.scale.z / body.scale.z).toBeCloseTo(1.012);
        disposePetModel(model);
      }
  });
  it('uses bounded instance counts, draw counts and triangles for dense hybrid designs', () => {
    const base = generateNftFromPhone('gpu-art').traits;
    for (const preset of PET_PRESETS) {
      const appearance = normalizeAppearance({
        ...DEFAULT_APPEARANCE,
        ...preset.appearance,
        coat: 'fluffy',
        ears: 'rabbit',
        tail: 'fluffy',
        eyes: 'sparkling',
        wings: 'feather',
        markings: 'socks',
        antennaLength: 1.5,
        spikes: 8,
        limbKind: 'hands',
      })!;
      const model = buildDesignedPet({ ...base, appearance, limbCount: 8, limbLength: 1.8 });
      let draws = 0,
        triangles = 0,
        instances = 0;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        draws++;
        const count = object instanceof InstancedMesh ? object.count : 1;
        if (object instanceof InstancedMesh) instances += object.count;
        triangles +=
          ((object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3) *
          count;
      });
      expect(draws, preset.id).toBeLessThanOrEqual(150);
      expect(instances, preset.id).toBe(128);
      expect(triangles, preset.id).toBeLessThanOrEqual(40_000);
      disposePetModel(model);
    }
  });
  it('releases shared geometry, materials, maps and instancing buffers once and is idempotent', () => {
    const model = buildDesignedPet({
      ...generateNftFromPhone('dispose-art').traits,
      appearance: structuredClone(DEFAULT_APPEARANCE),
    });
    const geometryEvents = new Set<unknown>(),
      materialEvents = new Set<unknown>(),
      instanceEvents = new Set<unknown>();
    const geometries = new Set<unknown>(),
      materials = new Set<unknown>();
    let batches = 0,
      texturesDisposed = 0;
    const map = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    map.addEventListener('dispose', () => texturesDisposed++);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      object.geometry.addEventListener('dispose', () => geometryEvents.add(object.geometry));
      if (object instanceof InstancedMesh) {
        batches++;
        object.addEventListener('dispose', (event) => instanceEvents.add(event.target));
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        material.addEventListener('dispose', () => materialEvents.add(material));
        if (material instanceof MeshToonMaterial) material.map = map;
      }
    });
    disposePetModel(model);
    disposePetModel(model);
    expect(geometryEvents.size).toBe(geometries.size);
    expect(materialEvents.size).toBe(materials.size);
    expect(instanceEvents.size).toBe(batches);
    expect(texturesDisposed).toBe(1);
    expect(model.children).toHaveLength(0);
  });
});
