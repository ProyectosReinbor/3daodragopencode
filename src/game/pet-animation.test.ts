import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Group } from 'three';
import { createPetAnimator, PET_REACTION_SECONDS, type PetCareAction } from './pet-animation';
import { mountPetPreview } from './pet-preview';
import { buildDesignedPet, disposePetModel } from './pet-model';
import { DEFAULT_APPEARANCE } from '../../shared/pet-appearance.js';
import { createStarterCharacter } from './characters';

const rendererState = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn(), lose: vi.fn() }));
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      setPixelRatio() {}
      setSize() {}
      render = rendererState.render;
      dispose = rendererState.dispose;
      forceContextLoss = rendererState.lose;
    },
  };
});

function rig(): Group {
  const model = new Group();
  for (const part of [
    'head',
    'body',
    'eye-left',
    'eye-right',
    'ear-left',
    'ear-right',
    'tail',
    'mouth',
    'leg',
  ]) {
    const node = new Group();
    node.name = part;
    node.userData.petPart = part;
    model.add(node);
  }
  return model;
}
describe('living pet poses and care reactions', () => {
  it('breathes, blinks and changes tired/hungry posture without a continuous spin', () => {
    const model = rig(),
      animator = createPetAnimator(model);
    animator.step(1);
    expect(model.getObjectByName('body')!.scale.y).not.toBe(1);
    expect(Math.abs(model.rotation.y)).toBeLessThan(0.08);
    animator.step(3.69);
    expect(model.getObjectByName('eye-left')!.scale.y).toBeLessThan(0.15);
    animator.setCare({ energy: 10, satiety: 10, mood: 10 });
    expect(model.getObjectByName('head')!.rotation.x).toBeGreaterThan(0.1);
    animator.dispose();
    expect(model.getObjectByName('body')!.scale.y).toBe(1);
    expect(model.rotation.y).toBe(0);
  });
  it.each(Object.keys(PET_REACTION_SECONDS) as PetCareAction[])(
    '%s has its own temporary prop and restores idle',
    (action) => {
      const model = rig(),
        animator = createPetAnimator(model);
      animator.react(action, 'intent');
      animator.step(0.4);
      expect(model.getObjectByName(`care-${action}-prop`)!.visible).toBe(false);
      animator.react(action, 'success');
      animator.step(0.8);
      expect(model.getObjectByName(`care-${action}-prop`)!.visible).toBe(true);
      const others = Object.keys(PET_REACTION_SECONDS).filter((value) => value !== action);
      expect(others.every((value) => !model.getObjectByName(`care-${value}-prop`)!.visible)).toBe(
        true
      );
      animator.step(PET_REACTION_SECONDS[action]);
      expect(animator.active).toBe(false);
      expect(model.getObjectByName(`care-${action}-prop`)!.visible).toBe(false);
      animator.dispose();
      expect(model.getObjectByName('pet-care-effects')).toBeUndefined();
    }
  );
  it.each(['fierce', 'grumpy'] as const)(
    'a %s pet responds to needs and successful care without changing its genes',
    (mood) => {
      const pet = createStarterCharacter();
      pet.traits.appearance = { ...structuredClone(DEFAULT_APPEARANCE), mood, eyes: 'sleepy' };
      const original = structuredClone(pet.traits);
      const model = buildDesignedPet(pet.traits);
      const animator = createPetAnimator(model, true);
      const eye = model.getObjectByName('eyeLeft')!;
      const brow = eye.getObjectByName('eyebrow')!;
      expect(brow.visible).toBe(true);
      animator.setCare({ mood: 10, energy: 70, satiety: 10 });
      const sadOpening = eye.scale.y;
      const sadSmile = model.getObjectByName('smile')!.scale.y;
      expect(model.userData.expression).toBe('sad');
      animator.react('feed', 'intent');
      expect(model.userData.expression).toBe('sad');
      animator.react('feed', 'cancel');
      expect(model.userData.expression).toBe('sad');
      animator.react('feed', 'success');
      expect(model.userData.expression).toBe('happy');
      expect(eye.scale.y).toBeGreaterThan(sadOpening);
      expect(model.getObjectByName('smile')!.scale.y * sadSmile).toBeLessThan(0);
      expect(brow.visible).toBe(false);
      animator.setCare({ mood: 90, energy: 70, satiety: 90 });
      animator.step(PET_REACTION_SECONDS.feed);
      expect(model.userData.expression).toBe('happy');
      expect(brow.visible).toBe(false);
      animator.setCare({ mood: 10, energy: 70, satiety: 70 });
      expect(model.userData.expression).toBe('sad');
      animator.react('pet');
      expect(model.userData.expression).toBe('loved');
      animator.react('rest');
      expect(model.userData.expression).toBe('sleeping');
      animator.react('train');
      expect(model.userData.expression).toBe('focused');
      expect(brow.visible).toBe(true);
      expect(pet.traits).toEqual(original);
      animator.dispose();
      expect(brow.visible).toBe(true);
      disposePetModel(model);
    }
  );
  it('cancels intent without success effects and keeps reduced-motion poses static', () => {
    const model = rig(),
      animator = createPetAnimator(model, true);
    animator.react('play', 'intent');
    animator.react('play', 'cancel');
    expect(animator.active).toBe(false);
    expect(model.getObjectByName('care-play-prop')!.visible).toBe(false);
    animator.react('bathe');
    animator.step(0.5);
    const bubble = model.getObjectByName('care-bathe-prop')!.children[0];
    const before = bubble.position.clone();
    animator.step(1);
    expect(bubble.position.equals(before)).toBe(true);
    expect(model.position.y).toBe(0);
    expect(model.rotation.y).toBe(0);
    animator.dispose();
    animator.step(1);
    animator.react('play');
    expect(animator.active).toBe(false);
  });
});

describe('preview visibility and resource lifecycle', () => {
  let hidden: boolean;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let stop: ReturnType<typeof mountPetPreview>;
  beforeEach(() => {
    hidden = false;
    frames = new Map();
    nextFrame = 0;
    rendererState.render.mockClear();
    rendererState.dispose.mockClear();
    rendererState.lose.mockClear();
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames.delete(id);
    });
    stop = mountPetPreview(document.createElement('div'), createStarterCharacter());
  });
  afterEach(() => {
    stop();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('pauses while hidden, resumes once and releases its context/listeners on dispose', () => {
    expect(frames.size).toBe(1);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    const renders = rendererState.render.mock.calls.length;
    stop.react?.('pet', 'success');
    expect(rendererState.render).toHaveBeenCalledTimes(renders);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(1);
    stop();
    stop();
    expect(frames.size).toBe(0);
    expect(rendererState.dispose).toHaveBeenCalledTimes(1);
    expect(rendererState.lose).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
  });
});
