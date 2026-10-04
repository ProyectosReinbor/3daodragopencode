import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  type Group,
  type Mesh,
} from 'three';
import { generateCharacterFromPhone, totalStats, type Character } from './characters';
import { buildNftModel, elementLabel, rarityLabel, statLabel } from './nft';
import { navigation } from './navigation';

function disposeModel(model: Group) {
  model.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

export function initFoodieLanding(onJoin: () => void) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const previews = new Map<
    string,
    { renderer: WebGLRenderer; scene: Scene; camera: PerspectiveCamera; model?: Group }
  >();
  let interval: ReturnType<typeof setInterval> | undefined;
  let frame = 0;
  let sequence = 0;
  let visible = false;

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
        preview.scene.remove(preview.model);
        disposeModel(preview.model);
      }
      // The renderer only needs traits; the legacy phone field has no visual role.
      preview.model = buildNftModel({ ...character, phoneId: '' });
      preview.scene.add(preview.model);
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
    show('a', generateCharacterFromPhone(`foodie-a-${sequence}`));
    show('b', generateCharacterFromPhone(`foodie-b-${sequence}`));
  }
  function render() {
    previews.forEach((preview, side) => {
      const container = document.getElementById(`landing-3d-${side}`)!;
      const width = container.clientWidth || 280;
      const height = container.clientHeight || 220;
      preview.renderer.setSize(width, height, false);
      preview.camera.aspect = width / height;
      preview.camera.updateProjectionMatrix();
      preview.renderer.render(preview.scene, preview.camera);
    });
  }
  function animate() {
    if (!visible || document.hidden || reduced.matches) return;
    previews.forEach((preview) => {
      if (preview.model) preview.model.rotation.y += 0.008;
    });
    render();
    frame = requestAnimationFrame(animate);
  }
  function stop() {
    clearInterval(interval);
    interval = undefined;
    cancelAnimationFrame(frame);
  }
  function sync() {
    stop();
    visible = navigation.getCurrent() === 'landing';
    if (!visible || document.hidden) return;
    if (!sequence) pair();
    render();
    if (!reduced.matches) {
      interval = setInterval(pair, 7000);
      animate();
    }
  }
  document.getElementById('landing-join')!.onclick = onJoin;
  document.getElementById('landing-login')!.onclick = () => navigation.navigate('login');
  document.getElementById('landing-next')!.onclick = pair;
  navigation.onNavigate(sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', () => {
    if (visible) render();
  });
  reduced.addEventListener('change', sync);
  const contact = document.getElementById('foodie-whatsapp') as HTMLAnchorElement;
  const rawPhone = import.meta.env.VITE_FOODIE_WHATSAPP || '';
  const phone = String(rawPhone).replace(/[\s+()-]/g, '');
  if (/^\d{8,15}$/.test(phone)) {
    contact.href = `https://wa.me/${phone}?text=${encodeURIComponent('Hola, tengo un negocio de comida y quiero implementar Foodie Pets.')}`;
    contact.removeAttribute('aria-disabled');
    document.getElementById('whatsapp-pending')!.hidden = true;
  } else {
    contact.removeAttribute('href');
    contact.setAttribute('aria-disabled', 'true');
  }
  sync();
}
