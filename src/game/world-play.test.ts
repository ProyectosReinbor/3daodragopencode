import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStarterCharacter } from './characters';
import { mountWorldPlay } from './world-play';
import { createProfile } from './profile';
import { initialWorldProgress } from '../../shared/world-items.js';
import { startAdventure } from '../../shared/world-adventure.js';
import { CITY_BUILDINGS, CITY_VENUES } from '../../shared/city-life.js';
import { CITY_WORLD } from '../../shared/city-world.js';
import type { Enemy } from './world';

const rendered = vi.hoisted(() => ({ x: 0, y: 0, z: 0, disposed: false }));
const roomControl = vi.hoisted(() => ({ entrance: false }));
const battleControl = vi.hoisted(() => ({ enemy: null as Enemy | null }));
vi.mock('./world', async () => {
  const actual = await vi.importActual<typeof import('./world')>('./world');
  return {
    ...actual,
    createWorld: (...args: Parameters<typeof actual.createWorld>) => {
      const world = actual.createWorld(...args);
      battleControl.enemy = world.enemies[0];
      return world;
    },
  };
});
vi.mock('./city-life', async () => {
  const actual = await vi.importActual<typeof import('./city-life')>('./city-life');
  return {
    ...actual,
    nearbyCityEntrance: (position: import('three').Vector3) =>
      roomControl.entrance
        ? CITY_BUILDINGS.find((b) => b.id === CITY_VENUES[0].buildingId)
        : actual.nearbyCityEntrance(position),
  };
});
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    WebGLRenderer: class {
      setPixelRatio() {}
      setSize() {}
      render(_scene: unknown, camera: { position: { x: number; y: number; z: number } }) {
        rendered.x = camera.position.x;
        rendered.y = camera.position.y;
        rendered.z = camera.position.z;
      }
      dispose() {
        rendered.disposed = true;
      }
    },
  };
});

describe('full screen world controls', () => {
  let frame: FrameRequestCallback;
  let stop: () => void;
  let now: number;
  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    rendered.disposed = false;
    roomControl.entrance = false;
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const pet = createStarterCharacter();
    // The control test needs a known damage budget, independent of random starter stats.
    pet.baseStats = { atk: 6, def: 5, spd: 6, hp: 6, ability: 5 };
    pet.powers = ['fireball', 'heal_wave'];
    stop = mountWorldPlay({ pet, onExit: vi.fn() });
  });
  afterEach(() => {
    stop();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function tick() {
    now += 50;
    frame(now);
  }
  function key(value: string) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: value, cancelable: true }));
  }
  it('keeps the chosen camera angle and moves keys and joystick relative to the view', () => {
    tick();
    const canvas = document.querySelector('canvas')!;
    const point = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: 7 });
      canvas.dispatchEvent(event);
    };
    const initial = { x: rendered.x, z: rendered.z };
    point('pointerdown', 100, 100);
    point('pointermove', 100 + Math.PI / 2 / 0.006, 100);
    point('pointerup', 100 + Math.PI / 2 / 0.006, 100);
    tick();
    expect(Math.abs(rendered.x - initial.x)).toBeGreaterThan(5);
    const idle = { x: rendered.x, z: rendered.z };
    tick();
    expect(rendered.x).toBe(idle.x);
    expect(rendered.z).toBe(idle.z);
    key('ArrowRight');
    tick();
    expect(rendered.x).toBeCloseTo(idle.x, 6);
    expect(rendered.z).toBeGreaterThan(idle.z);
    for (let i = 0; i < 39; i++) tick();
    expect(rendered.x).toBeCloseTo(idle.x, 6);
    expect(rendered.z).toBeGreaterThan(idle.z + 5);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    const stopped = { x: rendered.x, z: rendered.z };
    tick();
    expect(rendered.x).toBe(stopped.x);
    expect(rendered.z).toBe(stopped.z);
    const joystick = document.querySelector<HTMLElement>('.world-joystick')!;
    vi.spyOn(joystick, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
    } as DOMRect);
    joystick.setPointerCapture = vi.fn();
    const touch = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: 9 });
      joystick.dispatchEvent(event);
    };
    touch('pointerdown', 164, 100);
    tick();
    expect(rendered.x).toBeCloseTo(stopped.x, 6);
    expect(rendered.z).toBeGreaterThan(stopped.z);
    const right = { x: rendered.x, z: rendered.z };
    touch('pointermove', 100, 36);
    tick();
    expect(rendered.x).toBeGreaterThan(right.x);
    expect(rendered.z).toBeCloseTo(right.z, 6);
    touch('pointerup', 100, 36);
  });
  it('opens the forge nearby and sends crafting and quest actions through the session API', async () => {
    stop();
    const pet = createStarterCharacter();
    const profile = createProfile(pet);
    profile.world = initialWorldProgress();
    profile.world.materials = { mineral: 4, madera: 2 };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session: 'qa-world', profile, reward: { item: 'explorer_blade' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    const settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    await settle();
    document.querySelector<HTMLButtonElement>('[data-minimap]')!.click();
    const map = document.querySelector<SVGSVGElement>('[data-city-map]')!;
    expect(map).not.toBeNull();
    expect(document.querySelector('[data-map-roads]')!.innerHTML).toContain('polyline');
    expect(
      document.querySelector('a[href="https://www.openstreetmap.org/copyright"]')
    ).not.toBeNull();
    document.querySelector<HTMLButtonElement>('[data-map-control="in"]')!.click();
    expect(map.getAttribute('viewBox')!.split(' ')[2]).toBe('3000');
    document.querySelector<HTMLButtonElement>('[data-map-control="all"]')!.click();
    expect(Number(map.getAttribute('viewBox')!.split(' ')[2])).toBeGreaterThan(24000);
    document.querySelector<HTMLButtonElement>('[data-map-place="viva"]')!.click();
    expect(map.getAttribute('viewBox')!.split(' ')[2]).toBe('2000');
    document.querySelector<HTMLButtonElement>('[data-close]')!.click();
    key('ArrowDown');
    tick();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
    key('f');
    expect(document.querySelector('[aria-label="Forja"]')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('[data-craft="hoja"]')!.click();
    await settle();
    const crafting = JSON.parse(fetchMock.mock.lastCall![1].body);
    expect(crafting.action).toBe('craft');
    expect(crafting.session).toBe('qa-world');
    expect(crafting.position.z).toBeGreaterThan(0);
    document.querySelector<HTMLButtonElement>('[data-close]')!.click();
    document.querySelector<HTMLButtonElement>('[data-menu="quests"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-quest="supplies"]')!.click();
    await settle();
    expect(JSON.parse(fetchMock.mock.lastCall![1].body).action).toBe('accept_quest');
  }, 20000);
  it('enters a business, changes floors, visits the terrace and returns to the street', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ session: 'room-qa', profile }) })
    );
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    roomControl.entrance = true;
    key('f');
    roomControl.entrance = false;
    expect(document.querySelector('.world-building-bar')!.textContent).toContain(
      CITY_VENUES[0].name
    );
    document.querySelector<HTMLButtonElement>('[data-room-action="floors"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-room-level="3"]')!.click();
    tick();
    expect(rendered.y).toBeGreaterThan(12);
    expect(document.querySelector('.world-building-bar')!.textContent).toContain('Piso 4');
    document.querySelector<HTMLButtonElement>('[data-room-action="floors"]')!.click();
    document
      .querySelector<HTMLButtonElement>(`[data-room-level="${CITY_VENUES[0].floors}"]`)!
      .click();
    tick();
    expect(document.querySelector('.world-building-bar')!.textContent).toContain('Terraza');
    expect(rendered.y).toBeGreaterThan(20);
    document.querySelector<HTMLButtonElement>('[data-room-action="exit"]')!.click();
    tick();
    expect((document.querySelector('.world-building-bar') as HTMLElement).hidden).toBe(true);
    expect(rendered.y).toBeLessThan(10);
  });
  it('guides the player to Ari and resumes a server-saved first adventure', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.action === 'adventure_start') startAdventure(profile.world!, body.position);
      return {
        ok: true,
        json: async () => ({ session: 'adventure-qa', profile: structuredClone(profile) }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    await settle();
    tick();
    const tracker = document.querySelector<HTMLButtonElement>(
      '[aria-label="Ver primera aventura"]'
    )!;
    expect(tracker.textContent).toContain('Tu primera aventura');
    expect(
      document.querySelector<HTMLElement>('.world-adventure-arrow')!.style.transform
    ).toContain('-45');
    key('ArrowLeft');
    key('ArrowUp');
    for (let i = 0; i < 10; i++) tick();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
    tracker.click();
    document.querySelector<HTMLButtonElement>('[data-adventure="start"]')!.click();
    await settle();
    expect(profile.world?.adventure?.stage).toBe(0);
    expect(document.querySelector('[aria-label="Primera aventura"]')!.textContent).toContain(
      'Reúne tus provisiones'
    );
    expect(JSON.parse(fetchMock.mock.lastCall![1].body as string).position.x).toBeLessThan(0);
    stop();
    stop = mountWorldPlay({ pet, profile: structuredClone(profile), onExit: vi.fn() });
    await settle();
    tick();
    expect(document.querySelector('[aria-label="Ver primera aventura"]')!.textContent).toContain(
      'Reúne tus provisiones'
    );
  });
  it('follows a chosen map destination and restores the adventure when cancelled', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ session: 'navigation-qa', profile }) })
    );
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    tick();
    document.querySelector<HTMLButtonElement>('[data-minimap]')!.click();
    const venue = CITY_VENUES[0];
    document.querySelector<HTMLButtonElement>(`[data-map-place="${venue.id}"]`)!.click();
    expect(document.querySelector('[data-map-selection]')!.textContent).toContain(venue.name);
    document.querySelector<HTMLButtonElement>('[data-follow-place]')!.click();
    tick();
    const tracker = document.querySelector<HTMLButtonElement>(
      '[aria-label="Ver destino en el mapa"]'
    )!;
    expect(tracker.textContent).toContain(venue.name);
    expect(tracker.textContent).toContain('línea recta');
    expect(document.querySelector('[data-adventure-pin]')!.getAttribute('cx')).toBe(
      String(venue.x)
    );
    tracker.click();
    expect(document.querySelector('[data-waypoint-line]')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('[data-clear-waypoint]')!.click();
    tick();
    expect(document.querySelector('[aria-label="Ver primera aventura"]')!.textContent).toContain(
      'Tu primera aventura'
    );
    expect(document.querySelector('[data-waypoint-line]')).toBeNull();
    const node = CITY_WORLD.nodes[0];
    document.querySelector<HTMLButtonElement>(`[data-map-place="${node.id}"]`)!.click();
    document.querySelector<HTMLButtonElement>('[data-follow-place]')!.click();
    tick();
    expect(document.querySelector('[aria-label="Ver destino en el mapa"]')!.textContent).toContain(
      node.name
    );
  }, 20000);
  it('filters quest states and guides an active crafting mission to the forge', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    profile.world.acceptedQuests = ['supplies', 'artisan', 'patrol'];
    profile.world.claimedQuests = ['patrol'];
    profile.world.gathered = 6;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ session: 'journal-qa', profile }) })
    );
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    document.querySelector<HTMLButtonElement>('[data-menu="quests"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-quest-filter="ready"]')!.click();
    expect(document.querySelectorAll('.world-quest-card')).toHaveLength(1);
    expect(document.querySelector('.world-quest-card')!.textContent).toContain(
      'Provisiones del camino'
    );
    expect(
      document.querySelector('[data-quest="supplies"]')!.getAttribute('data-quest-action')
    ).toBe('claim_quest');
    document.querySelector<HTMLButtonElement>('[data-quest-filter="completed"]')!.click();
    expect(document.querySelector('.world-quest-card')!.textContent).toContain(
      'Recompensa cobrada'
    );
    expect(document.querySelector<HTMLButtonElement>('[data-quest="patrol"]')!.disabled).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-quest-filter="active"]')!.click();
    expect(document.querySelectorAll('.world-quest-card')).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('[data-quest-location="artisan"]')!.click();
    expect(document.querySelector('[data-map-selection]')!.textContent).toContain(
      'Forja del campamento'
    );
    document.querySelector<HTMLButtonElement>('[data-follow-place="camp-forge"]')!.click();
    tick();
    // The camp forge is already within the arrival radius of the spawn.
    expect(document.querySelector('.world-notice')!.textContent).toContain(
      'Llegaste a Forja del campamento'
    );
    expect(document.querySelector('[aria-label="Ver primera aventura"]')).not.toBeNull();
    expect(profile.world.claimedQuests).toEqual(['patrol']);
  }, 20000);
  it('previews equipment locally and only applies a replacement after the server accepts it', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    pet.baseStats = { atk: 6, def: 5, spd: 6, hp: 6, ability: 5 };
    profile.world = initialWorldProgress();
    profile.world.items = ['fang', 'heart', 'aurora_gem'];
    profile.world.equipped[pet.id] = { relic: 'heart' };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.action === 'equip') profile.world!.equipped[pet.id].relic = body.item;
      return {
        ok: true,
        json: async () => ({ session: 'equipment-qa', profile: structuredClone(profile) }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    const settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    await settle();
    document.querySelector<HTMLButtonElement>('[data-menu="equipment"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-equipment-filter="relic"]')!.click();
    expect(document.querySelector('[data-equip="fang"]')).toBeNull();
    const callsBeforePreview = fetchMock.mock.calls.length;
    document.querySelector<HTMLButtonElement>('[data-preview-item="aurora_gem"]')!.click();
    const comparison = document.querySelector('[aria-label="Comparación de equipo"]')!;
    expect(comparison.textContent).toContain('Corazón de piedra');
    expect(comparison.textContent).toContain('(-6)');
    expect(comparison.textContent).toContain('(+10)');
    expect(fetchMock.mock.calls.length).toBe(callsBeforePreview);
    expect(profile.world.equipped[pet.id].relic).toBe('heart');
    document.querySelector<HTMLButtonElement>('[data-equip="aurora_gem"]')!.click();
    await settle();
    expect(JSON.parse(fetchMock.mock.lastCall![1].body as string).action).toBe('equip');
    expect(document.querySelector<HTMLButtonElement>('[data-equip="aurora_gem"]')!.disabled).toBe(
      true
    );
    expect(document.querySelector<HTMLButtonElement>('[data-equip="heart"]')!.disabled).toBe(false);
    expect(document.querySelector('[aria-label="Comparación de equipo"]')!.textContent).toContain(
      '(0)'
    );
    tick();
    expect(document.querySelector('.world-health')!.textContent).toContain('/ 148');
  }, 20000);
  it('shows recipe shortages and finds an available source of the missing material', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    profile.world.materials = { mineral: 3, madera: 2 };
    profile.world.resourceCooldowns = { 'starter-ore': Date.now() + 60000 };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ session: 'forge-plan-qa', profile }) });
    vi.stubGlobal('fetch', fetchMock);
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    key('ArrowDown');
    tick();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
    key('f');
    const recipe = document.querySelector('[data-recipe="hoja"]')!;
    expect(recipe.textContent).toContain('Faltan 1');
    expect(recipe.textContent).toContain('Al equipar');
    expect(recipe.querySelector<HTMLButtonElement>('[data-craft="hoja"]')!.disabled).toBe(true);
    expect(recipe.querySelector('[data-material-location="madera"]')).toBeNull();
    const requests = fetchMock.mock.calls.length;
    recipe.querySelector<HTMLButtonElement>('[data-material-location="mineral"]')!.click();
    const selected =
      document.querySelector<HTMLButtonElement>('[data-follow-place]')!.dataset.followPlace;
    const node = CITY_WORLD.nodes.find((n) => n.id === selected)!;
    expect(node.material).toBe('mineral');
    expect(node.id).not.toBe('starter-ore');
    expect(fetchMock.mock.calls.length).toBe(requests);
    expect(profile.world.materials.mineral).toBe(3);
  }, 20000);
  it('records only confirmed rewards and announces a server-confirmed level increase', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    pet.level = 1;
    profile.world = initialWorldProgress();
    profile.world.acceptedQuests = ['supplies'];
    profile.world.gathered = 6;
    let rejectClaim = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        if (body.action === 'claim_quest') {
          if (rejectClaim) return { ok: false, json: async () => ({ error: 'Prueba de error' }) };
          profile.characters!.characters.find((p) => p.id === pet.id)!.level = 2;
          profile.world!.claimedQuests = ['supplies'];
          return {
            ok: true,
            json: async () => ({
              profile: structuredClone(profile),
              reward: { coins: 35, xp: 30 },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ session: 'rewards-qa', profile: structuredClone(profile) }),
        };
      })
    );
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    const settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    await settle();
    document.querySelector<HTMLButtonElement>('[data-menu="rewards"]')!.click();
    expect(document.querySelector('[aria-label="Historial de botín"]')!.textContent).toContain(
      'Aún no'
    );
    document.querySelector<HTMLButtonElement>('[data-close]')!.click();
    document.querySelector<HTMLButtonElement>('[data-menu="quests"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-quest="supplies"]')!.click();
    await settle();
    expect(document.querySelector('[data-menu="rewards"]')!.textContent).toBe('Botín · 0');
    rejectClaim = false;
    document.querySelector<HTMLButtonElement>('[data-quest="supplies"]')!.click();
    await settle();
    tick();
    expect(document.querySelector('.world-level-up')!.textContent).toContain('nivel 2');
    document.querySelector<HTMLButtonElement>('[data-menu="rewards"]')!.click();
    expect(document.querySelectorAll('.world-reward-entry')).toHaveLength(1);
    expect(document.querySelector('.world-reward-entry')!.textContent).toContain('+35 monedas');
    expect(document.querySelector('.world-reward-entry')!.textContent).toContain('+30 XP');
  }, 20000);
  it('updates resource cooldown labels in the open map without sending requests', async () => {
    stop();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000000);
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    profile.world.resourceCooldowns = { 'starter-wood': 1060000 };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ session: 'resources-qa', profile }) });
    vi.stubGlobal('fetch', fetchMock);
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    document.querySelector<HTMLButtonElement>('[data-minimap]')!.click();
    tick();
    expect(document.querySelector('[data-resource-status="starter-wood"]')!.textContent).toBe(
      'Reaparece en 60 s'
    );
    expect(document.querySelector('[data-resource-status="starter-ore"]')!.textContent).toBe(
      'Disponible'
    );
    const requests = fetchMock.mock.calls.length;
    clock.mockReturnValue(1060000);
    for (let i = 0; i < 6; i++) tick();
    expect(document.querySelector('[data-resource-status="starter-wood"]')!.textContent).toBe(
      'Disponible'
    );
    expect(fetchMock.mock.calls.length).toBe(requests);
    document.querySelector<HTMLButtonElement>('[data-close]')!.click();
    key('ArrowDown');
    tick();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown' }));
    expect(document.querySelector('.world-interact')!.textContent).toContain('Craftear');
  }, 20000);
  it('warns before an enemy strike and allows moving out of the marked area', () => {
    const enemy = battleControl.enemy!;
    enemy.mesh.position.set(0, 0, 1.7);
    enemy.speed = 0;
    tick();
    const before = document.querySelector('.world-health')!.textContent;
    const danger = document.querySelector<HTMLElement>('.world-danger')!;
    expect(danger.hidden).toBe(false);
    expect(document.querySelector('.world-target')!.textContent).toContain('Preparando ataque');
    for (let i = 0; i < 5; i++) tick();
    key('ArrowRight');
    for (let i = 0; i < 18; i++) tick();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    expect(document.querySelector('.world-health')!.textContent).toBe(before);
    expect(danger.hidden).toBe(true);
  });
  it('shows a defeat screen and recovers with temporary protection', () => {
    const enemy = battleControl.enemy!;
    enemy.mesh.position.set(0, 0, 1.7);
    enemy.speed = 0;
    enemy.damage = 1000;
    tick();
    for (let i = 0; i < 14; i++) tick();
    expect(document.querySelector('[aria-label="Mascota derrotada"]')).not.toBeNull();
    expect(document.querySelector('.world-health')!.textContent).toContain('Vida 0');
    document.querySelector<HTMLButtonElement>('[data-menu="equipment"]')!.click();
    expect(document.querySelector('[data-recover]')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('[data-recover]')!.click();
    tick();
    expect(document.querySelector('[aria-label="Mascota derrotada"]')).toBeNull();
    expect(document.querySelector('.world-health')!.textContent).toContain('148 / 148');
    enemy.mesh.position.set(0, 0, 1.7);
    for (let i = 0; i < 50; i++) tick();
    expect(document.querySelector('.world-health')!.textContent).toContain('148 / 148');
    for (let i = 0; i < 80; i++) tick();
    expect(document.querySelector('[aria-label="Mascota derrotada"]')).not.toBeNull();
  });
  it('cancels a pending strike when a menu pauses the game', () => {
    const enemy = battleControl.enemy!;
    enemy.mesh.position.set(0, 0, 1.7);
    enemy.speed = 0;
    enemy.damage = 1000;
    tick();
    expect((document.querySelector('.world-danger') as HTMLElement).hidden).toBe(false);
    document.querySelector<HTMLButtonElement>('[data-menu="equipment"]')!.click();
    for (let i = 0; i < 30; i++) tick();
    expect((document.querySelector('.world-danger') as HTMLElement).hidden).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-close]')!.click();
    tick();
    expect(document.querySelector('[aria-label="Mascota derrotada"]')).toBeNull();
    expect(document.querySelector('.world-health')!.textContent).toContain('148 / 148');
  });
  it('W casts a power without walking and arrow keys move the pet', () => {
    tick();
    const before = rendered.z;
    key('w');
    tick();
    expect(rendered.z).toBe(before);
    expect(document.querySelector('.world-mana')!.textContent).not.toContain('100 / 100');
    key('ArrowUp');
    tick();
    expect(rendered.z).toBeLessThan(before);
    window.dispatchEvent(new Event('blur'));
    const after = rendered.z;
    tick();
    expect(rendered.z).toBe(after);
  });
  it('R defeats the practice enemy, reset restores it, and exit releases controls', () => {
    key('r');
    tick();
    expect(document.querySelector('.world-notice')!.textContent).toContain('Rival derrotado');
    expect(document.querySelector('.world-target')!.textContent).toBe('');
    key('f');
    tick();
    expect(document.querySelector('.world-target')!.textContent).toContain('80 / 80');
    stop();
    expect(document.querySelector('.foodie-world')).toBeNull();
    expect(rendered.disposed).toBe(true);
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
