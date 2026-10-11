import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStarterCharacter } from './characters';
import { mountWorldPlay } from './world-play';
import { createProfile } from './profile';
import { initialWorldProgress } from '../../shared/world-items.js';

const rendered = vi.hoisted(() => ({ x: 0, z: 0, disposed: false }));
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    WebGLRenderer: class {
      setPixelRatio() {}
      setSize() {}
      render(_scene: unknown, camera: { position: { x: number; z: number } }) {
        rendered.x = camera.position.x;
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
