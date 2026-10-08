import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Vector3,
  Mesh,
  TorusGeometry,
  MeshLambertMaterial,
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
    busy = false,
    disposed = false;
  let health = 100 + totalStats(pet).hp * 8,
    mana = 100,
    shield = 0,
    zone: ZoneId = 'aldea';
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
  root.innerHTML = `<canvas aria-label="Mundo 3D"></canvas><header><div class="world-vitals"><strong>${safe(pet.name)}</strong><small class="world-level"></small><div class="world-health"><i></i><span></span></div><div class="world-mana"><i></i><span></span></div></div><div class="world-title"><b>${training ? 'CAMPO DE PRUEBA' : 'AODASE PETS'}</b><small class="world-zone">Aldea</small><small class="world-coins"></small></div><nav>${training ? '' : '<button data-menu="map">Mapa</button>'}<button data-menu="equipment">🛡️ Equipo</button><button data-menu="fullscreen" aria-label="Pantalla completa">⛶</button><button data-menu="exit">Salir</button></nav></header><div class="world-target"></div><p class="world-notice" role="status"></p><div class="world-joystick" aria-label="Joystick de movimiento"><span>↑<br>← →<br>↓</span><i></i></div><div class="world-quick"><button data-use="potions">❤️<span>Poción · 1</span><small></small></button><button data-use="mana">🧪<span>Maná · 2</span><small></small></button></div><div class="world-actions"><button class="world-interact" data-interact>${training ? 'Reiniciar rival' : 'Explorar'} <kbd>F</kbd></button><div class="world-spells"></div><button class="world-attack" data-attack>⚔️<span>Atacar</span><kbd>Espacio</kbd></button></div><p class="world-help">Flechas: mover · Q W E R: poderes · Espacio: atacar · 1 / 2: poción y maná · F: interactuar</p><div class="world-modal" hidden></div><div class="world-rotate"><b>↻</b><strong>Gira tu celular</strong><p>Juega en horizontal para tener todos los controles a mano.</p><button data-menu="exit">Volver</button></div>`;
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
  const respawns = new Map<Enemy, number>(),
    strikes = new Map<Enemy, number>();
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
      body: JSON.stringify({ ...body, session }),
      signal: events.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (!disposed) {
      profile = data.profile;
      progress = profile!.world!;
      pet = profile!.characters!.characters.find((p) => p.id === pet.id)!;
    }
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
        profile = data.profile;
        progress = profile!.world!;
        notify(
          'Explora los biomas de Villavicencio. Abre el mapa para localizar centros comerciales, universidades y el parque.'
        );
      })
      .catch((e) => notify(e.message));
  else notify('Derrota al rival de prueba. Aquí no se gastan tus recursos reales.');
  const target = (range = 9) =>
    world.enemies
      .filter((e) => e.alive && e.mesh.position.distanceTo(model.position) < range)
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
    mesh.position.y = 0.7;
    scene.add(mesh);
    effects.push({ mesh, end: performance.now() + 600 });
  }
  async function attack(slot = -1) {
    const now = performance.now();
    if (busy || !modal.hidden || (!training && !session)) return;
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
        model.position.addScaledVector(
          new Vector3(Math.sin(model.rotation.y), 0, Math.cos(model.rotation.y)),
          3
        );
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
            : `+${reward.xp} XP · +${reward.coins} monedas${reward.potions ? ' · ❤️ Poción' : ''}${reward.mana ? ' · 🧪 Maná' : ''}${reward.item ? ' · ' + WORLD_ITEMS[reward.item].name : ''}`
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
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Equipo del personaje"><button data-close aria-label="Cerrar equipo">✕</button><h2>Equipo de ${safe(pet.name)}</h2><div class="world-slots">${(['weapon', 'armor', 'relic'] as const).map((slot) => `<div><small>${{ weapon: 'Arma', armor: 'Armadura', relic: 'Reliquia' }[slot]}</small><strong>${equipped[slot] ? WORLD_ITEMS[equipped[slot]!].name : 'Sin equipar'}</strong></div>`).join('')}</div>${
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
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Tienda del boticario"><button data-close aria-label="Cerrar tienda">✕</button><h2>El boticario</h2><p>Tienes ${progress.coins} monedas.</p><button data-buy="potions">❤️ Poción de vida · 15 monedas<small>Restaura 60% de tu vida máxima</small></button><button data-buy="mana">🧪 Elixir de maná · 12 monedas<small>Restaura 60 de maná</small></button></article>`;
  }
  function cityMap() {
    modal.hidden = false;
    modal.innerHTML = `<article role="dialog" aria-modal="true" aria-label="Mapa de Villavicencio"><button data-close aria-label="Cerrar mapa">✕</button><h2>Villavicencio · Mundo abierto</h2><p>Reinterpretación fantástica. Posiciones de diseño, no rutas de navegación real.</p><svg style="width:100%;max-height:300px;background:#07151d" viewBox="-90 -90 180 180" role="img" aria-label="Biomas y lugares de referencia">${CITY_WORLD.biomes.map((b) => `<circle cx="${b.x}" cy="${b.z}" r="${b.radius}" fill="#${b.color.toString(16).padStart(6, '0')}"/>`).join('')}${CITY_WORLD.roads.map((r) => `<polyline points="${r.points.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#aac5cd" stroke-width="2"/>`).join('')}${CITY_WORLD.landmarks.map((l) => `<circle cx="${l.x}" cy="${l.z}" r="2" fill="#83ddc4"><title>${safe(l.name)}</title></circle>`).join('')}<circle cx="${model.position.x}" cy="${model.position.z}" r="3" fill="white"/></svg>${CITY_WORLD.landmarks.map((l) => `<p>${safe(l.name)} · X ${l.x}, Z ${l.z}</p>`).join('')}<p>${CITY_WORLD.roads.map((r) => safe(r.name)).join(' · ')}</p></article>`;
  }
  function interact() {
    if (training) {
      const e = world.enemies[0];
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
      strikes.clear();
      effects.length = 0;
      zone = portal.targetZone;
      world = createWorld(scene, zone);
      prepare();
      notify(`Entraste en ${zone}.`);
    } else notify('Acércate a un lugar del mapa o al boticario.');
  }
  async function consume(item: 'potions' | 'mana') {
    if (busy || !progress[item] || performance.now() < consumeAt || (!training && !session)) return;
    if ((item === 'potions' && health >= maxHealth()) || (item === 'mana' && mana >= 100)) {
      notify('Ya estás al máximo.');
      return;
    }
    busy = true;
    try {
      if (training) progress[item]--;
      else await request({ action: 'consume', item });
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
      if (button.dataset.menu === 'exit') exit();
      else if (button.dataset.menu === 'equipment') equipment();
      else if (button.dataset.menu === 'map') cityMap();
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
  function reset() {
    pressed.clear();
    pointer = null;
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
      model.position.addScaledVector(direction, dt * (4 + stats().spd * 0.08));
      const limit = world.groundSize / 2 - 3;
      model.position.x = Math.max(-limit, Math.min(limit, model.position.x));
      model.position.z = Math.max(-limit, Math.min(limit, model.position.z));
      if (direction.length() > 0.05) model.rotation.y = Math.atan2(direction.x, direction.z);
      model.position.y = direction.length() > 0.05 ? Math.abs(Math.sin(now * 0.012)) * 0.08 : 0;
      mana = Math.min(100, mana + dt * 4);
      world.enemies.forEach((enemy) => {
        if (!enemy.alive) {
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
        if (distance < 10 && distance > 1.5) {
          const chase = model.position.clone().sub(enemy.mesh.position).setY(0).normalize();
          enemy.mesh.position.addScaledVector(chase, dt * enemy.speed);
          enemy.mesh.rotation.y = Math.atan2(chase.x, chase.z);
        }
        if (distance < 1.9 && now > (strikes.get(enemy) || 0)) {
          strikes.set(enemy, now + 1400);
          health -= Math.max(1, enemy.damage - stats().def * 0.3) * (now < shield ? 0.25 : 1);
          burst(model.position);
        }
        enemy.hpBar.scale.x = Math.max(0.001, enemy.health / enemy.maxHealth);
      });
      if (health <= 0) {
        health = maxHealth();
        mana = 100;
        const start = zoneConfig(zone).playerStart;
        model.position.set(start.x, 0, start.z);
        world.enemies.forEach((e) => e.mesh.position.copy(e.spawnPosition));
        notify('Volviste al punto seguro. Conservas tu equipo y monedas.');
      }
    }
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
    camera.position.set(model.position.x, 8.5, model.position.z + 10);
    camera.lookAt(model.position.x, 0.7, model.position.z - 1.5);
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
      root.querySelector('.world-zone')!.textContent =
        Math.hypot(model.position.x, model.position.z) < 12
          ? 'Parque Central'
          : biomeAt(model.position.x, model.position.z).name;
    root.querySelector('.world-level')!.textContent = `Nivel ${pet.level} · ${pet.xp} XP`;
    root.querySelector('.world-coins')!.textContent = training
      ? 'Modo práctica'
      : `◈ ${progress.coins} monedas · ${progress.kills} derrotados`;
    for (const item of ['potions', 'mana'] as const) {
      const button = root.querySelector<HTMLButtonElement>(`[data-use="${item}"]`)!;
      button.querySelector('small')!.textContent = `× ${progress[item]}`;
      button.disabled = !progress[item] || busy;
    }
    for (let i = 0; i < 4; i++) {
      const button = root.querySelector<HTMLButtonElement>(`[data-power="${i}"]`)!;
      const remaining = Math.max(0, cooldown[i] - now);
      button.querySelector('em')!.textContent = remaining ? `${Math.ceil(remaining / 1000)}s` : '';
      button.disabled = remaining > 0 || mana < skills[i].energyCost || busy;
    }
    const enemy = target(12);
    root.querySelector('.world-target')!.textContent = enemy
      ? `${enemy.name} · ${Math.ceil(enemy.health)} / ${enemy.maxHealth} ❤️`
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
