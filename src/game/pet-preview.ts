import {
  Box3,
  Vector3,
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  type Group,
} from 'three';
import type { Character } from './characters';
import { buildNftModel } from './nft';
import { disposePetModel } from './pet-model';
import {
  createPetAnimator,
  type PetCareAction,
  type PetCareState,
  type PetReactionPhase,
} from './pet-animation';

export interface PetPreviewController {
  (): void;
  react?: (action: PetCareAction, phase?: PetReactionPhase) => void;
  setCare?: (care: PetCareState) => void;
  ownsContextCleanup?: boolean;
}

/** Callable cleanup remains compatible with collection/hub callers; habitat can also react and setCare. */
export function mountPetPreview(container: HTMLElement, pet: Character): PetPreviewController {
  let renderer: WebGLRenderer | undefined;
  let model: Group | undefined;
  let animator: ReturnType<typeof createPetAnimator> | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let frame = 0;
  let lastFrame: number | undefined;
  let disposed = false;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = motion?.matches ?? false;
  let visibilityListener: (() => void) | undefined;
  let motionListener: (() => void) | undefined;
  const stop: PetPreviewController = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    if (visibilityListener) document.removeEventListener('visibilitychange', visibilityListener);
    if (motionListener) motion?.removeEventListener?.('change', motionListener);
    animator?.dispose();
    if (model) disposePetModel(model);
    renderer?.dispose();
    renderer?.forceContextLoss();
    container.replaceChildren();
  };
  stop.ownsContextCleanup = true;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.1, 30);
    scene.add(new HemisphereLight(0xfff3dc, 0x736343, 3));
    const sun = new DirectionalLight(0xffffff, 2);
    sun.position.set(5, 6, 4);
    scene.add(sun);
    model = buildNftModel({ ...pet, phoneId: '' });
    scene.add(model);
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    animator = createPetAnimator(model, reduced);
    container.replaceChildren(renderer.domElement);
    function renderFrame(): void {
      if (!disposed && !document.hidden) renderer!.render(scene, camera);
    }
    function tick(now: number): void {
      frame = 0;
      if (disposed || document.hidden) return;
      animator!.step(
        lastFrame === undefined ? 0 : Math.min(0.1, Math.max(0, (now - lastFrame) / 1000))
      );
      lastFrame = now;
      renderFrame();
      if (!reduced || animator!.active) frame = requestAnimationFrame(tick);
    }
    function wake(): void {
      if (disposed || document.hidden) return;
      renderFrame();
      if (!frame && (!reduced || animator!.active)) frame = requestAnimationFrame(tick);
    }
    function resize(): void {
      if (disposed) return;
      const width = container.clientWidth || 280;
      const height = container.clientHeight || 190;
      renderer!.setSize(width, height, false);
      camera.aspect = width / height;
      const distance =
        (Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan((camera.fov * Math.PI) / 360))) *
        1.28;
      camera.position.set(0, center.y + 0.12, Math.max(3.2, distance));
      camera.lookAt(0, center.y, 0);
      camera.updateProjectionMatrix();
      wake();
    }
    stop.react = (action, phase = 'success') => {
      if (!disposed) {
        animator!.react(action, phase);
        wake();
      }
    };
    stop.setCare = (care) => {
      if (!disposed) {
        animator!.setCare(care);
        wake();
      }
    };
    visibilityListener = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = undefined;
      if (!document.hidden) wake();
    };
    motionListener = () => {
      reduced = motion?.matches ?? false;
      animator!.setReducedMotion(reduced);
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = undefined;
      wake();
    };
    document.addEventListener('visibilitychange', visibilityListener);
    motion?.addEventListener?.('change', motionListener);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }
    resize();
    return stop;
  } catch {
    stop();
    container.textContent = '✦';
    return () => {
      container.replaceChildren();
    };
  }
}
