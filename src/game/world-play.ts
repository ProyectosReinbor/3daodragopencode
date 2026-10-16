import { cityRoadMarkup } from './city-map';
import { openCityRoom, closeCityRoom, nearbyCityEntrance, type CityRoom } from './city-life';
import { CITY_CITIZENS, CITY_VENUES, CITY_PARKS } from '../../shared/city-life.js';
import { geographicWorldPosition } from '../../shared/city-world.js';
import { WORLD_MATERIALS, WORLD_RECIPES } from '../../shared/world-crafting.js';
import { WORLD_QUESTS, QUEST_POSTS, questProgress } from '../../shared/world-quests.js';
import { questStatus, nearestQuestPlace, type QuestStatus } from './quest-journal';
import {
  adventureObjective,
  ADVENTURE_GUIDE,
  ADVENTURE_REWARD,
} from '../../shared/world-adventure.js';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Vector3,
  Mesh,
  TorusGeometry,
  Fog,
  MeshLambertMaterial,
  CircleGeometry,
  RingGeometry,
  Group,
} from 'three';
import type { Character } from './characters';
import { totalStats } from './characters';
import { buildNftModel, elementColor } from './nft';
import { createWorld, type Enemy } from './world';
import { zoneConfig } from './zones';
import type { PlayerProfile, ZoneId } from './profile';
import { getAllAbilities, getElementAbilities, calculateAbilityEffect } from './abilities';
import { getToken } from './api';
import { createCityWorld, CITY_WORLD, biomeAt } from './city-world';
import { WORLD_ITEMS, MONSTER_REWARDS, initialWorldProgress } from '../../shared/world-items';
import './world-play.css';
import { createWorldPresentation, type WorldPresentation } from './world-presentation';
import { disposePetModel } from './pet-model';
import {
  createEnemyAttack,
  cancelEnemyAttack,
  stepEnemyAttack,
  type EnemyAttackState,
} from './enemy-combat';
import { moveWithCollisions } from './world-movement';

const safe = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
export function mountWorldPlay(options: {
  pet: Character;
  profile?: PlayerProfile;
  onExit: (profile?: PlayerProfile) => void;
}): () => void {
  let pet = options.pet,
    profile = options.profile;
  const training = !profile;
  let progress = profile?.world || initialWorldProgress(),
    session = '',
    serverOffset = 0,
    busy = false,
    disposed = false;
  let health = 100 + totalStats(pet).hp * 8,
    mana = 100,
    shield = 0,
    zone: ZoneId = 'aldea';
  let defeated = false,
    invulnerableUntil = 0,
    damageFeedbackUntil = 0;
  let frame = 0,
    last = performance.now(),
    attackAt = 0,
    consumeAt = 0;
  const cooldown = [0, 0, 0, 0],
    pressed = new Set<string>(),
    events = new AbortController();
  const root = document.createElement('section');
  root.className = 'foodie-world';
  root.setAttribute('aria-label', training ? 'Campo de prueba' : 'Mundo AODASE PETS');
  root.innerHTML = `<canvas aria-label="Mundo 3D"></canvas><header><div class="world-vitals"><strong>${safe(pet.name)}</strong><small class="world-level"></small><div class="world-health"><i></i><span></span></div><div class="world-mana"><i></i><span></span></div></div><div class="world-title"><b>${training ? 'CAMPO DE PRUEBA' : 'AODASE PETS'}</b><small class="world-zone">Aldea</small><small class="world-coins"></small></div><nav>${training ? '' : '<button data-menu="quests">Misiones</button>'}<button data-menu="equipment">🛡️ Equipo</button><button data-menu="fullscreen" aria-label="Pantalla completa">⛶</button><button data-menu="exit">Salir</button></nav></header>${training ? '' : '<button class="world-minimap" data-minimap aria-label="Abrir mapa completo"><svg aria-hidden="true"></svg><span>N</span><small>⤢</small></button>'}<p class="world-quest-tracker"></p><div class="world-target"></div><p class="world-notice" role="status"></p><div class="world-joystick" aria-label="Joystick de movimiento"><span>↑<br>← →<br>↓</span><i></i></div><div class="world-quick"><button data-use="potions">❤️<span>Poción · 1</span><small></small></button><button data-use="mana">🧪<span>Maná · 2</span><small></small></button></div><div class="world-actions"><button class="world-interact" data-interact>${training ? 'Reiniciar rival' : 'Explorar'} <kbd>F</kbd></button><div class="world-spells"></div><button class="world-attack" data-attack>⚔️<span>Atacar</span><kbd>Espacio</kbd></button></div><p class="world-help">Flechas: mover · Q W E R: poderes · Espacio: atacar · 1 / 2: poción y maná · F: interactuar</p><div class="world-modal" hidden></div><div class="world-rotate"><b>↻</b><strong>Gira tu celular</strong><p>Juega en horizontal para tener todos los controles a mano.</p><button data-menu="exit">Volver</button></div>`;
  document.body.append(root);
  document.body.classList.add('world-playing');
  const background = document.getElementById('app'),
    previousInert = background?.inert || false;
  if (background) background.inert = true;
  const scene = new Scene(),
    camera = new PerspectiveCamera(55, 1, 0.1, 100);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas: root.querySelector('canvas')!, antialias: true });
  } catch {
    root.remove();
    document.body.classList.remove('world-playing');
    if (background) background.inert = previousInert;
    options.onExit(profile);
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const model = buildNftModel({ ...pet, phoneId: '' });
  let world = training ? createWorld(scene, zone) : createCityWorld(scene);
  let presentation: WorldPresentation | undefined;
  const respawns = new Map<Enemy, number>();
  const attacks = new Map<Enemy, EnemyAttackState>(),
    threats = new Map<Enemy, Group>(),
    enemyScales = new Map<Enemy, Vector3>();
  const effects: { mesh: Mesh; end: number }[] = [];
  const choices =
    pet.powers?.map((id) => getAllAbilities().find((a) => a.id === id)).filter((a) => !!a) || [];
  const powers =
    choices.length >= 2 ? choices.slice(0, 2) : getElementAbilities(pet.traits.element);
  const ultimate = {
    fuego: 'Supernova',
    agua: 'Maremoto',
    tierra: 'Furia terrestre',
    aire: 'Huracán',
    sombra: 'Eclipse',
    luz: 'Juicio celestial',
  };
  const skills = [
    ...powers,
    { id: 'impulse', name: 'Impulso', icon: '💨', energyCost: 15 },
    { id: 'ultimate', name: ultimate[pet.traits.element], icon: '✦', energyCost: 40 },
  ];
  root.querySelector('.world-spells')!.innerHTML = skills
    .map(
      (a, i) =>
        `<button data-power="${i}" class="${i === 3 ? 'ultimate' : ''}" aria-label="${'QWER'[i]}: ${safe(a.name)}"><kbd>${'QWER'[i]}</kbd><b>${a.icon}</b><span>${safe(a.name)}</span><small>${a.energyCost} maná</small><em></em></button>`
    )
    .join('');
  const modal = root.querySelector<HTMLElement>('.world-modal')!;
  root.insertAdjacentHTML(
    'beforeend',
    '<p class="world-danger" role="status" hidden></p><p class="world-damage-feedback" hidden></p><div class="world-hit-flash" aria-hidden="true" hidden></div>'
  );
  const dangerText = root.querySelector<HTMLElement>('.world-danger')!,
    damageFeedback = root.querySelector<HTMLElement>('.world-damage-feedback')!,
    hitFlash = root.querySelector<HTMLElement>('.world-hit-flash')!;
  function stopThreat(enemy: Enemy, now: number) {
    const state = attacks.get(enemy);
    if (state) cancelEnemyAttack(state, now);
    const indicator = threats.get(enemy);
    if (indicator) indicator.visible = false;
    const scale = enemyScales.get(enemy);
    if (scale) enemy.mesh.scale.copy(scale);
  }
  function clearThreats(now: number) {
    for (const enemy of attacks.keys()) stopThreat(enemy, now);
    dangerText.hidden = true;
  }
  function showDefeat() {
    defeated = true;
    health = 0;
    reset();
    clearThreats(performance.now());
    modal.hidden = false;
    modal.innerHTML =
      '<article role="dialog" aria-modal="true" aria-label="Mascota derrotada"><h2>Tu mascota necesita descansar</h2><p>Volverás al punto seguro con vida y maná completos. Conservas tu equipo, monedas, materiales y progreso de misiones.</p><button data-recover>Volver al punto seguro</button><button data-menu="exit">Salir al menú</button></article>';
  }
  function recover() {
    defeated = false;
    health = maxHealth();
    mana = 100;
    shield = 0;
    invulnerableUntil = performance.now() + 4000;
    damageFeedbackUntil = 0;
    damageFeedback.hidden = true;
    hitFlash.hidden = true;
    const start = zoneConfig(zone).playerStart;
    model.position.set(start.x, 0, start.z);
    world.enemies.forEach((e) => e.mesh.position.copy(e.spawnPosition));
    clearThreats(performance.now());
    reset();
    modal.hidden = true;
    modal.replaceChildren();
    notify('Recuperación completa. Tienes 4 segundos de protección y conservas tu progreso.');
  }
  function movePet(direction: Vector3, distance: number) {
    const limit = world.groundSize / 2 - 3;
    const bounds = activeRoom
      ? {
          minX: activeRoom.x - activeRoom.width / 2 + 0.8,
          maxX: activeRoom.x + activeRoom.width / 2 - 0.8,
          minZ: activeRoom.z - activeRoom.depth / 2 + 0.8,
          maxZ: activeRoom.z + activeRoom.depth / 2 - 0.8,
        }
      : { minX: -limit, maxX: limit, minZ: -limit, maxZ: limit };
    const next = moveWithCollisions(
      model.position,
      { x: direction.x * distance, z: direction.z * distance },
      bounds,
      (x, z) => !training && !activeRoom && !!scene.userData.cityBuildingAt?.(x, z)
    );
    model.position.x = next.x;
    model.position.z = next.z;
  }
  function showThreat(enemy: Enemy, state: EnemyAttackState, radius: number, progress: number) {
    let group = threats.get(enemy);
    if (!group) {
      group = new Group();
      group.name = 'enemy-attack-warning';
      const ring = new Mesh(
        new RingGeometry(radius * 0.86, radius, 32),
        new MeshLambertMaterial({
          color: 0xff695b,
          emissive: 0x872923,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      const fill = new Mesh(
        new CircleGeometry(radius, 32),
        new MeshLambertMaterial({
          color: 0xff695b,
          emissive: 0x872923,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        })
      );
      fill.rotation.x = -Math.PI / 2;
      fill.position.y = -0.01;
      group.add(ring, fill);
      scene.add(group);
      threats.set(enemy, group);
    }
    group.visible = true;
    group.position.set(state.aim.x, state.aim.y + 0.08, state.aim.z);
    (group.children[1] as Mesh).scale.setScalar(0.3 + progress * 0.7);
  }
  const adventureTracker = document.createElement('button');
  adventureTracker.className = 'world-adventure-tracker';
  adventureTracker.dataset.menu = 'adventure';
  adventureTracker.hidden = training;
  adventureTracker.setAttribute('aria-label', 'Ver primera aventura');
  adventureTracker.innerHTML =
    '<span class="world-adventure-arrow" aria-hidden="true">↑</span><strong></strong><small></small>';
  root.append(adventureTracker);
  let waypoint: { id: string; name: string; x: number; z: number } | null = null;
  const forgePlace = { ...CITY_WORLD.forge, id: 'camp-forge', name: 'Forja del campamento' };
  const mapPlaces = [
    ...CITY_WORLD.landmarks,
    ...CITY_VENUES,
    ...CITY_PARKS,
    ...CITY_WORLD.nodes,
    forgePlace,
  ];
  let journalFilter: QuestStatus | 'all' = 'all';
  let journalScope: string[] | undefined;
  const destinationMarker = new Mesh(
    new TorusGeometry(1.4, 0.13, 5, 24),
    new MeshLambertMaterial({ color: 0xffd98a, emissive: 0x74551e })
  );
  destinationMarker.name = 'adventure-destination';
  destinationMarker.rotation.x = -Math.PI / 2;
  destinationMarker.visible = false;
  scene.add(destinationMarker);
  function adventureDialog() {
    pressed.clear();
    modal.hidden = false;
    const goal = adventureObjective(progress, pet.id);
    const distance = Math.hypot(
      model.position.x - ADVENTURE_GUIDE.x,
      model.position.z - ADVENTURE_GUIDE.z
    );
    const canContinue = goal.ready && (goal.stage !== 4 || (distance <= 6 && !activeRoom));
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Primera aventura"><button data-close aria-label="Cerrar aventura">✕</button><small>${goal.stage < 0 ? 'ARI · GUÍA DE LA CIUDAD' : goal.stage === 5 ? 'AVENTURA COMPLETADA' : 'PASO ' + (goal.stage + 1) + ' / 5'}</small><h2>${safe(goal.title)}</h2><p>${safe(goal.description)}</p>${goal.stage >= 0 && goal.stage < 4 ? `<p>Progreso: ${goal.current}/${goal.total}</p>` : ''}${goal.destination ? `<p>Destino: ${safe(goal.destination.name)} · ${Math.round(Math.hypot(model.position.x - goal.destination.x, model.position.z - goal.destination.z))} m en línea recta. Sigue la flecha del mundo.</p>` : ''}${goal.stage < 0 ? '<p>Reúne provisiones, protege un parque, fabrica y equipa tu primera arma. Tu progreso se conserva al salir.</p><button data-adventure="start" ' + (session && !busy ? '' : 'disabled') + '>Comenzar con Ari</button>' : goal.stage < 5 ? `<button data-adventure="advance" data-stage="${goal.stage}" ${canContinue && session && !busy ? '' : 'disabled'}>${goal.stage === 4 ? 'Recibir recompensa' : 'Continuar al siguiente paso'}</button>` : '<p>Tu recompensa ya fue entregada. Puedes seguir explorando y aceptar las demás misiones.</p>'}${goal.action === 'equip' ? '<button data-menu="equipment">Abrir Equipo</button>' : ''}<p>Recompensa: ${ADVENTURE_REWARD.coins} monedas · ${ADVENTURE_REWARD.xp} XP · ${ADVENTURE_REWARD.potions} pociones · ${ADVENTURE_REWARD.mana} elixires de maná.</p><p>Movimiento: joystick o flechas. Cámara: arrastra el mundo. Interacción: F o botón Explorar.</p></article>`;
  }
  const buildingBar = document.createElement('div');
  buildingBar.className = 'world-building-bar';
  buildingBar.hidden = true;
  root.append(buildingBar);
  let activeRoom: CityRoom | null = null;
  let roomReturn: Vector3 | null = null;
  function enterBuilding(building: CityRoom['building'], floor = 0) {
    if (!activeRoom) roomReturn = model.position.clone();
    else closeCityRoom(scene, activeRoom);
    activeRoom = openCityRoom(scene, building, floor);
    camera.far = 350;
    camera.updateProjectionMatrix();
    if (scene.fog instanceof Fog) {
      scene.fog.near = activeRoom.terrace ? 80 : 28;
      scene.fog.far = activeRoom.terrace ? 280 : 160;
    }
    model.position.set(
      activeRoom.x,
      activeRoom.height,
      activeRoom.z + Math.min(3, activeRoom.depth / 2 - 1)
    );
    modal.hidden = true;
    buildingBar.hidden = false;
    root.classList.add('world-room-active');
    buildingBar.innerHTML = `<strong>${safe(activeRoom.name)} · ${activeRoom.terrace ? 'Terraza' : 'Piso ' + (activeRoom.floor + 1)}</strong><button data-room-action="floors">Ascensor</button>${activeRoom.venue && !activeRoom.terrace ? '<button data-room-action="shop">Negocio</button><button data-room-action="quests">Hablar con NPC</button>' : ''}<button data-room-action="exit">Salir del edificio</button>`;
    notify(
      activeRoom.terrace
        ? 'Explora la terraza y contempla la ciudad.'
        : 'Camina hasta las ventanas para mirar la ciudad. Usa el ascensor para subir.'
    );
  }
  function leaveBuilding() {
    if (!activeRoom) return;
    closeCityRoom(scene, activeRoom);
    activeRoom = null;
    camera.far = 140;
    camera.updateProjectionMatrix();
    if (scene.fog instanceof Fog) {
      scene.fog.near = 28;
      scene.fog.far = 85;
    }
    buildingBar.hidden = true;
    root.classList.remove('world-room-active');
    if (roomReturn) model.position.copy(roomReturn);
    roomReturn = null;
    modal.hidden = true;
    notify('Has vuelto a la calle.');
  }
  function floorsDialog() {
    if (!activeRoom) return;
    modal.hidden = false;
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Ascensor"><button data-close aria-label="Cerrar ascensor">✕</button><h2>${safe(activeRoom.name)}</h2><p>Selecciona un piso. Las ventanas y la terraza miran hacia la ciudad real.</p>${Array.from({ length: activeRoom.floors }, (_, i) => `<button data-room-level="${i}">Piso ${i + 1}${i === 0 ? ' · Recepción y negocio' : ''}</button>`).join('')}<button data-room-level="${activeRoom.floors}">Terraza panorámica</button></article>`;
  }
  function stats() {
    const value = { ...totalStats(pet) };
    for (const id of Object.values(progress.equipped[pet.id] || {})) {
      const item = WORLD_ITEMS[id!];
      if (item) value[item.stat] += item.bonus;
    }
    return value;
  }
  const maxHealth = () => 100 + stats().hp * 8;
  function notify(message: string) {
    if (!disposed) root.querySelector('.world-notice')!.textContent = message;
  }
  function release() {
    presentation?.dispose();
    presentation = undefined;
    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        for (const material of Array.isArray(obj.material) ? obj.material : [obj.material])
          material.dispose();
      }
    });
    scene.clear();
    attacks.clear();
    threats.clear();
    enemyScales.clear();
  }
  function prepare() {
    world.stations.forEach((s) => scene.remove(s.mesh));
    world.resources.forEach((r) => scene.remove(r.mesh));
    if (world.boss) scene.remove(world.boss.mesh);
    world.enemies.forEach((e) => {
      e.maxHealth = e.health = MONSTER_REWARDS[e.kind].health;
      e.damage = 8;
    });
    if (training) {
      world.enemies.slice(1).forEach((e) => {
        e.alive = false;
        scene.remove(e.mesh);
      });
      const e = world.enemies[0];
      e.name = 'Rival de práctica';
      e.health = e.maxHealth = 80;
      e.damage = 3;
      e.speed = 0.6;
      e.mesh.position.set(0, 0, -3);
      e.spawnPosition.copy(e.mesh.position);
      world.npcs.forEach((n) => scene.remove(n.mesh));
    }
    const start = zoneConfig(zone).playerStart;
    model.position.set(start.x, 0, start.z);
    scene.add(model);
    root.querySelector('.world-zone')!.textContent = training
      ? 'Un rival sencillo · Sin riesgo'
      : zone[0].toUpperCase() + zone.slice(1);
    presentation = createWorldPresentation(scene, renderer, zone, training);
  }
  prepare();
  const minimap = root.querySelector<SVGSVGElement>('.world-minimap svg');
  if (minimap) {
    const credit = document.createElement('a');
    credit.className = 'world-map-credit';
    credit.href = CITY_WORLD.sourceUrl;
    credit.textContent = CITY_WORLD.attribution;
    credit.target = '_blank';
    credit.rel = 'noopener noreferrer';
    root.append(credit);
  }
  if (minimap)
    minimap.innerHTML =
      CITY_WORLD.biomes
        .map(
          (b) =>
            `<circle cx="${b.x}" cy="${b.z}" r="${b.radius}" fill="#${b.color.toString(16).padStart(6, '0')}"/>`
        )
        .join('') +
      '<g data-minimap-roads>' +
      cityRoadMarkup(0, 0, 2400) +
      '</g>' +
      CITY_WORLD.landmarks
        .map((l) => `<circle cx="${l.x}" cy="${l.z}" r="25" fill="#83ddc4"/>`)
        .join('') +
      '<g data-minimap-player><circle r="58" fill="#07151d"/><polygon points="0,-38 25,28 0,15 -25,28" fill="#fff"/></g>';
  if (minimap) {
    const pins =
      CITY_WORLD.nodes
        .map((n) => `<circle cx="${n.x}" cy="${n.z}" r="16" fill="#e7cc87"/>`)
        .join('') +
      QUEST_POSTS.map(
        (p) => `<text x="${p.x}" y="${p.z}" font-size="60" fill="#ffe394">!</text>`
      ).join('') +
      `<rect x="${CITY_WORLD.forge.x - 25}" y="${CITY_WORLD.forge.z - 25}" width="50" height="50" fill="#ff8b9c"/>`;
    minimap.querySelector('[data-minimap-player]')?.insertAdjacentHTML('beforebegin', pins);
    minimap
      .querySelector('[data-minimap-player]')
      ?.insertAdjacentHTML(
        'beforebegin',
        CITY_VENUES.map(
          (v) =>
            `<circle cx="${v.x}" cy="${v.z}" r="18" fill="#d5b3ff"><title>${safe(v.name)}</title></circle>`
        ).join('') +
          CITY_PARKS.map(
            (p) =>
              `<circle cx="${p.x}" cy="${p.z}" r="22" fill="#e99f75"><title>${safe(p.name)} · Combate</title></circle>`
          ).join('')
      );
  }
  let minimapRoadCell = '';
  const minimapPlayer = minimap?.querySelector('[data-minimap-player]');
  minimap?.insertAdjacentHTML(
    'beforeend',
    '<circle data-adventure-pin r="30" fill="none" stroke="#ffd98a" stroke-width="12"/>'
  );
  const adventurePin = minimap?.querySelector('[data-adventure-pin]');
  const resize = () => {
    const box = root.getBoundingClientRect();
    renderer.setSize(box.width, box.height, false);
    camera.aspect = box.width / box.height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();
  async function request(body: Record<string, unknown>) {
    const response = await fetch('/api/world/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        ...body,
        session,
        position: { x: model.position.x, z: model.position.z },
      }),
      signal: events.signal,
    });
    const data = await response.json();
    if (!disposed && data.profile) {
      if (data.serverNow) serverOffset = data.serverNow - Date.now();
      profile = data.profile;
      progress = profile!.world!;
      pet = profile!.characters!.characters.find((p) => p.id === pet.id)!;
    }
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  if (!training)
    fetch('/api/world/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ characterId: pet.id }),
      signal: events.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (disposed) return;
        session = data.session;
        if (data.serverNow) serverOffset = data.serverNow - Date.now();
        profile = data.profile;
        progress = profile!.world!;
        if (modal.querySelector('[data-adventure]')) adventureDialog();
        notify('Habla con el guía junto al inicio. Recoge materiales con F y fabrica en la forja.');
      })
      .catch((e) => notify(e.message));
  else notify('Derrota al rival de prueba. Aquí no se gastan tus recursos reales.');
  const target = (range = 9) =>
    world.enemies
      .filter(
        (e) =>
          !defeated && !activeRoom && e.alive && e.mesh.position.distanceTo(model.position) < range
      )
      .sort(
        (a, b) =>
          a.mesh.position.distanceTo(model.position) - b.mesh.position.distanceTo(model.position)
      )[0];
  function burst(position: Vector3, big = false) {
    const mesh = new Mesh(
      new TorusGeometry(big ? 1.4 : 0.5, 0.08, 8, 36),
      new MeshLambertMaterial({ color: elementColor(pet.traits.element), transparent: true })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y = position.y + 0.7;
    scene.add(mesh);
    effects.push({ mesh, end: performance.now() + 600 });
  }
  async function attack(slot = -1) {
    const now = performance.now();
    if (defeated || busy || !modal.hidden || (!training && !session)) return;
    if (slot < 0 && now < attackAt) return;
    if (slot >= 0 && (now < cooldown[slot] || mana < skills[slot].energyCost)) {
      notify('Espera la recarga o utiliza un elixir.');
      return;
    }
    const effect =
      slot >= 0 && slot < 2 ? calculateAbilityEffect(powers[slot], stats(), pet.level) : null;
    if (
      slot === 2 ||
      effect?.type === 'heal' ||
      effect?.type === 'shield' ||
      effect?.type === 'dash'
    ) {
      mana -= skills[slot].energyCost;
      cooldown[slot] = now + [5000, 8000, 7000, 22000][slot];
      if (effect?.type === 'heal') health = Math.min(maxHealth(), health + effect.value);
      if (effect?.type === 'shield') shield = now + 5000;
      if (slot === 2 || effect?.type === 'dash') {
        movePet(new Vector3(Math.sin(model.rotation.y), 0, Math.cos(model.rotation.y)), 3);
      }
      burst(model.position);
      notify(skills[slot].name);
      return;
    }
    const enemy = target(slot < 0 ? 3.6 : 9);
    if (!enemy) {
      notify('Acércate a un enemigo para atacar.');
      return;
    }
    const before = mana;
    if (slot >= 0) {
      mana -= skills[slot].energyCost;
      cooldown[slot] = now + [5000, 8000, 7000, 22000][slot];
    } else attackAt = now + 450;
    model.rotation.y = Math.atan2(
      enemy.mesh.position.x - model.position.x,
      enemy.mesh.position.z - model.position.z
    );
    burst(enemy.mesh.position, slot === 3);
    busy = true;
    try {
      let reward;
      if (training)
        enemy.health = Math.max(
          0,
          enemy.health -
            Math.round(
              (10 + stats().atk * 2 + stats().ability) * (slot === 3 ? 3 : slot < 0 ? 0.7 : 1.3)
            )
        );
      else {
        const data = await request({
          action: 'attack',
          slot,
          kind: enemy.kind,
          enemy: `${training ? zone : 'city'}:${world.enemies.indexOf(enemy)}`,
        });
        if (disposed) return;
        enemy.health = data.enemyHealth;
        reward = data.reward;
      }
      if (!enemy.health) {
        enemy.alive = false;
        enemy.mesh.visible = false;
        respawns.set(enemy, performance.now() + 20000);
        notify(
          training
            ? '¡Rival derrotado! Reinícialo con F o vuelve a tu Pet.'
            : `+${reward.xp} XP · +${reward.coins} monedas${reward.potions ? ' · ❤️ Poción' : ''}${reward.mana ? ' · 🧪 Maná' : ''}${reward.item ? ' · ' + WORLD_ITEMS[reward.item].name : ''}${reward.material ? ' · ' + reward.amount + ' ' + WORLD_MATERIALS[reward.material] : ''}`
        );
      }
    } catch (e) {
      mana = before;
      if (slot >= 0) cooldown[slot] = 0;
      notify((e as Error).message);
    } finally {
      busy = false;
    }
  }
  function equipment() {
    modal.hidden = false;
    const equipped = progress.equipped[pet.id] || {};
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Equipo del personaje"><button data-close aria-label="Cerrar equipo">✕</button><h2>Equipo de ${safe(pet.name)}</h2><p>${Object.entries(
      WORLD_MATERIALS
    )
      .map(([id, name]) => name + ': ' + (progress.materials?.[id] || 0))
      .join(
        ' · '
      )}</p><div class="world-slots">${(['weapon', 'armor', 'relic'] as const).map((slot) => `<div><small>${{ weapon: 'Arma', armor: 'Armadura', relic: 'Reliquia' }[slot]}</small><strong>${equipped[slot] ? WORLD_ITEMS[equipped[slot]!].name : 'Sin equipar'}</strong></div>`).join('')}</div>${
      progress.items.length
        ? progress.items
            .map((id) => {
              const item = WORLD_ITEMS[id];
              return `<button data-equip="${id}">${item.icon} ${item.name}<small>+${item.bonus} ${{ atk: 'Ataque', def: 'Defensa', ability: 'Poder', hp: 'Vida' }[item.stat]} · ${equipped[item.slot] === id ? 'Equipado' : 'Equipar'}</small></button>`;
            })
            .join('')
        : '<p>Los lobos dejan colmillos y pelaje; los espíritus, gemas; los guardianes, espadas; y los gólems, corazas y reliquias.</p>'
    }</article>`;
  }
  function shop() {
    modal.hidden = false;
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Tienda del boticario"><button data-close aria-label="Cerrar tienda">✕</button><h2>${safe(activeRoom?.name || 'El boticario')}</h2><p>Negocio del mundo · Tienes ${progress.coins} monedas.</p><button data-buy="potions">❤️ Poción de vida · 15 monedas<small>Restaura 60% de tu vida máxima</small></button><button data-buy="mana">🧪 Elixir de maná · 12 monedas<small>Restaura 60 de maná</small></button></article>`;
  }
  let mapX = 0,
    mapZ = 0,
    mapSpan = 24000;
  function refreshCityMap() {
    const svg = modal.querySelector<SVGSVGElement>('[data-city-map]');
    if (!svg) return;
    svg.setAttribute(
      'viewBox',
      [mapX - mapSpan / 2, mapZ - mapSpan / 2, mapSpan, mapSpan].join(' ')
    );
    svg.querySelector('[data-map-roads]')!.innerHTML = cityRoadMarkup(mapX, mapZ, mapSpan, true);
    modal.querySelector('[data-map-scale]')!.textContent =
      'Ancho visible: ' + (mapSpan / 1000).toFixed(1) + ' km · Norte ↑';
    svg.querySelector('[data-waypoint-line]')?.remove();
    if (waypoint)
      svg.insertAdjacentHTML(
        'beforeend',
        `<g data-waypoint-line><line x1="${model.position.x}" y1="${model.position.z}" x2="${waypoint.x}" y2="${waypoint.z}" stroke="#83ddf5" stroke-width="8" stroke-dasharray="24 18"/><circle cx="${waypoint.x}" cy="${waypoint.z}" r="40" fill="none" stroke="#83ddf5" stroke-width="12"/></g>`
      );
  }
  function selectMapPlace(place: (typeof mapPlaces)[number]) {
    mapX = place.x;
    mapZ = place.z;
    mapSpan = 2000;
    modal.querySelector('[data-map-selection]')!.innerHTML =
      `<h3>${safe(place.name)}</h3><button data-follow-place="${safe(place.id)}">Seguir destino</button>`;
    refreshCityMap();
  }
  function cityMap() {
    modal.hidden = false;
    mapX = model.position.x;
    mapZ = model.position.z;
    mapSpan = 6000;
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Mapa de Villavicencio"><button data-close aria-label="Cerrar mapa">✕</button><h2>Villavicencio · Calles reales</h2><p>Geografía de OpenStreetMap · 1 unidad = 1 metro. Biomas y edificios de fantasía.</p><div class="world-map-controls"><button data-map-control="in" aria-label="Acercar mapa">＋</button><button data-map-control="out" aria-label="Alejar mapa">−</button><button data-map-control="north" aria-label="Mover mapa al norte">↑</button><button data-map-control="south" aria-label="Mover mapa al sur">↓</button><button data-map-control="west" aria-label="Mover mapa al oeste">←</button><button data-map-control="east" aria-label="Mover mapa al este">→</button><button data-map-control="player">Mi pet</button><button data-map-control="all">Ciudad</button></div><p data-map-scale></p><svg data-city-map style="width:100%;height:360px;background:#07151d" role="img" aria-label="Calles y lugares reales de Villavicencio">${CITY_WORLD.biomes.map((b) => `<circle cx="${b.x}" cy="${b.z}" r="${b.radius}" fill="#${b.color.toString(16).padStart(6, '0')}"/>`).join('')}<g data-map-roads></g>${CITY_WORLD.landmarks.map((l) => `<circle cx="${l.x}" cy="${l.z}" r="35" fill="#83ddc4"><title>${safe(l.name)}</title></circle><text x="${l.x + 45}" y="${l.z}" font-size="50" fill="#fff" stroke="#07151d" stroke-width="8" paint-order="stroke">${safe(l.name)}</text>`).join('')}<circle cx="${model.position.x}" cy="${model.position.z}" r="45" fill="white"/></svg><p><a href="${CITY_WORLD.sourceUrl}" target="_blank" rel="noopener noreferrer">${safe(CITY_WORLD.attribution)}</a> · ODbL · Datos importados: ${CITY_WORLD.importedAt.slice(0, 10)}</p><h3>Lugares</h3>${CITY_WORLD.landmarks.map((l) => `<p><button data-map-place="${l.id}">${safe(l.name)}</button> · ${Math.round(Math.hypot(model.position.x - l.x, model.position.z - l.z))} m en línea recta</p>`).join('')}<p>Cooperativa Chorillano: sede pendiente de confirmar.</p><h3>Materiales y hallazgos</h3>${CITY_WORLD.nodes.map((n) => `<p><button data-map-place="${n.id}">${safe(n.name)}</button> · ${WORLD_MATERIALS[n.material]} · ${Math.round(Math.hypot(model.position.x - n.x, model.position.z - n.z))} m</p>`).join('')}</article>`;
    refreshCityMap();
    modal
      .querySelector('article')!
      .insertAdjacentHTML(
        'afterbegin',
        `<section class="world-navigation"><p>${waypoint ? 'Destino: ' + safe(waypoint.name) : 'Selecciona un lugar y pulsa Seguir destino.'} · Guía en línea recta, sin ruta por calles.</p>${waypoint ? '<button data-clear-waypoint>Quitar destino y volver a la aventura</button>' : ''}<div data-map-selection></div></section>`
      );
    modal
      .querySelector('article')!
      .insertAdjacentHTML(
        'beforeend',
        `<p><button data-map-place="camp-forge">Forja del campamento</button> · Fabricación de equipo</p>`
      );
    modal
      .querySelector('[data-city-map]')!
      .insertAdjacentHTML(
        'beforeend',
        CITY_VENUES.map(
          (v) =>
            `<circle cx="${v.x}" cy="${v.z}" r="30" fill="#d5b3ff"><title>${safe(v.name)} · Entrada</title></circle>`
        ).join('') +
          CITY_PARKS.map(
            (p) =>
              `<circle cx="${p.x}" cy="${p.z}" r="50" fill="#e99f75"><title>${safe(p.name)} · Combate</title></circle>`
          ).join('')
      );
    modal
      .querySelector('article')!
      .insertAdjacentHTML(
        'beforeend',
        `<h3>Negocios y miradores del mundo</h3>${CITY_VENUES.map((v) => `<p><button data-map-place="${v.id}">${safe(v.name)}</button> · ${Math.round(Math.hypot(v.x - model.position.x, v.z - model.position.z))} m · ${v.floors} pisos y terraza</p>`).join('')}<h3>Parques de combate</h3>${CITY_PARKS.map((p) => `<p><button data-map-place="${p.id}">${safe(p.name)}</button> · ${Math.round(Math.hypot(p.x - model.position.x, p.z - model.position.z))} m</p>`).join('')}`
      );
  }

  function quests(ids?: string[]) {
    journalScope = ids;
    modal.hidden = false;
    const labels = {
      all: 'Todas',
      available: 'Disponibles',
      active: 'En curso',
      ready: 'Para cobrar',
      completed: 'Completadas',
    };
    const entries = Object.entries(WORLD_QUESTS).filter(([id]) => !ids || ids.includes(id));
    const visible = entries.filter(
      ([id]) => journalFilter === 'all' || questStatus(progress, id) === journalFilter
    );
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Misiones del mundo"><button data-close aria-label="Cerrar misiones">✕</button><h2>Misiones del mundo</h2>${ids ? '<p>Misiones de este personaje. <button data-all-quests>Ver todas las misiones</button></p>' : ''}<div class="world-journal-filters" role="group" aria-label="Filtrar misiones">${Object.entries(
      labels
    )
      .map(
        ([id, label]) =>
          `<button data-quest-filter="${id}" aria-pressed="${journalFilter === id}">${label} (${id === 'all' ? entries.length : entries.filter(([key]) => questStatus(progress, key) === id).length})</button>`
      )
      .join('')}</div>${
      visible
        .map(([id, q]) => {
          const accepted = progress.acceptedQuests?.includes(id),
            claimed = progress.claimedQuests?.includes(id),
            value = questProgress(progress, id);
          const status = questStatus(progress, id);
          return `<section class="world-quest-card"><small>${labels[status]}</small><h3>${safe(q.name)}</h3><p>${safe(q.description)}</p><progress max="${q.target}" value="${value}" aria-label="Progreso de ${safe(q.name)}"></progress><p>${value}/${q.target} · ${q.coins} monedas · ${q.xp} XP · 1 poción</p><button data-quest="${id}" data-quest-action="${accepted ? 'claim_quest' : 'accept_quest'}" ${claimed || (accepted && value < q.target) ? 'disabled' : ''}>${claimed ? 'Recompensa cobrada' : accepted ? 'Cobrar recompensa' : 'Aceptar misión'}</button>${status === 'active' ? `<button data-quest-location="${id}">Ver objetivo en mapa</button>` : ''}</section>`;
        })
        .join('') || '<p role="status">No hay misiones en esta categoría.</p>'
    }</article>`;
  }
  function forge() {
    modal.hidden = false;
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Forja"><button data-close aria-label="Cerrar forja">✕</button><h2>Forja del campamento</h2><p>${Object.entries(
      WORLD_MATERIALS
    )
      .map(([id, name]) => `${name}: ${progress.materials?.[id] || 0}`)
      .join(' · ')}</p>${Object.entries(WORLD_RECIPES)
      .map(([id, r]) => {
        const owned = progress.items.includes(r.output),
          enough = Object.entries(r.cost).every(([m, n]) => (progress.materials?.[m] || 0) >= n);
        return `<button data-craft="${id}" ${owned || !enough ? 'disabled' : ''}>${safe(r.name)}<small>${Object.entries(
          r.cost
        )
          .map(([m, n]) => `${WORLD_MATERIALS[m]} ${progress.materials?.[m] || 0}/${n}`)
          .join(' · ')} · ${owned ? 'Ya fabricado' : 'Fabricar'}</small></button>`;
      })
      .join('')}<p>Equipa tus creaciones desde Equipo.</p></article>`;
  }
  async function gather(node: (typeof CITY_WORLD.nodes)[number]) {
    if (busy || !session) return;
    busy = true;
    try {
      if (node.pickup) {
        const data = await request({ action: 'pickup', node: node.id });
        notify(`+${data.reward.amount} ${WORLD_MATERIALS[data.reward.material]}`);
        return;
      }
      const data = await request({ action: 'begin_gather', node: node.id });
      if (disposed || defeated) return;
      modal.hidden = false;
      modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Extracción"><button data-close aria-label="Cerrar extracción">✕</button><h2>${safe(node.name)}</h2><p>Extrayendo material…</p><progress max="3" value="0"></progress><button data-gather="${node.id}" disabled>Recoger material</button></article>`;
      const start = performance.now();
      const tick = () => {
        if (
          disposed ||
          modal.hidden ||
          modal.querySelector('[data-gather]')?.getAttribute('data-gather') !== node.id
        )
          return;
        const elapsed = (performance.now() - start) / 1000;
        modal.querySelector<HTMLProgressElement>('progress')!.value = Math.min(3, elapsed);
        if (elapsed >= 3.1) {
          const button = modal.querySelector<HTMLButtonElement>('[data-gather]')!;
          button.disabled = false;
          button.dataset.token = data.challenge.token;
          modal.querySelector('p')!.textContent = 'Extracción completada.';
        } else window.setTimeout(tick, 100);
      };
      tick();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      busy = false;
    }
  }

  function interact() {
    if (training) {
      const e = world.enemies[0];
      stopThreat(e, performance.now());
      e.alive = true;
      e.mesh.visible = true;
      e.health = e.maxHealth;
      e.mesh.position.copy(e.spawnPosition);
      health = maxHealth();
      mana = 100;
      cooldown.fill(0);
      notify('Rival reiniciado. ¡Prueba tus poderes!');
      return;
    }
    if (busy || !modal.hidden) return;
    if (activeRoom) {
      floorsDialog();
      return;
    }
    const entrance = nearbyCityEntrance(model.position);
    if (entrance) {
      enterBuilding(entrance);
      return;
    }
    const citizen = CITY_CITIZENS.find(
      (n) => Math.hypot(n.x - model.position.x, n.z - model.position.z) < 4
    );
    if (citizen) {
      if (citizen.id === 'camp-guide') adventureDialog();
      else quests([citizen.quest]);
      notify(citizen.name + ' tiene una misión para ti.');
      return;
    }
    if (
      Math.hypot(model.position.x - CITY_WORLD.forge.x, model.position.z - CITY_WORLD.forge.z) < 4
    ) {
      forge();
      return;
    }
    if (QUEST_POSTS.some((p) => Math.hypot(model.position.x - p.x, model.position.z - p.z) < 4)) {
      quests();
      return;
    }
    const resource = CITY_WORLD.nodes.find(
      (n) => Math.hypot(model.position.x - n.x, model.position.z - n.z) < 4
    );
    if (resource) {
      void gather(resource);
      return;
    }
    const landmark = CITY_WORLD.landmarks.find(
      (l) => Math.hypot(model.position.x - l.x, model.position.z - l.z) < 5
    );
    if (landmark) {
      notify(landmark.name + ' · Lugar de referencia del mundo.');
      return;
    }
    if (world.npcs.some((n) => n.mesh.position.distanceTo(model.position) < 4)) {
      shop();
      return;
    }
    const portal = world.portals.find(
      (p) => Math.hypot(model.position.x - p.position.x, model.position.z - p.position.z) < 3
    );
    if (portal) {
      scene.remove(model);
      release();
      respawns.clear();
      attacks.clear();
      effects.length = 0;
      zone = portal.targetZone;
      world = createWorld(scene, zone);
      prepare();
      notify(`Entraste en ${zone}.`);
    } else notify('Acércate a un lugar del mapa o al boticario.');
  }
  async function consume(item: 'potions' | 'mana') {
    if (defeated) return;
    if (busy || !progress[item] || performance.now() < consumeAt || (!training && !session)) return;
    if ((item === 'potions' && health >= maxHealth()) || (item === 'mana' && mana >= 100)) {
      notify('Ya estás al máximo.');
      return;
    }
    busy = true;
    try {
      if (training) progress[item]--;
      else await request({ action: 'consume', item });
      if (disposed || defeated) return;
      if (item === 'potions') health = Math.min(maxHealth(), health + maxHealth() * 0.6);
      else mana = Math.min(100, mana + 60);
      consumeAt = performance.now() + 1500;
      notify(item === 'potions' ? 'Vida recuperada' : 'Maná recuperado');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      busy = false;
    }
  }
  const exit = () => {
    dispose();
    options.onExit(profile);
  };
  root.addEventListener(
    'click',
    async (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (defeated && button.hasAttribute('data-recover')) {
        recover();
        return;
      }
      if (defeated && button.dataset.menu !== 'exit') {
        showDefeat();
        return;
      }
      if (button.dataset.menu === 'exit') exit();
      else if (button.dataset.menu === 'adventure') adventureDialog();
      else if (button.dataset.adventure) {
        if (busy || !session) return;
        busy = true;
        button.disabled = true;
        try {
          const data = await request({
            action: button.dataset.adventure === 'start' ? 'adventure_start' : 'adventure_advance',
            stage: Number(button.dataset.stage),
          });
          if (disposed) return;
          notify(
            data.reward
              ? 'Aventura completada: +75 monedas, +100 XP y consumibles.'
              : 'Objetivo actualizado. Sigue tu brújula.'
          );
        } catch (error) {
          notify((error as Error).message);
        } finally {
          busy = false;
          if (!disposed) adventureDialog();
        }
      } else if (button.dataset.questFilter) {
        const filter = button.dataset.questFilter;
        if (['all', 'available', 'active', 'ready', 'completed'].includes(filter)) {
          journalFilter = filter as QuestStatus | 'all';
          quests(journalScope);
        }
      } else if (button.hasAttribute('data-all-quests')) {
        journalFilter = 'all';
        quests();
      } else if (button.dataset.questLocation) {
        const id = button.dataset.questLocation;
        if (!Object.hasOwn(WORLD_QUESTS, id) || questStatus(progress, id) !== 'active') return;
        const place = nearestQuestPlace(
          WORLD_QUESTS[id].metric,
          model.position,
          CITY_WORLD.nodes,
          CITY_PARKS,
          forgePlace
        );
        if (place) {
          cityMap();
          selectMapPlace(place);
        }
      } else if (button.dataset.menu === 'navigation') cityMap();
      else if (button.hasAttribute('data-clear-waypoint')) {
        waypoint = null;
        cityMap();
      } else if (button.dataset.followPlace) {
        const place = mapPlaces.find((p) => p.id === button.dataset.followPlace);
        if (place) {
          waypoint = { id: place.id, name: place.name, x: place.x, z: place.z };
          modal.hidden = true;
          reset();
          notify('Sigue la flecha hacia ' + place.name + '. Distancia en línea recta.');
        }
      } else if (button.dataset.roomLevel !== undefined && activeRoom) {
        const level = Number(button.dataset.roomLevel);
        if (Number.isInteger(level) && level >= 0 && level <= activeRoom.floors)
          enterBuilding(activeRoom.building, level);
      } else if (button.dataset.roomAction) {
        if (button.dataset.roomAction === 'exit') leaveBuilding();
        else if (button.dataset.roomAction === 'floors') floorsDialog();
        else if (button.dataset.roomAction === 'shop') shop();
        else if (button.dataset.roomAction === 'quests')
          quests(activeRoom?.venue ? [activeRoom.venue.quest] : undefined);
      } else if (button.dataset.mapControl || button.dataset.mapPlace) {
        const control = button.dataset.mapControl;
        if (control === 'in') mapSpan = Math.max(300, mapSpan / 2);
        if (control === 'out') mapSpan = Math.min(40000, mapSpan * 2);
        if (control === 'north') mapZ -= mapSpan / 3;
        if (control === 'south') mapZ += mapSpan / 3;
        if (control === 'west') mapX -= mapSpan / 3;
        if (control === 'east') mapX += mapSpan / 3;
        if (control === 'player') {
          mapX = model.position.x;
          mapZ = model.position.z;
        }
        if (control === 'all') {
          const bounds = CITY_WORLD.geographicBounds;
          const northWest = geographicWorldPosition(bounds.north, bounds.west);
          const southEast = geographicWorldPosition(bounds.south, bounds.east);
          mapX = (northWest.x + southEast.x) / 2;
          mapZ = (northWest.z + southEast.z) / 2;
          mapSpan = Math.max(southEast.x - northWest.x, southEast.z - northWest.z) + 400;
        }
        const place = mapPlaces.find((l) => l.id === button.dataset.mapPlace);
        if (place) {
          selectMapPlace(place);
        }
        mapX = Math.max(-19000, Math.min(19000, mapX));
        mapZ = Math.max(-19000, Math.min(19000, mapZ));
        refreshCityMap();
      } else if (button.dataset.menu === 'equipment') equipment();
      else if (button.dataset.menu === 'quests') quests();
      else if (button.dataset.craft || button.dataset.gather || button.dataset.quest) {
        if (busy || !session) return;
        busy = true;
        try {
          const data = await request(
            button.dataset.craft
              ? { action: 'craft', recipe: button.dataset.craft }
              : button.dataset.gather
                ? { action: 'gather', node: button.dataset.gather, token: button.dataset.token }
                : { action: button.dataset.questAction, quest: button.dataset.quest }
          );
          if (disposed) return;
          if (button.dataset.craft) {
            forge();
            notify('Objeto fabricado. Equípalo desde Equipo.');
          } else if (button.dataset.quest) {
            quests(journalScope);
            notify(data.reward ? 'Recompensa recibida.' : 'Misión aceptada.');
          } else {
            modal.hidden = true;
            notify('+ ' + data.reward.amount + ' ' + WORLD_MATERIALS[data.reward.material]);
          }
        } catch (e) {
          notify((e as Error).message);
        } finally {
          busy = false;
        }
      } else if (button.hasAttribute('data-minimap')) cityMap();
      else if (button.dataset.menu === 'fullscreen') {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await root.requestFullscreen();
        } catch {
          notify('El mundo ya ocupa toda la pantalla disponible.');
        }
      } else if (button.hasAttribute('data-close')) modal.hidden = true;
      else if (button.dataset.power !== undefined) void attack(Number(button.dataset.power));
      else if (button.hasAttribute('data-attack')) void attack();
      else if (button.hasAttribute('data-interact')) interact();
      else if (button.dataset.use) void consume(button.dataset.use as 'potions' | 'mana');
      else if (button.dataset.buy || button.dataset.equip) {
        if (busy || training) return;
        busy = true;
        try {
          await request(
            button.dataset.buy
              ? { action: 'buy', item: button.dataset.buy }
              : { action: 'equip', item: button.dataset.equip }
          );
          if (button.dataset.buy) shop();
          else equipment();
        } catch (e) {
          notify((e as Error).message);
        } finally {
          busy = false;
        }
      }
    },
    { signal: events.signal }
  );
  window.addEventListener(
    'keydown',
    (event) => {
      const key = event.key.toLowerCase();
      if (
        key.startsWith('arrow') ||
        ['q', 'w', 'e', 'r', ' ', 'f', '1', '2', 'escape'].includes(key)
      )
        event.preventDefault();
      pressed.add(key);
      if (defeated) {
        if (key === 'escape') exit();
        return;
      }
      if (event.repeat) return;
      if (key === 'escape') {
        if (!modal.hidden) modal.hidden = true;
        else exit();
        return;
      }
      if (!modal.hidden) return;
      const slot = 'qwer'.indexOf(key);
      if (slot >= 0 && key.length === 1) void attack(slot);
      if (key === ' ') void attack();
      if (key === 'f') interact();
      if (key === '1') void consume('potions');
      if (key === '2') void consume('mana');
    },
    { signal: events.signal }
  );
  window.addEventListener('keyup', (event) => pressed.delete(event.key.toLowerCase()), {
    signal: events.signal,
  });
  const joystick = root.querySelector<HTMLElement>('.world-joystick')!,
    knob = joystick.querySelector<HTMLElement>('i')!;
  let pointer: number | null = null,
    axisX = 0,
    axisZ = 0;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const defaultPitch = Math.atan2(6, 13);
  let cameraYaw = 0,
    cameraPitch = defaultPitch;
  let cameraPointer: number | null = null,
    dragX = 0,
    dragY = 0;
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || cameraPointer !== null || !modal.hidden) return;
      event.preventDefault();
      cameraPointer = event.pointerId;
      dragX = event.clientX;
      dragY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    },
    { signal: events.signal }
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== cameraPointer) return;
      if (modal.hidden && !document.hidden) {
        cameraYaw -= (event.clientX - dragX) * 0.006;
        cameraPitch = Math.max(0.25, Math.min(1.1, cameraPitch + (event.clientY - dragY) * 0.005));
      }
      dragX = event.clientX;
      dragY = event.clientY;
    },
    { signal: events.signal }
  );
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
    canvas.addEventListener(
      name,
      (event) => {
        if (event.pointerId === cameraPointer) cameraPointer = null;
      },
      { signal: events.signal }
    );
  root.querySelector('.world-help')!.append(' · Arrastra el mundo: girar cámara');
  function reset() {
    pressed.clear();
    pointer = null;
    cameraPointer = null;
    axisX = axisZ = 0;
    knob.style.transform = 'translate(0,0)';
  }
  function touch(event: PointerEvent) {
    const box = joystick.getBoundingClientRect(),
      radius = box.width * 0.32;
    let x = event.clientX - box.left - box.width / 2,
      z = event.clientY - box.top - box.height / 2;
    const length = Math.hypot(x, z);
    if (length > radius) {
      x *= radius / length;
      z *= radius / length;
    }
    axisX = length < radius * 0.12 ? 0 : x / radius;
    axisZ = length < radius * 0.12 ? 0 : z / radius;
    knob.style.transform = `translate(${x}px,${z}px)`;
  }
  joystick.addEventListener(
    'pointerdown',
    (event) => {
      if (pointer !== null) return;
      event.preventDefault();
      pointer = event.pointerId;
      joystick.setPointerCapture(pointer);
      touch(event);
    },
    { signal: events.signal }
  );
  joystick.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId === pointer) touch(event);
    },
    { signal: events.signal }
  );
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
    joystick.addEventListener(
      name,
      (event) => {
        if (event.pointerId === pointer) reset();
      },
      { signal: events.signal }
    );
  window.addEventListener('blur', reset, { signal: events.signal });
  document.addEventListener('visibilitychange', reset, { signal: events.signal });
  function loop(now: number) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (
      !defeated &&
      modal.hidden &&
      !document.hidden &&
      !(innerHeight > innerWidth && matchMedia('(pointer:coarse)').matches)
    ) {
      const direction = new Vector3(
        pointer !== null
          ? axisX
          : Number(pressed.has('arrowright')) - Number(pressed.has('arrowleft')),
        0,
        pointer !== null ? axisZ : Number(pressed.has('arrowdown')) - Number(pressed.has('arrowup'))
      );
      if (direction.length() > 1) direction.normalize();
      direction.applyAxisAngle(new Vector3(0, 1, 0), cameraYaw);
      movePet(direction, dt * (4 + stats().spd * 0.08));
      if (direction.length() > 0.05) model.rotation.y = Math.atan2(direction.x, direction.z);
      model.position.y =
        (activeRoom
          ? activeRoom.height
          : training
            ? 0
            : (scene.userData.citySurfaceHeight?.(model.position.x, model.position.z) || 0) +
              0.13) + (direction.length() > 0.05 ? Math.abs(Math.sin(now * 0.012)) * 0.08 : 0);
      mana = Math.min(100, mana + dt * 4);
      let incoming = 0;
      world.enemies.forEach((enemy) => {
        if (activeRoom) {
          stopThreat(enemy, now);
          enemy.mesh.visible = false;
          return;
        }
        if (!training && enemy.alive)
          enemy.mesh.visible = enemy.mesh.position.distanceTo(model.position) < 110;
        if (!enemy.alive) {
          stopThreat(enemy, now);
          if (respawns.has(enemy) && now > respawns.get(enemy)!) {
            enemy.alive = true;
            enemy.mesh.visible = true;
            enemy.health = enemy.maxHealth;
            enemy.mesh.position.copy(enemy.spawnPosition);
            respawns.delete(enemy);
          }
          return;
        }
        const distance = enemy.mesh.position.distanceTo(model.position);
        let state = attacks.get(enemy);
        if (!state) {
          state = createEnemyAttack();
          attacks.set(enemy, state);
          enemyScales.set(enemy, enemy.mesh.scale.clone());
        }
        if (now < invulnerableUntil || health <= 0) {
          stopThreat(enemy, now);
          return;
        }
        if (state.phase === 'idle' && distance < 10 && distance > 1.5) {
          const chase = model.position.clone().sub(enemy.mesh.position).setY(0).normalize();
          const next = enemy.mesh.position.clone().addScaledVector(chase, dt * enemy.speed);
          if (training || !scene.userData.cityBuildingAt?.(next.x, next.z))
            enemy.mesh.position.copy(next);
          enemy.mesh.rotation.y = Math.atan2(chase.x, chase.z);
        }
        if (
          state.phase === 'idle' &&
          distance >= 10 &&
          enemy.mesh.position.distanceTo(enemy.spawnPosition) > 0.2
        ) {
          const home = enemy.spawnPosition.clone().sub(enemy.mesh.position).setY(0);
          const step = Math.min(home.length(), dt * enemy.speed);
          enemy.mesh.position.addScaledVector(home.normalize(), step);
        }
        const strike = stepEnemyAttack(state, enemy.kind, now, enemy.mesh.position, model.position);
        if (state.phase === 'windup') {
          incoming++;
          showThreat(enemy, state, strike.radius, strike.progress);
          const base = enemyScales.get(enemy)!;
          enemy.mesh.scale.set(
            base.x * (1 + strike.progress * 0.1),
            base.y * (1 - strike.progress * 0.12),
            base.z * (1 + strike.progress * 0.1)
          );
        } else {
          const marker = threats.get(enemy);
          if (marker) marker.visible = false;
          enemy.mesh.scale.copy(enemyScales.get(enemy)!);
        }
        if (strike.hit) {
          const damage = Math.max(1, enemy.damage - stats().def * 0.3) * (now < shield ? 0.25 : 1);
          health -= damage;
          damageFeedbackUntil = now + 450;
          damageFeedback.textContent = '−' + Math.ceil(damage);
          damageFeedback.hidden = false;
          hitFlash.hidden = false;
          burst(model.position);
        }
        enemy.hpBar.scale.x = Math.max(0.001, enemy.health / enemy.maxHealth);
      });
      dangerText.hidden = incoming === 0;
      dangerText.textContent = incoming ? '¡Apártate del círculo rojo!' : '';
      if (health <= 0) showDefeat();
    } else clearThreats(now);
    damageFeedback.hidden = now >= damageFeedbackUntil;
    hitFlash.hidden = now >= damageFeedbackUntil - 300;
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      effect.mesh.scale.setScalar(1 + (600 - (effect.end - now)) / 180);
      (effect.mesh.material as MeshLambertMaterial).opacity = Math.max(0, (effect.end - now) / 600);
      if (now > effect.end) {
        scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        (effect.mesh.material as MeshLambertMaterial).dispose();
        effects.splice(i, 1);
      }
    }
    if (minimap) {
      const roadCell =
        Math.floor(model.position.x / 300) + ':' + Math.floor(model.position.z / 300);
      if (roadCell !== minimapRoadCell) {
        minimapRoadCell = roadCell;
        minimap.querySelector('[data-minimap-roads]')!.innerHTML = cityRoadMarkup(
          model.position.x,
          model.position.z,
          2400
        );
      }
      minimap.setAttribute(
        'viewBox',
        `${model.position.x - 900} ${model.position.z - 900} 1800 1800`
      );
      minimapPlayer?.setAttribute(
        'transform',
        `translate(${model.position.x} ${model.position.z}) rotate(${180 - (model.rotation.y * 180) / Math.PI})`
      );
    }
    if (!training) {
      const goal = adventureObjective(progress, pet.id);
      if (
        waypoint &&
        modal.hidden &&
        !defeated &&
        !activeRoom &&
        Math.hypot(waypoint.x - model.position.x, waypoint.z - model.position.z) <= 8
      ) {
        notify('Llegaste a ' + waypoint.name + '. Usa F o Explorar para interactuar.');
        waypoint = null;
      }
      adventureTracker.hidden = !waypoint && goal.stage === 5;
      adventureTracker.dataset.menu = waypoint ? 'navigation' : 'adventure';
      adventureTracker.setAttribute(
        'aria-label',
        waypoint ? 'Ver destino en el mapa' : 'Ver primera aventura'
      );
      adventureTracker.classList.toggle('world-navigation-active', !!waypoint);
      adventureTracker.querySelector('strong')!.textContent = waypoint?.name || goal.title;
      const destination = waypoint || goal.destination;
      adventureTracker.querySelector('small')!.textContent = waypoint
        ? `${Math.round(Math.hypot(waypoint.x - model.position.x, waypoint.z - model.position.z))} m en línea recta · Ver mapa`
        : destination
          ? `${goal.stage >= 0 && goal.stage < 4 ? goal.current + '/' + goal.total + ' · ' : ''}${Math.round(Math.hypot(destination.x - model.position.x, destination.z - model.position.z))} m · ${goal.ready ? 'Ver siguiente paso' : 'Ver objetivo'}`
          : `${goal.current}/${goal.total} · ${goal.ready ? 'Continuar' : 'Abrir objetivo'}`;
      const arrow = adventureTracker.querySelector<HTMLElement>('.world-adventure-arrow')!;
      arrow.hidden = !destination;
      destinationMarker.visible = !!destination && !activeRoom && (!!waypoint || goal.stage !== 5);
      (destinationMarker.material as MeshLambertMaterial).color.setHex(
        waypoint ? 0x83ddf5 : 0xffd98a
      );
      adventurePin?.setAttribute('stroke', waypoint ? '#83ddf5' : '#ffd98a');
      adventurePin?.setAttribute(
        'visibility',
        destination && (waypoint || goal.stage !== 5) ? 'visible' : 'hidden'
      );
      if (destination) {
        const dx = destination.x - model.position.x,
          dz = destination.z - model.position.z;
        adventurePin?.setAttribute('cx', String(destination.x));
        adventurePin?.setAttribute('cy', String(destination.z));
        const right = dx * Math.cos(cameraYaw) - dz * Math.sin(cameraYaw),
          forward = -dx * Math.sin(cameraYaw) - dz * Math.cos(cameraYaw);
        arrow.style.transform = `rotate(${(Math.atan2(right, forward) * 180) / Math.PI}deg)`;
        destinationMarker.position.set(
          destination.x,
          (scene.userData.citySurfaceHeight?.(destination.x, destination.z) || 0) + 0.3,
          destination.z
        );
        destinationMarker.scale.setScalar(1 + Math.sin(now * 0.003) * 0.08);
      }
      root.classList.toggle('world-guided-adventure', !!waypoint || goal.stage !== 5);
    }
    const radius = activeRoom && !activeRoom.terrace ? 4.2 : Math.hypot(10, 8.5),
      horizontal = radius * Math.cos(cameraPitch);
    const cameraGround = activeRoom
      ? activeRoom.height
      : training
        ? 0
        : scene.userData.citySurfaceHeight?.(model.position.x, model.position.z) || 0;
    camera.position.set(
      model.position.x + Math.sin(cameraYaw) * horizontal,
      cameraGround + 0.7 + radius * Math.sin(cameraPitch),
      model.position.z + Math.cos(cameraYaw) * horizontal
    );
    camera.lookAt(model.position.x, cameraGround + 0.7, model.position.z);
    if (!training) scene.userData.updateCityVegetation?.(model.position);
    if (!training) scene.userData.animateCityUrban?.(now / 1000);
    if (!training) scene.userData.animateCityLife?.(now / 1000, model.position);
    presentation?.update(dt, now / 1000, model.position);
    renderer.render(scene, camera);
    for (const [selector, value, max, label] of [
      ['.world-health', health, maxHealth(), 'Vida'],
      ['.world-mana', mana, 100, 'Maná'],
    ] as const) {
      const box = root.querySelector(selector)!;
      box.querySelector<HTMLElement>('i')!.style.width = `${Math.max(0, (value / max) * 100)}%`;
      box.querySelector('span')!.textContent = `${label} ${Math.ceil(value)} / ${max}`;
    }
    if (!training)
      root.querySelector('.world-zone')!.textContent = activeRoom
        ? activeRoom.name +
          ' · ' +
          (activeRoom.terrace ? 'Terraza' : 'Piso ' + (activeRoom.floor + 1))
        : Math.hypot(model.position.x, model.position.z) < 12
          ? 'Parque Central'
          : biomeAt(model.position.x, model.position.z).name;
    root.querySelector('.world-level')!.textContent = `Nivel ${pet.level} · ${pet.xp} XP`;
    root.querySelector('.world-coins')!.textContent = training
      ? 'Modo práctica'
      : `◈ ${progress.coins} monedas · ${progress.kills} derrotados`;
    for (const item of ['potions', 'mana'] as const) {
      const button = root.querySelector<HTMLButtonElement>(`[data-use="${item}"]`)!;
      button.querySelector('small')!.textContent = `× ${progress[item]}`;
      button.disabled = defeated || !progress[item] || busy;
    }
    for (let i = 0; i < 4; i++) {
      const button = root.querySelector<HTMLButtonElement>(`[data-power="${i}"]`)!;
      const remaining = Math.max(0, cooldown[i] - now);
      button.querySelector('em')!.textContent = remaining ? `${Math.ceil(remaining / 1000)}s` : '';
      button.disabled = defeated || remaining > 0 || mana < skills[i].energyCost || busy;
    }
    if (!training) {
      const active = (progress.acceptedQuests || []).find(
        (id) => !progress.claimedQuests?.includes(id)
      );
      root.querySelector('.world-quest-tracker')!.textContent = active
        ? WORLD_QUESTS[active].name +
          ' · ' +
          questProgress(progress, active) +
          '/' +
          WORLD_QUESTS[active].target
        : '';
      const node = CITY_WORLD.nodes.find(
        (n) => Math.hypot(model.position.x - n.x, model.position.z - n.z) < 4
      );
      root.querySelector('.world-interact')!.innerHTML =
        (activeRoom
          ? 'Ascensor'
          : nearbyCityEntrance(model.position)
            ? 'Entrar edificio'
            : CITY_CITIZENS.some(
                  (n) => Math.hypot(n.x - model.position.x, n.z - model.position.z) < 4
                )
              ? 'Hablar'
              : node
                ? 'Recoger'
                : Math.hypot(
                      model.position.x - CITY_WORLD.forge.x,
                      model.position.z - CITY_WORLD.forge.z
                    ) < 4
                  ? 'Craftear'
                  : QUEST_POSTS.some(
                        (p) => Math.hypot(model.position.x - p.x, model.position.z - p.z) < 4
                      )
                    ? 'Misiones'
                    : 'Explorar') + ' <kbd>F</kbd>';
      for (const n of CITY_WORLD.nodes) {
        const object = scene.getObjectByName('resource-' + n.id);
        if (object)
          object.visible = (progress.resourceCooldowns?.[n.id] || 0) <= Date.now() + serverOffset;
      }
    }
    const enemy = target(12);
    root.querySelector('.world-target')!.textContent = enemy
      ? `${enemy.name} · ${Math.ceil(enemy.health)} / ${enemy.maxHealth} ❤️${attacks.get(enemy)?.phase === 'windup' ? ' · Preparando ataque' : ''}`
      : '';
    frame = requestAnimationFrame(loop);
  }
  frame = requestAnimationFrame(loop);
  function dispose() {
    if (disposed) return;
    disposed = true;
    events.abort();
    cancelAnimationFrame(frame);
    observer.disconnect();
    if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
    scene.remove(model);
    disposePetModel(model);
    release();
    renderer.dispose();
    root.remove();
    document.body.classList.remove('world-playing');
    if (background) background.inert = previousInert;
  }
  return dispose;
}
