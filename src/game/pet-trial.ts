import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  SphereGeometry,
  MeshLambertMaterial,
  TorusGeometry,
  Vector3,
  type Material,
} from 'three';
import type { Character } from './characters';
import { totalStats } from './characters';
import { buildNftModel } from './nft';
import { createWorld } from './world';
import { zoneConfig } from './zones';
import { getAllAbilities, calculateAbilityEffect } from './abilities';

/** A reversible visit to the existing world, independent of account progress. */
export function mountPetTrial(container: HTMLElement, pet: Character): () => void {
  container.innerHTML =
    '<div class="trial-viewport"></div><p class="trial-message" role="status">Tu Pet está listo para explorar.</p><div class="trial-controls"><button data-move="up" aria-label="Caminar adelante">↑</button><button data-move="left" aria-label="Caminar a la izquierda">←</button><button data-move="down" aria-label="Caminar atrás">↓</button><button data-move="right" aria-label="Caminar a la derecha">→</button></div><div class="trial-powers"></div>';
  const viewport = container.querySelector<HTMLElement>('.trial-viewport')!;
  const message = container.querySelector<HTMLElement>('.trial-message')!;
  const scene = new Scene();
  const camera = new PerspectiveCamera(55, 1, 0.1, 100);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true });
  } catch {
    message.textContent = 'No se pudo abrir el campo 3D en este dispositivo.';
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  viewport.append(renderer.domElement);
  const world = createWorld(scene, 'aldea');
  const model = buildNftModel({ ...pet, phoneId: '' });
  const start = zoneConfig('aldea').playerStart;
  model.position.set(start.x, 0, start.z);
  scene.add(model);
  const keys = new Set<string>();
  const events = new AbortController();
  const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'];
  window.addEventListener(
    'keydown',
    (event) => {
      const key = event.key.toLowerCase();
      if (movementKeys.includes(key)) {
        event.preventDefault();
        keys.add(key);
      }
    },
    { signal: events.signal }
  );
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()), {
    signal: events.signal,
  });
  window.addEventListener('blur', () => keys.clear(), { signal: events.signal });
  const directionKeys: Record<string, string> = { up: 'w', down: 's', left: 'a', right: 'd' };
  container.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
    const key = directionKeys[button.dataset.move!];
    button.onpointerdown = (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      keys.add(key);
    };
    button.onpointerup = button.onpointercancel = () => {
      keys.delete(key);
    };
  });
  const effects: { mesh: Mesh; age: number; projectile: boolean; direction: Vector3 }[] = [];
  getAllAbilities()
    .filter((ability) => pet.powers?.includes(ability.id))
    .forEach((ability) => {
      const button = document.createElement('button');
      button.className = 'foodie-text-button';
      button.textContent = `${ability.icon} ${ability.name}`;
      button.onclick = () => {
        const effect = calculateAbilityEffect(ability, totalStats(pet), pet.level);
        const projectile = ['damage', 'lifesteal', 'stun'].includes(effect.type);
        const mesh = new Mesh(
          projectile ? new SphereGeometry(0.25, 10, 8) : new TorusGeometry(0.8, 0.08, 8, 24),
          new MeshLambertMaterial({ color: projectile ? 0xff8855 : 0x77ccd6 })
        );
        mesh.position.copy(model.position);
        mesh.position.y = 1;
        if (!projectile) mesh.rotation.x = Math.PI / 2;
        const direction = new Vector3(Math.sin(model.rotation.y), 0, Math.cos(model.rotation.y));
        if (effect.type === 'dash') model.position.addScaledVector(direction, 3);
        scene.add(mesh);
        effects.push({ mesh, age: 0, projectile, direction });
        message.textContent = `${ability.name} · ${Math.round(effect.value)} puntos de ${effect.type === 'heal' ? 'curación' : effect.type === 'shield' ? 'protección' : 'poder'}`;
      };
      container.querySelector('.trial-powers')!.append(button);
    });
  const resize = () => {
    const width = viewport.clientWidth || 320,
      height = viewport.clientHeight || 350;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resize();
  let frame = 0,
    previous = performance.now(),
    elapsed = 0;
  const loop = (now: number) => {
    const delta = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    elapsed += delta;
    const x =
      Number(keys.has('d') || keys.has('arrowright')) -
      Number(keys.has('a') || keys.has('arrowleft'));
    const z =
      Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    if (x || z) {
      const movement = new Vector3(x, 0, z).normalize();
      model.position.addScaledVector(movement, delta * (3.5 + totalStats(pet).spd * 0.1));
      model.rotation.y = Math.atan2(x, z);
      model.position.y = Math.sin(elapsed * 10) * 0.05;
    } else model.position.y = 0;
    model.position.x = Math.max(-35, Math.min(35, model.position.x));
    model.position.z = Math.max(-35, Math.min(35, model.position.z));
    camera.position.set(model.position.x, 7, model.position.z + 9);
    camera.lookAt(model.position.x, 1, model.position.z);
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      effect.age += delta;
      if (effect.projectile) {
        effect.mesh.position.addScaledVector(effect.direction, delta * 10);
        const target = world.enemies.find(
          (enemy) => enemy.alive && enemy.mesh.position.distanceTo(effect.mesh.position) < 1.7
        );
        if (target) {
          target.mesh.scale.setScalar(0.85);
          effect.age = 2;
          message.textContent = '¡Tu poder alcanzó al monstruo de práctica!';
        }
      } else effect.mesh.scale.setScalar(1 + effect.age);
      if (effect.age > 1.4) {
        scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        (effect.mesh.material as Material).dispose();
        effects.splice(i, 1);
      }
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    events.abort();
    keys.clear();
    scene.traverse((object) => {
      const mesh = object as Mesh;
      mesh.geometry?.dispose();
      if (mesh.material)
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) =>
          material.dispose()
        );
    });
    renderer.dispose();
    container.replaceChildren();
  };
}
