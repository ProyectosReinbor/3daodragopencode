import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  Points,
  Scene,
  SRGBColorSpace,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { createWorldPresentation } from './world-presentation';
import type { ZoneId } from './profile';

function rendererStub() {
  return {
    toneMapping: NoToneMapping,
    toneMappingExposure: 0.9,
    outputColorSpace: LinearSRGBColorSpace,
    getPixelRatio: () => 1.5,
    domElement: { clientWidth: 1280, clientHeight: 720 },
  } as unknown as WebGLRenderer;
}

afterEach(() => vi.unstubAllGlobals());

describe('world presentation ownership', () => {
  it('changes decorative density without rebuilding the world and restores full detail', () => {
    const scene = new Scene();
    const presentation = createWorldPresentation(scene, rendererStub(), 'aldea', true);
    const layer = scene.getObjectByName('world-presentation') as Group;
    const counts = new Map<InstancedMesh, number>();
    const particles: Points[] = [];
    layer.traverse((object) => {
      if (object instanceof InstancedMesh) counts.set(object, object.count);
      if (object instanceof Points) particles.push(object);
    });
    const children = layer.children.length;
    expect(counts.size).toBeGreaterThan(0);
    expect(particles.length).toBeGreaterThan(0);
    presentation.setQuality('low');
    counts.forEach((count, mesh) => expect(mesh.count).toBe(Math.ceil(count * 0.35)));
    particles.forEach((object) => expect(object.visible).toBe(false));
    presentation.setQuality('medium');
    counts.forEach((count, mesh) => expect(mesh.count).toBe(Math.ceil(count * 0.65)));
    presentation.setQuality('high');
    counts.forEach((count, mesh) => expect(mesh.count).toBe(count));
    particles.forEach((object) => expect(object.visible).toBe(true));
    expect(layer.children.length).toBe(children);
    presentation.dispose();
  });
  it('releases its GPU resources and restores renderer/light state without disposing world assets', () => {
    const scene = new Scene();
    scene.fog = new Fog(0x9ebfce, 18, 54);
    const fog = scene.fog;
    const ground = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const worldGeometryDisposed = vi.fn();
    ground.geometry.addEventListener('dispose', worldGeometryDisposed);
    const sunlight = new HemisphereLight(0xffffff, 0x222222, 2.1);
    scene.add(ground, sunlight);
    const renderer = rendererStub();
    const presentation = createWorldPresentation(scene, renderer, 'aldea', false);
    const layer = scene.getObjectByName('world-presentation') as Group;
    const geometries = new Set<unknown>();
    const materials = new Set<unknown>();
    const textures = new Set<unknown>();
    const disposedGeometries = vi.fn();
    const disposedMaterials = vi.fn();
    const disposedTextures = vi.fn();
    const disposedInstances = vi.fn();
    let instanceBatches = 0;
    layer.traverse((object) => {
      if (object instanceof InstancedMesh) {
        instanceBatches++;
        object.addEventListener('dispose', disposedInstances);
      }
      if (!(object instanceof Mesh) && !(object instanceof Points)) return;
      if (!geometries.has(object.geometry)) {
        geometries.add(object.geometry);
        object.geometry.addEventListener('dispose', disposedGeometries);
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!materials.has(material)) {
          materials.add(material);
          material.addEventListener('dispose', disposedMaterials);
        }
        const map = (material as MeshBasicMaterial).map;
        if (map && !textures.has(map)) {
          textures.add(map);
          map.addEventListener('dispose', disposedTextures);
        }
      }
    });
    expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(sunlight.intensity).toBe(0);
    expect(scene.fog).toBe(fog);
    presentation.dispose();
    presentation.dispose();
    expect(scene.children).toEqual([ground, sunlight]);
    expect(disposedGeometries).toHaveBeenCalledTimes(geometries.size);
    expect(disposedMaterials).toHaveBeenCalledTimes(materials.size);
    expect(disposedTextures).toHaveBeenCalledTimes(textures.size);
    expect(disposedInstances).toHaveBeenCalledTimes(instanceBatches);
    expect(worldGeometryDisposed).not.toHaveBeenCalled();
    expect(sunlight.intensity).toBe(2.1);
    expect(renderer.toneMapping).toBe(NoToneMapping);
    expect(renderer.toneMappingExposure).toBe(0.9);
    expect(renderer.outputColorSpace).toBe(LinearSRGBColorSpace);
  });

  it('preserves later renderer and light changes on disposal', () => {
    const scene = new Scene();
    const sunlight = new HemisphereLight(0xffffff, 0x222222, 2.1);
    scene.add(sunlight);
    const renderer = rendererStub();
    const presentation = createWorldPresentation(scene, renderer, 'aldea', false);
    renderer.toneMapping = NoToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.outputColorSpace = LinearSRGBColorSpace;
    sunlight.intensity = 0.6;
    presentation.dispose();
    expect(renderer.toneMapping).toBe(NoToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.4);
    expect(renderer.outputColorSpace).toBe(LinearSRGBColorSpace);
    expect(sunlight.intensity).toBe(0.6);
  });
});

describe('compact world presentation', () => {
  it.each<ZoneId>(['aldea', 'bosque', 'ruinas', 'desierto', 'cueva'])(
    '%s stays within the mobile decoration budget and follows the player',
    (zone) => {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
      const scene = new Scene();
      const presentation = createWorldPresentation(scene, rendererStub(), zone, false);
      const layer = scene.getObjectByName('world-presentation') as Group;
      let decorations = 0;
      layer.traverse((object) => {
        if (object instanceof InstancedMesh) decorations += object.count;
        else if (object instanceof Points) decorations += object.geometry.attributes.position.count;
      });
      expect(decorations).toBeLessThanOrEqual(80);
      expect(layer.userData.quality).toBe('compact');
      const shadow = layer.getObjectByName('player-contact-shadow') as Mesh;
      expect(shadow.visible).toBe(false);
      presentation.update(0.05, 12, new Vector3(4, 0.2, -8));
      expect(shadow.visible).toBe(true);
      expect(shadow.position.toArray()).toEqual([4, 0.03, -8]);
      const before = shadow.position.clone();
      presentation.dispose();
      presentation.update(0.05, 13, new Vector3(10, 0, 10));
      expect(shadow.position.equals(before)).toBe(true);
    }
  );
});
