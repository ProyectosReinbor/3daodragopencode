import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStarterCharacter } from './characters';
import { mountWorldPlay } from './world-play';
import { createProfile } from './profile';
import { initialWorldProgress } from '../../shared/world-items.js';
import { CITY_BUILDINGS, CITY_VENUES } from '../../shared/city-life.js';

const rendered = vi.hoisted(() => ({ x: 0, y: 0, z: 0, disposed: false }));
const roomControl = vi.hoisted(() => ({ entrance: false }));
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
  });
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
