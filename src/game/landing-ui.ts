import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  Box3,
  Color,
  Vector3,
  type Group,
} from 'three';
import { generateCharacterFromPhone, totalStats, type Character } from './characters';
import { buildNftModel, elementLabel, rarityLabel, statLabel } from './nft';
import { navigation } from './navigation';
import { randomizePet } from './pet-random';
import { mulberry32, phoneHash } from './nft';
import { createPetAnimator } from './pet-animation';
import { petSpeciesName } from '../../shared/pet-species.js';
import { disposePetModel } from './pet-model';

export function initFoodieLanding(onJoin: () => void) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const previews = new Map<
    string,
    {
      renderer: WebGLRenderer;
      scene: Scene;
      camera: PerspectiveCamera;
      model?: Group;
      bounds?: Box3;
      animator?: ReturnType<typeof createPetAnimator>;
      width?: number;
      height?: number;
      fitPending?: boolean;
    }
  >();
  let interval: ReturnType<typeof setInterval> | undefined;
  let frame = 0;
  let sequence = 0;
  let visible = false;
  let lastFrame = 0;

  function show(side: string, character: Character) {
    document.getElementById(`landing-name-${side}`)!.textContent = character.name;
    document.getElementById(`landing-element-${side}`)!.textContent = elementLabel(
      character.traits.element
    );
    document.getElementById(`landing-rarity-${side}`)!.textContent = rarityLabel(
      character.traits.rarity
    );
    const stats = totalStats(character);
    document.getElementById(`landing-stats-${side}`)!.innerHTML = (
      ['atk', 'def', 'spd', 'hp', 'ability'] as const
    )
      .map(
        (key) =>
          `<div class="landing-stat"><span>${statLabel(key)}</span><b>${stats[key]}</b><div class="landing-stat-bar"><div class="landing-stat-fill" style="width:${Math.min(stats[key] * 5, 100)}%"></div></div></div>`
      )
      .join('');
    const container = document.getElementById(`landing-3d-${side}`)!;
    const paper = new Color(character.traits.primaryColor).lerp(new Color(0xffffff), 0.72);
    container.style.setProperty('--pet-paper', paper.getStyle());
    container.setAttribute('aria-label', `Vista 3D de ${character.name}`);
    try {
      let preview = previews.get(side);
      if (!preview) {
        const renderer = new WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        const scene = new Scene();
        const camera = new PerspectiveCamera(35, 1, 0.1, 30);
        camera.position.set(0, 1.5, 3.8);
        camera.lookAt(0, 0.85, 0);
        scene.add(new HemisphereLight(0xfff1dd, 0x745b50, 2.8));
        const light = new DirectionalLight(0xffffff, 2);
        light.position.set(5, 8, 4);
        scene.add(light);
        container.replaceChildren(renderer.domElement);
        preview = { renderer, scene, camera };
        previews.set(side, preview);
      }
      if (preview.model) {
        preview.animator?.dispose();
        preview.scene.remove(preview.model);
        disposePetModel(preview.model);
      }
      // The renderer only needs traits; the legacy phone field has no visual role.
      preview.model = buildNftModel({ ...character, phoneId: '' });
      preview.model.rotation.y = side === 'a' ? 0.12 : -0.12;
      preview.scene.add(preview.model);
      preview.bounds = new Box3().setFromObject(preview.model);
      preview.fitPending = true;
      preview.animator = createPetAnimator(preview.model, reduced.matches);
      render();
    } catch {
      container.textContent = {
        fuego: '🔥',
        agua: '💧',
        tierra: '🌱',
        aire: '☁️',
        sombra: '🌙',
        luz: '☀️',
      }[character.traits.element];
      container.setAttribute('aria-label', `Pet de ${elementLabel(character.traits.element)}`);
    }
  }
  function pair() {
    sequence++;
    for (const side of ['a', 'b']) {
      const seed = `aodase-${side}-${sequence}`;
      const pet = randomizePet(generateCharacterFromPhone(seed), mulberry32(phoneHash(seed)));
      pet.name = petSpeciesName(pet.traits.appearance!.species);
      show(side, pet);
    }
  }
  function render() {
    previews.forEach((preview, side) => {
      const container = document.getElementById(`landing-3d-${side}`)!;
      const width = container.clientWidth || 280;
      const height = container.clientHeight || 220;
      if (preview.width !== width || preview.height !== height) {
        preview.renderer.setSize(width, height, false);
        preview.camera.aspect = width / height;
        preview.camera.updateProjectionMatrix();
        preview.width = width;
        preview.height = height;
        preview.fitPending = true;
      }
      if (preview.bounds && preview.fitPending) {
        const size = preview.bounds.getSize(new Vector3());
        const center = preview.bounds.getCenter(new Vector3());
        const distance =
          (Math.max(size.y, size.x / preview.camera.aspect) /
            (2 * Math.tan((preview.camera.fov * Math.PI) / 360))) *
          1.2;
        preview.camera.position.set(center.x, center.y + 0.1, distance + size.z * 0.55);
        preview.camera.lookAt(center);
        preview.fitPending = false;
      }
      preview.renderer.render(preview.scene, preview.camera);
    });
  }
  function animate(now = performance.now()) {
    if (!visible || document.hidden || reduced.matches) return;
    const delta = lastFrame ? Math.min(0.1, Math.max(0, (now - lastFrame) / 1000)) : 0;
    lastFrame = now;
    previews.forEach((preview) => preview.animator?.step(delta));
    render();
    frame = requestAnimationFrame(animate);
  }
  function stop() {
    clearInterval(interval);
    interval = undefined;
    cancelAnimationFrame(frame);
    lastFrame = 0;
  }
  function sync() {
    stop();
    visible = navigation.getCurrent() === 'landing';
    if (!visible || document.hidden) return;
    if (!sequence) pair();
    previews.forEach((preview) => preview.animator?.setReducedMotion(reduced.matches));
    render();
    if (!reduced.matches) {
      interval = setInterval(pair, 7000);
      animate();
    }
  }
  document.getElementById('landing-join')!.onclick = onJoin;
  document.getElementById('landing-workshop')!.onclick = () => navigation.navigate('onboarding');
  document.getElementById('landing-login')!.onclick = () => navigation.navigate('login');
  document.getElementById('landing-next')!.onclick = pair;
  navigation.onNavigate(sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', () => {
    if (visible) render();
  });
  reduced.addEventListener('change', sync);
  const contact = document.getElementById('foodie-whatsapp') as HTMLAnchorElement;
  const rawPhone =
    import.meta.env.VITE_AODASE_WHATSAPP || import.meta.env.VITE_FOODIE_WHATSAPP || '';
  const phone = String(rawPhone).replace(/[\s+()-]/g, '');
  if (/^\d{8,15}$/.test(phone)) {
    contact.href = `https://wa.me/${phone}?text=${encodeURIComponent('Hola, tengo un negocio local y quiero participar en AODASE PETS en mi ciudad.')}`;
    contact.removeAttribute('aria-disabled');
    document.getElementById('whatsapp-pending')!.hidden = true;
  } else {
    contact.removeAttribute('href');
    contact.setAttribute('aria-disabled', 'true');
  }
  sync();
}
