import {
  Box3,
  Vector3,
  InstancedMesh,
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  type Mesh,
} from 'three';
import type { Character } from './characters';
import { buildNftModel } from './nft';

export function mountPetPreview(container: HTMLElement, pet: Character): () => void {
  try {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const width = container.clientWidth || 280;
    const height = container.clientHeight || 190;
    renderer.setSize(width, height, false);
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, width / height, 0.1, 30);
    camera.position.set(0, 1.8, 4.8);
    camera.lookAt(0, 1.2, 0);
    scene.add(new HemisphereLight(0xfff3dc, 0x736343, 3));
    const sun = new DirectionalLight(0xffffff, 2);
    sun.position.set(5, 6, 4);
    scene.add(sun);
    const model = buildNftModel({ ...pet, phoneId: '' });
    scene.add(model);
    const bounds = new Box3().setFromObject(model),
      size = bounds.getSize(new Vector3()),
      center = bounds.getCenter(new Vector3());
    const distance =
      (Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan((camera.fov * Math.PI) / 360))) *
      1.2;
    camera.position.set(0, center.y + 0.2, Math.max(3.5, distance));
    camera.lookAt(0, center.y, 0);
    container.replaceChildren(renderer.domElement);
    let frame = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = () => {
      renderer.render(scene, camera);
      if (!reduced) {
        model.rotation.y += 0.008;
        frame = requestAnimationFrame(animate);
      }
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      model.traverse((object) => {
        const mesh = object as Mesh;
        if (mesh instanceof InstancedMesh) mesh.dispose();
        mesh.geometry?.dispose();
        if (mesh.material)
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) =>
            material.dispose()
          );
      });
      renderer.dispose();
      container.replaceChildren();
    };
  } catch {
    container.textContent = '✦';
    return () => {};
  }
}
