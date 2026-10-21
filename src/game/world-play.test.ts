import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStarterCharacter } from './characters';
import { mountWorldPlay } from './world-play';
import { createProfile } from './profile';
import { initialWorldProgress } from '../../shared/world-items.js';
import { startAdventure } from '../../shared/world-adventure.js';
import { CITY_BUILDINGS, CITY_VENUES } from '../../shared/city-life.js';
import { CITY_WORLD } from '../../shared/city-world.js';
import { WORLD_CAMPS } from '../../shared/world-camps.js';
import { visitVenue } from '../../shared/world-passport.js';
import { buyConsumables } from '../../shared/world-shop.js';
import type { Enemy } from './world';
import { Raycaster } from 'three';

const rendered = vi.hoisted(() => ({ x: 0, y: 0, z: 0, disposed: false, pixelRatio: 1 }));
const roomControl = vi.hoisted(() => ({ entrance: false }));
const battleControl = vi.hoisted(() => ({ enemy: null as Enemy | null, enemies: [] as Enemy[] }));
const cityControl = vi.hoisted(() => ({ enemies: [] as Enemy[] }));
vi.mock('./city-world', async () => {
  const actual = await vi.importActual<typeof import('./city-world')>('./city-world');
  return {
    ...actual,
    createCityWorld: (...args: Parameters<typeof actual.createCityWorld>) => {
      const world = actual.createCityWorld(...args);
      cityControl.enemies = world.enemies;
      return world;
    },
  };
});
vi.mock('./world', async () => {
  const actual = await vi.importActual<typeof import('./world')>('./world');
  return {
    ...actual,
    createWorld: (...args: Parameters<typeof actual.createWorld>) => {
      const world = actual.createWorld(...args);
      battleControl.enemy = world.enemies[0];
      battleControl.enemies = world.enemies;
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
      setPixelRatio(value: number) {
        rendered.pixelRatio = value;
      }
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
    localStorage.removeItem('reinos-ancestrales-quality-v1');
  });
  function tick() {
    now += 50;
    frame(now);
  }
  function key(value: string) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: value, cancelable: true }));
  }
  it('restores enemy health, respawn and action cooldowns from the server on entry', async () => {
    stop();
    const pet = createStarterCharacter();
    const profile = createProfile(pet);
    profile.world = initialWorldProgress();
    profile.world.combat = {
      cooldowns: { '0': 105000, '-1': 100450, potions: 101500 },
      encounters: { 'city:0': { kind: 'wolf', health: 0, nextSpawn: 120000 } },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ session: 'restored-qa', profile, serverNow: 100000 }),
      })
    );
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    await vi.waitFor(() => expect(cityControl.enemies[0]?.alive).toBe(false));
    expect(cityControl.enemies[0]?.health).toBe(0);
    expect(cityControl.enemies[0]?.mesh.visible).toBe(false);
    tick();
    expect(document.querySelector<HTMLButtonElement>('[data-power="0"]')?.disabled).toBe(true);
    now = 21001;
    tick();
    expect(cityControl.enemies[0]?.alive).toBe(true);
    expect(cityControl.enemies[0]?.health).toBe(cityControl.enemies[0]?.maxHealth);
  });
  it('moves and turns with a gamepad and clears input on disconnect and focus loss', () => {
    const pad = {
      index: 0,
      id: 'qa-pad',
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    };
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    tick();
    const initial = rendered.z;
    pad.axes[1] = -1;
    tick();
    expect(rendered.z).toBeLessThan(initial);
    pad.axes[1] = 0;
    const before = { x: rendered.x, z: rendered.z };
    pad.axes[2] = 1;
    tick();
    expect(rendered.x).not.toBe(before.x);
    pad.axes[2] = 0;
    pad.connected = false;
    const disconnected = { x: rendered.x, z: rendered.z };
    pad.axes[1] = -1;
    tick();
    expect(rendered.x).toBe(disconnected.x);
    expect(rendered.z).toBe(disconnected.z);
    pad.connected = true;
    tick();
    expect(rendered.z).toBe(disconnected.z);
    pad.axes[1] = 0;
    tick();
    pad.axes[1] = -1;
    tick();
    expect(rendered.z).toBeLessThan(disconnected.z);
    window.dispatchEvent(new Event('blur'));
    tick();
    const paused = rendered.z;
    window.dispatchEvent(new Event('focus'));
    tick();
    expect(rendered.z).toBe(paused);
    pad.axes[1] = 0;
    tick();
    pad.axes[1] = -1;
    tick();
    expect(rendered.z).toBeLessThan(paused);
  });
  it('opens gamepad help from the controller menu and confirms without attacking behind panels', () => {
    const pad = {
      index: 0,
      id: 'qa-pad',
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    };
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    tick();
    const press = (index: number) => {
      pad.buttons[index].pressed = true;
      tick();
      pad.buttons[index].pressed = false;
      tick();
    };
    press(9);
    expect(document.querySelector<HTMLDetailsElement>('.world-tools')!.open).toBe(true);
    const help = document.querySelector<HTMLButtonElement>('[data-menu="gamepad"]')!;
    expect(help.textContent).toContain('conectado');
    help.focus();
    press(0);
    expect(document.querySelector('[aria-label="Jugar con mando"]')).not.toBeNull();
    expect(document.querySelector('.world-target')!.textContent).toContain('80 / 80');
    press(1);
    expect(document.querySelector<HTMLElement>('.world-modal')!.hidden).toBe(true);
    press(3);
    expect(document.querySelector('.world-notice')!.textContent).toContain('Rival derrotado');
    press(2);
    expect(document.querySelector('.world-target')!.textContent).toContain('80 / 80');
    press(1);
    press(7);
    expect(document.querySelector('[data-use="mana"]')!.textContent).toContain('× 2');
  });
  it('explains consumable availability and shows recovery only after use', async () => {
    tick();
    const manaButton = document.querySelector<HTMLButtonElement>('[data-use="mana"]')!;
    expect(manaButton.disabled).toBe(true);
    expect(manaButton.textContent).toContain('Al máximo');
    key('e');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    tick();
    expect(manaButton.disabled).toBe(false);
    expect(manaButton.dataset.state).toBe('ready');
    manaButton.click();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    tick();
    expect(manaButton.textContent).toContain('× 2');
    expect(manaButton.dataset.state).toBe('cooldown');
    expect(manaButton.getAttribute('aria-label')).toContain('Espera');
    expect(document.querySelector('.world-mana')!.classList.contains('world-restoring')).toBe(true);
    for (let i = 0; i < 31; i++) tick();
    expect(manaButton.dataset.state).toBe('full');
    expect(document.querySelector('.world-mana')!.classList.contains('world-restoring')).toBe(
      false
    );
    expect(document.querySelector('[data-use="potions"]')!.textContent).toContain('× 3');
  });
  it('keeps consumables and recovery feedback unchanged when the API rejects use', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        return body.action === 'consume'
          ? { ok: false, json: async () => ({ error: 'No se pudo usar el elixir.' }) }
          : {
              ok: true,
              json: async () => ({ session: 'consume-qa', profile: structuredClone(profile) }),
            };
      })
    );
    const settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    await settle();
    key('e');
    await settle();
    tick();
    const button = document.querySelector<HTMLButtonElement>('[data-use="mana"]')!;
    const before = document.querySelector('.world-mana')!.textContent;
    button.click();
    await settle();
    tick();
    expect(button.dataset.state).toBe('ready');
    expect(button.textContent).toContain('× 3');
    expect(document.querySelector('.world-mana')!.textContent).toBe(before);
    expect(document.querySelector('.world-mana')!.classList.contains('world-restoring')).toBe(
      false
    );
    expect(document.querySelector('.world-notice')!.textContent).toContain('No se pudo usar');
  }, 20000);
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
  it('applies graphics presets immediately and restores the chosen mode on the next visit', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    document.querySelector<HTMLButtonElement>('[data-menu="graphics"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-graphics="low"]')!.click();
    expect(rendered.pixelRatio).toBe(0.8);
    expect(document.querySelector('[data-graphics="low"]')!.getAttribute('aria-pressed')).toBe(
      'true'
    );
    document.querySelector<HTMLButtonElement>('[data-close]')!.click();
    stop();
    stop = mountWorldPlay({ pet: createStarterCharacter(), onExit: vi.fn() });
    expect(rendered.pixelRatio).toBe(0.8);
    document.querySelector<HTMLButtonElement>('[data-menu="graphics"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-graphics="high"]')!.click();
    expect(rendered.pixelRatio).toBe(1.35);
    expect(document.querySelector('[data-graphics="high"]')!.getAttribute('aria-pressed')).toBe(
      'true'
    );
  });
  it('starts at the server-saved beacon and distinguishes it from real map landmarks', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet),
      camp = WORLD_CAMPS[0];
    profile.world = initialWorldProgress();
    profile.world.campId = camp.id;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ session: 'camp-qa', profile }) })
    );
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    tick();
    expect(rendered.x).toBeCloseTo(camp.x);
    document.querySelector<HTMLButtonElement>('[data-minimap]')!.click();
    const button = document.querySelector<HTMLButtonElement>(`[data-map-place="${camp.id}"]`)!;
    expect(button.parentElement!.textContent).toContain('Activo');
    button.click();
    expect(document.querySelector('[data-map-selection]')!.textContent).toContain(camp.name);
    expect(
      document.querySelector<HTMLButtonElement>('[data-follow-place]')!.dataset.followPlace
    ).toBe(camp.id);
  }, 20000);
  it('shows confirmed species counts and locates a real monster encounter without granting rewards', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    profile.world.monsterKills = { wolf: 3 };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ session: 'bestiary-qa', profile }) });
    vi.stubGlobal('fetch', fetchMock);
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    document.querySelector<HTMLButtonElement>('[data-menu="bestiary"]')!.click();
    expect(document.querySelectorAll('.world-monster-guide')).toHaveLength(4);
    expect(document.querySelector('.world-monster-guide')!.textContent).toContain(
      'Derrotas registradas: 3'
    );
    const requests = fetchMock.mock.calls.length;
    document.querySelector<HTMLButtonElement>('[data-find-monster="golem"]')!.click();
    expect(document.querySelector('[data-map-selection]')!.textContent).toContain('Gólem');
    expect(document.querySelector('[data-selected-place]')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('[data-follow-place="monster-golem"]')!.click();
    tick();
    expect(document.querySelector('[aria-label="Ver destino en el mapa"]')!.textContent).toContain(
      'Gólem'
    );
    expect(fetchMock.mock.calls.length).toBe(requests);
    expect(profile.world.monsterKills.wolf).toBe(3);
  }, 20000);
  it('shows saved materials and recipe costs and locates sources without spending resources', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = { ...initialWorldProgress(), materials: { madera: 7, mineral: 4 } };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ session: 'materials-qa', profile: structuredClone(profile) }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const before = structuredClone(profile.world),
      requests = fetchMock.mock.calls.length;
    document.querySelector<HTMLButtonElement>('[data-menu="materials"]')!.click();
    expect(document.querySelectorAll('[data-material-card]')).toHaveLength(5);
    expect(document.querySelector('[data-material-card="madera"]')!.textContent).toContain(
      'Madera · 7'
    );
    expect(document.querySelector('[data-material-card="madera"]')!.textContent).toContain(
      'Hoja del explorador: 2 necesarios'
    );
    expect(document.querySelector('[data-material-card="cristal"]')!.textContent).toContain(
      'Cristal de nieve · 0'
    );
    document.querySelector<HTMLButtonElement>('[data-material-location="madera"]')!.click();
    expect(document.querySelector('[data-city-map]')).not.toBeNull();
    expect(document.querySelector('[data-follow-place]')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('[data-menu="materials"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-material-forge]')!.click();
    expect(document.querySelector('[data-follow-place="camp-forge"]')).not.toBeNull();
    expect(fetchMock.mock.calls.length).toBe(requests);
    expect(profile.world).toEqual(before);
  }, 20000);
  it('previews shop bundles and refreshes stock only after a confirmed purchase', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.action === 'buy') buyConsumables(profile.world!, body.item, body.quantity);
      return {
        ok: true,
        json: async () => ({ session: 'shop-qa', profile: structuredClone(profile) }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    await settle();
    roomControl.entrance = true;
    key('f');
    roomControl.entrance = false;
    document.querySelector<HTMLButtonElement>('[data-room-action="shop"]')!.click();
    const requests = fetchMock.mock.calls.length;
    document.querySelector<HTMLButtonElement>('[data-shop-quantity="3"]')!.click();
    expect(fetchMock.mock.calls.length).toBe(requests);
    expect(document.querySelector<HTMLButtonElement>('[data-buy="potions"]')!.disabled).toBe(true);
    expect(document.querySelector('[data-buy="potions"]')!.textContent).toContain(
      'Te faltan 5 monedas'
    );
    document.querySelector<HTMLButtonElement>('[data-buy="mana"]')!.click();
    expect(document.querySelector<HTMLButtonElement>('[data-shop-quantity="1"]')!.disabled).toBe(
      true
    );
    await settle();
    expect(JSON.parse(fetchMock.mock.lastCall![1].body as string)).toMatchObject({
      action: 'buy',
      item: 'mana',
      quantity: 3,
    });
    expect(profile.world.coins).toBe(4);
    expect(document.querySelector('[data-buy="mana"]')!.textContent).toContain('Tienes 6');
    expect(document.querySelector<HTMLButtonElement>('[data-shop-quantity="1"]')!.disabled).toBe(
      false
    );
    expect(document.querySelector<HTMLButtonElement>('[data-buy="mana"]')!.disabled).toBe(true);
  }, 20000);
  it('recovers a lost purchase response after re-entry with the same request ID', async () => {
    stop();
    const pet = createStarterCharacter();
    const profile = createProfile(pet);
    profile.world = initialWorldProgress();
    const receipts = new Set<string>();
    let lostResponse = true;
    const purchaseIds: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        if (body.action === 'buy') {
          purchaseIds.push(body.requestId);
          if (!receipts.has(body.requestId)) {
            buyConsumables(profile.world!, body.item, body.quantity);
            receipts.add(body.requestId);
          }
          if (lostResponse) {
            lostResponse = false;
            throw new Error('Respuesta perdida');
          }
        }
        return {
          ok: true,
          json: async () => ({ session: 'purchase-qa', profile: structuredClone(profile) }),
        };
      })
    );
    const enterShop = async () => {
      stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
      for (let i = 0; i < 8; i++) await Promise.resolve();
      roomControl.entrance = true;
      key('f');
      roomControl.entrance = false;
      document.querySelector<HTMLButtonElement>('[data-room-action="shop"]')!.click();
    };
    await enterShop();
    document.querySelector<HTMLButtonElement>('[data-buy="mana"]')!.click();
    await vi.waitFor(() => expect(document.querySelector('[data-retry-purchase]')).not.toBeNull());
    expect(profile.world.coins).toBe(28);
    stop();
    await enterShop();
    expect(document.querySelector<HTMLButtonElement>('[data-buy="mana"]')!.disabled).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-retry-purchase]')!.click();
    await vi.waitFor(() => expect(document.querySelector('[data-retry-purchase]')).toBeNull());
    expect(purchaseIds).toHaveLength(2);
    expect(purchaseIds[0]).toBe(purchaseIds[1]);
    expect(profile.world.coins).toBe(28);
    expect(profile.world.mana).toBe(4);
  }, 20000);
  it('registers a passport stamp from inside a venue and restores it on a later visit', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const reward =
        body.action === 'visit_venue'
          ? visitVenue(profile.world!, body.venue, body.position)
          : null;
      return {
        ok: true,
        json: async () => ({ session: 'passport-qa', profile: structuredClone(profile), reward }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    await settle();
    roomControl.entrance = true;
    key('f');
    roomControl.entrance = false;
    document.querySelector<HTMLButtonElement>('[data-menu="passport"]')!.click();
    expect(document.querySelectorAll('.world-passport-venue')).toHaveLength(6);
    const venue = CITY_VENUES[0];
    expect(
      document.querySelector<HTMLButtonElement>(`[data-visit-venue="${venue.id}"]`)!.disabled
    ).toBe(false);
    document.querySelector<HTMLButtonElement>(`[data-visit-venue="${venue.id}"]`)!.click();
    await settle();
    expect(profile.world.visitedVenues).toEqual([venue.id]);
    expect(
      document.querySelector<HTMLButtonElement>(`[data-visit-venue="${venue.id}"]`)!.disabled
    ).toBe(true);
    expect(
      document.querySelector<HTMLProgressElement>('[aria-label="Sellos del pasaporte"]')!.value
    ).toBe(1);
    stop();
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    await settle();
    document.querySelector<HTMLButtonElement>('[data-menu="quests"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-menu="passport"]')!.click();
    expect(
      document.querySelector<HTMLProgressElement>('[aria-label="Sellos del pasaporte"]')!.value
    ).toBe(1);
    document.querySelector<HTMLButtonElement>(`[data-find-venue="${CITY_VENUES[1].id}"]`)!.click();
    expect(document.querySelector('[data-map-selection]')!.textContent).toContain(
      CITY_VENUES[1].name
    );
  }, 20000);
  it('opens a local memory game and requests its challenge from the current venue', async () => {
    stop();
    const pet = createStarterCharacter(),
      profile = createProfile(pet);
    profile.world = initialWorldProgress();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      return {
        ok: true,
        json: async () => ({
          session: 'memory-qa',
          profile: structuredClone(profile),
          challenge:
            body.action === 'venue_game_start'
              ? {
                  token: 'qa-memory',
                  venue: body.venue,
                  pattern: [0, 2, 1],
                  issuedAt: Date.now(),
                  readyAt: Date.now() + 3500,
                  expiresAt: Date.now() + 60000,
                }
              : undefined,
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const settle = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    };
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    await settle();
    roomControl.entrance = true;
    key('f');
    roomControl.entrance = false;
    document.querySelector<HTMLButtonElement>('[data-menu="venue-game"]')!.click();
    expect(document.querySelector('[aria-label="Memoria de luces"]')!.textContent).toContain(
      '24 horas'
    );
    document.querySelector<HTMLButtonElement>('[data-venue-play]')!.click();
    await settle();
    const body = JSON.parse(fetchMock.mock.lastCall![1].body as string);
    expect(body.action).toBe('venue_game_start');
    expect(body.venue).toBe(CITY_VENUES[0].id);
    expect(document.querySelectorAll('[data-memory-choice]')).toHaveLength(4);
    expect(document.querySelector<HTMLButtonElement>('[data-memory-choice]')!.disabled).toBe(true);
  }, 20000);
  it('filters local activities and unlocks expired rewards without extra requests', async () => {
    stop();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000000);
    const pet = createStarterCharacter(),
      profile = createProfile(pet),
      venue = CITY_VENUES[0];
    profile.world = initialWorldProgress();
    profile.world.visitedVenues = [venue.id];
    profile.world.venueGameCooldowns = { [venue.id]: 1001500 };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ session: 'activities-qa', profile }) });
    vi.stubGlobal('fetch', fetchMock);
    stop = mountWorldPlay({ pet, profile, onExit: vi.fn() });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    document.querySelector<HTMLButtonElement>('[data-menu="quests"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-menu="activities"]')!.click();
    expect(document.querySelectorAll('[data-activity-venue]')).toHaveLength(6);
    expect(document.querySelector('[data-activity-count="available"]')!.textContent).toBe('5');
    document.querySelector<HTMLButtonElement>('[data-activity-filter="unvisited"]')!.click();
    expect(document.querySelector<HTMLElement>(`[data-activity-venue="${venue.id}"]`)!.hidden).toBe(
      true
    );
    document.querySelector<HTMLButtonElement>('[data-activity-filter="available"]')!.click();
    const requests = fetchMock.mock.calls.length;
    clock.mockReturnValue(1002000);
    tick();
    expect(document.querySelector<HTMLElement>(`[data-activity-venue="${venue.id}"]`)!.hidden).toBe(
      false
    );
    expect(document.querySelector('[data-activity-count="available"]')!.textContent).toBe('6');
    expect(fetchMock.mock.calls.length).toBe(requests);
    document.querySelector<HTMLButtonElement>('[data-close]')!.click();
    roomControl.entrance = true;
    key('f');
    roomControl.entrance = false;
    profile.world.venueGameCooldowns[venue.id] = 1003000;
    document.querySelector<HTMLButtonElement>('[data-menu="venue-game"]')!.click();
    expect(document.querySelector<HTMLButtonElement>('[data-timed-venue-play]')!.disabled).toBe(
      true
    );
    clock.mockReturnValue(1003000);
    for (let i = 0; i < 6; i++) tick();
    expect(document.querySelector<HTMLButtonElement>('[data-timed-venue-play]')!.disabled).toBe(
      false
    );
    expect(fetchMock.mock.calls.length).toBe(requests);
  }, 20000);
  it('groups secondary tools and pauses pending attacks while the menu is open', () => {
    tick();
    expect(document.querySelectorAll('header nav > button')).toHaveLength(1);
    const menu = document.querySelector<HTMLDetailsElement>('.world-tools')!;
    expect(menu.querySelector('[data-menu="graphics"]')).not.toBeNull();
    expect(menu.querySelector('[data-menu="exit"]')).not.toBeNull();
    const enemy = battleControl.enemy!;
    enemy.mesh.position.set(0, 0, 1.7);
    enemy.damage = 1000;
    enemy.speed = 0;
    tick();
    menu.open = true;
    menu.dispatchEvent(new Event('toggle'));
    key('ArrowRight');
    const initial = { x: rendered.x, z: rendered.z };
    for (let i = 0; i < 30; i++) tick();
    expect(rendered.x).toBe(initial.x);
    expect(rendered.z).toBe(initial.z);
    expect(document.querySelector('[aria-label="Mascota derrotada"]')).toBeNull();
    expect(document.querySelector<HTMLElement>('.world-danger')!.hidden).toBe(true);
    key('Escape');
    expect(menu.open).toBe(false);
    menu.dispatchEvent(new Event('toggle'));
    tick();
    expect(rendered.x).toBe(initial.x);
    expect(document.querySelector('[aria-label="Mascota derrotada"]')).toBeNull();
    menu.open = true;
    menu.querySelector<HTMLButtonElement>('[data-menu="graphics"]')!.click();
    expect(menu.open).toBe(false);
    expect(document.querySelector('[aria-label="Ajustes gráficos"][role="dialog"]')).not.toBeNull();
  });
  it('keeps a chosen rival for attacks and releases dead targets', () => {
    const [near, chosen] = battleControl.enemies;
    near.name = 'Cercano';
    chosen.name = 'Elegido';
    for (const enemy of [near, chosen]) {
      enemy.alive = true;
      enemy.mesh.visible = true;
      enemy.health = enemy.maxHealth = 80;
      enemy.speed = 0;
    }
    near.mesh.position.set(0, 0, 1.7);
    chosen.mesh.position.set(0, 0, 3);
    tick();
    key('t');
    key('t');
    tick();
    expect(document.querySelector('.world-target')!.textContent).toContain('Fijado · Elegido');
    document.querySelector<HTMLButtonElement>('[data-attack]')!.click();
    expect(chosen.health).toBeLessThan(80);
    expect(near.health).toBe(80);
    chosen.mesh.position.z = 10;
    for (let i = 0; i < 10; i++) tick();
    document.querySelector<HTMLButtonElement>('[data-attack]')!.click();
    expect(document.querySelector('.world-notice')!.textContent).toContain(
      'Acércate al objetivo fijado'
    );
    expect(near.health).toBe(80);
    chosen.alive = false;
    tick();
    expect(document.querySelector('.world-target')!.textContent).toContain('Cercano');
    expect(document.querySelector<HTMLButtonElement>('[data-clear-target]')!.hidden).toBe(true);
  });
  it('distinguishes a target tap from dragging the camera', () => {
    const [near, chosen] = battleControl.enemies;
    near.mesh.position.set(0, 0, 1.7);
    chosen.name = 'Tocado';
    chosen.alive = true;
    chosen.mesh.visible = true;
    chosen.speed = 0;
    chosen.mesh.position.set(2, 0, 3);
    tick();
    const hits = vi
      .spyOn(Raycaster.prototype, 'intersectObjects')
      .mockReturnValue([{ object: chosen.mesh }] as unknown as ReturnType<
        Raycaster['intersectObjects']
      >);
    const canvas = document.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    } as DOMRect);
    const point = (type: string, x: number) => {
      const event = new MouseEvent(type, { clientX: x, clientY: 50, button: 0, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: 9 });
      canvas.dispatchEvent(event);
    };
    point('pointerdown', 100);
    point('pointermove', 130);
    point('pointerup', 130);
    expect(hits).not.toHaveBeenCalled();
    point('pointerdown', 100);
    point('pointerup', 100);
    tick();
    expect(hits).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.world-target')!.textContent).toContain('Fijado · Tocado');
    document.querySelector<HTMLButtonElement>('[data-clear-target]')!.click();
    tick();
    expect(document.querySelector('.world-target')!.textContent).not.toContain('Fijado');
  });
  it('pauses on window blur and clears held movement before resuming', () => {
    tick();
    key('ArrowRight');
    tick();
    window.dispatchEvent(new Event('blur'));
    const position = { x: rendered.x, z: rendered.z };
    for (let i = 0; i < 20; i++) tick();
    expect(rendered.x).toBe(position.x);
    expect(rendered.z).toBe(position.z);
    window.dispatchEvent(new Event('focus'));
    tick();
    expect(rendered.x).toBe(position.x);
    key('ArrowRight');
    tick();
    expect(rendered.x).toBeGreaterThan(position.x);
    document.querySelector<HTMLButtonElement>('[data-menu="controls"]')!.click();
    expect(document.querySelector('[aria-label="Ayuda y controles"]')!.textContent).toContain(
      'definitiva'
    );
  });
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
    expect(document.querySelector<HTMLElement>('.world-target')!.hidden).toBe(true);
    expect(document.querySelector('[data-target-info]')!.textContent).toBe('');
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
