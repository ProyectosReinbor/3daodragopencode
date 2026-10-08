import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  Mesh,
  CylinderGeometry,
  CircleGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  Raycaster,
  Plane,
  Box3,
  ACESFilmicToneMapping,
  type Group,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Character } from './characters';
import { buildNftModel } from './nft';
import type { EyeOffset } from '../../shared/pet-appearance.js';
import { disposePetModel } from './pet-model';

export type StudioMode = 'orbit' | 'eyes' | 'raise' | 'lower';
export interface StudioCallbacks {
  onStart: () => void;
  onCommit: () => void;
  onEye: (eye: 'eyeLeft' | 'eyeRight', offset: EyeOffset) => void;
  onSculpt: (part: 'head' | 'body', point: Vector3) => void;
  onMessage: (message: string) => void;
}

function disposeModel(model: Group) {
  disposePetModel(model);
}

export function mountStudioView(
  container: HTMLElement,
  pet: Character,
  callbacks: StudioCallbacks
) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = ACESFilmicToneMapping;
  container.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Vista 3D editable de tu mascota');
  renderer.domElement.style.touchAction = 'none';
  const scene = new Scene();
  scene.add(new HemisphereLight(0xfff5e5, 0x9a9b8a, 2.7));
  const sun = new DirectionalLight(0xfff5e5, 3.5);
  sun.position.set(-3, 5, 5);
  scene.add(sun);
  const fill = new DirectionalLight(0xd7e5ff, 2);
  fill.position.set(3, 2, -3);
  scene.add(fill);
  const platform = new Mesh(
    new CylinderGeometry(1.4, 1.45, 0.08, 64),
    new MeshStandardMaterial({ color: 0x15333f, roughness: 0.75 })
  );
  platform.position.y = -0.045;
  scene.add(platform);
  const contact = new Mesh(
    new CircleGeometry(0.65, 48),
    new MeshBasicMaterial({ color: 0x020a12, transparent: true, opacity: 0.14, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.005;
  contact.scale.y = 0.7;
  scene.add(contact);
  const camera = new PerspectiveCamera(38, 1, 0.1, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 10;
  controls.maxPolarAngle = Math.PI * 0.7;
  let model = buildNftModel({ ...pet, phoneId: '' });
  scene.add(model);
  let current = pet,
    mode: StudioMode = 'orbit',
    spin = false;
  const raycaster = new Raycaster(),
    pointer = new Vector2();
  let drag: {
    eye?: 'eyeLeft' | 'eyeRight';
    start: Vector3;
    offset: EyeOffset;
    plane: Plane;
  } | null = null;
  let brushing = false,
    lastBrush = 0,
    changed = false;
  const fit = () => {
    model.rotation.y = 0;
    const bounds = new Box3().setFromObject(model),
      size = bounds.getSize(new Vector3()),
      center = bounds.getCenter(new Vector3());
    const distance =
      (Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan((camera.fov * Math.PI) / 360))) *
      1.24;
    controls.target.set(0, center.y - 0.04, 0);
    camera.position.set(0, center.y + 0.15, Math.max(3.5, distance));
    controls.update();
  };
  const resize = () => {
    const width = container.clientWidth || 380,
      height = container.clientHeight || 430;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fit();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const cast = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    model.updateMatrixWorld(true);
    return raycaster.intersectObject(model, true);
  };
  const brush = (event: PointerEvent) => {
    const hit = cast(event).find((hit) => !!hit.object.userData.part);
    if (!hit) return;
    const point = hit.object.worldToLocal(hit.point.clone());
    callbacks.onSculpt(hit.object.userData.part as 'head' | 'body', point);
    changed = true;
  };
  const canvas = renderer.domElement;
  canvas.onpointerdown = (event) => {
    if (mode === 'orbit') return;
    spin = false;
    callbacks.onStart();
    changed = false;
    canvas.setPointerCapture(event.pointerId);
    if (mode === 'eyes') {
      const hits = cast(event);
      const hit = hits.find((hit) => hit.object.parent?.userData.editableEye);
      if (!hit) {
        callbacks.onMessage(
          'Toca un ojo y arrástralo. También puedes usar los controles de posición.'
        );
        return;
      }
      const eye = hit.object.parent!.userData.editableEye as 'eyeLeft' | 'eyeRight';
      const plane = new Plane(new Vector3(0, 0, 1), -hit.point.z);
      const start = new Vector3();
      raycaster.ray.intersectPlane(plane, start);
      drag = { eye, start, offset: { ...current.traits.appearance![eye] }, plane };
      callbacks.onMessage(eye === 'eyeLeft' ? 'Moviendo ojo izquierdo' : 'Moviendo ojo derecho');
    } else {
      brushing = true;
      brush(event);
      lastBrush = performance.now();
    }
  };
  canvas.onpointermove = (event) => {
    if (drag?.eye) {
      cast(event);
      const point = new Vector3();
      if (!raycaster.ray.intersectPlane(drag.plane, point)) return;
      const delta = point.sub(drag.start);
      callbacks.onEye(drag.eye, {
        x: Math.max(-0.5, Math.min(0.5, drag.offset.x + delta.x)),
        y: Math.max(-0.5, Math.min(0.5, drag.offset.y + delta.y)),
        z: drag.offset.z,
      });
      changed = true;
    } else if (brushing && performance.now() - lastBrush > 110) {
      brush(event);
      lastBrush = performance.now();
    }
  };
  const end = () => {
    if (changed) callbacks.onCommit();
    drag = null;
    brushing = false;
    changed = false;
  };
  canvas.onpointerup = canvas.onpointercancel = end;
  let frame = 0;
  const animate = () => {
    if (spin && !drag && !brushing) model.rotation.y += 0.007;
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  };
  animate();
  return {
    update(next: Character, reframe = false) {
      current = next;
      const angle = model.rotation.y;
      scene.remove(model);
      disposeModel(model);
      model = buildNftModel({ ...next, phoneId: '' });
      model.rotation.y = angle;
      scene.add(model);
      if (reframe) fit();
    },
    mode(next: StudioMode) {
      mode = next;
      controls.enabled = next === 'orbit';
      spin = false;
      if (next === 'eyes') fit();
      canvas.style.cursor = next === 'orbit' ? 'grab' : next === 'eyes' ? 'move' : 'crosshair';
    },
    front: fit,
    spin(value: boolean) {
      spin = value;
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      canvas.onpointerdown =
        canvas.onpointermove =
        canvas.onpointerup =
        canvas.onpointercancel =
          null;
      disposeModel(model);
      contact.geometry.dispose();
      (contact.material as MeshBasicMaterial).dispose();
      platform.geometry.dispose();
      (platform.material as MeshStandardMaterial).dispose();
      renderer.dispose();
      container.replaceChildren();
    },
  };
}
