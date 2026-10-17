import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStarterCharacter } from './characters';
import { mountLazyWorld } from './lazy-world';
type WorldModule = Pick<typeof import('./world-play'), 'mountWorldPlay'>;
function pendingModule() {
  let resolve!: (module: WorldModule) => void;
  const promise = new Promise<WorldModule>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
describe('deferred world loading', () => {
  it('does not mount a late download after the player cancels', async () => {
    document.body.innerHTML = '<main id="app"><button>Entrar</button></main>';
    const background = document.querySelector<HTMLElement>('#app')!;
    const pending = pendingModule(),
      mount = vi.fn(() => vi.fn()),
      onExit = vi.fn();
    const stop = mountLazyWorld({ pet: createStarterCharacter(), onExit }, () => pending.promise);
    expect(background.inert).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-world-cancel]')!.click();
    expect(background.inert).toBe(false);
    expect(onExit).toHaveBeenCalledTimes(1);
    pending.resolve({ mountWorldPlay: mount });
    await settle();
    expect(mount).not.toHaveBeenCalled();
    expect(document.querySelector('.world-loading-screen')).toBeNull();
    stop();
    expect(onExit).toHaveBeenCalledTimes(1);
  });
  it('allows retry after a load failure and releases the mounted world once', async () => {
    document.body.innerHTML = '<main id="app"></main>';
    const background = document.querySelector<HTMLElement>('#app')!;
    const cleanup = vi.fn(),
      mount = vi.fn(() => {
        expect(background.inert).toBe(false);
        return cleanup;
      });
    const load = vi
      .fn<() => Promise<WorldModule>>()
      .mockRejectedValueOnce(Error('offline'))
      .mockResolvedValueOnce({ mountWorldPlay: mount });
    const stop = mountLazyWorld({ pet: createStarterCharacter(), onExit: vi.fn() }, load);
    await settle();
    expect(document.querySelector('[role="status"]')!.textContent).toContain('conexión');
    document.querySelector<HTMLButtonElement>('[data-world-retry]')!.click();
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.world-loading-screen')).toBeNull();
    stop();
    stop();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
  it('cancels pending loads on navigation without firing the exit callback', async () => {
    document.body.innerHTML = '<main id="app"></main>';
    const pending = pendingModule(),
      mount = vi.fn(() => vi.fn()),
      onExit = vi.fn();
    const stop = mountLazyWorld({ pet: createStarterCharacter(), onExit }, () => pending.promise);
    stop();
    pending.resolve({ mountWorldPlay: mount });
    await settle();
    expect(mount).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });
  it('forwards world exit and preserves an existing background lock', async () => {
    document.body.innerHTML = '<main id="app"></main>';
    const background = document.querySelector<HTMLElement>('#app')!;
    background.inert = true;
    const onExit = vi.fn(),
      cleanup = vi.fn();
    let exit!: () => void;
    const mount: WorldModule['mountWorldPlay'] = (options) => {
      exit = () => options.onExit();
      return cleanup;
    };
    const stop = mountLazyWorld({ pet: createStarterCharacter(), onExit }, async () => ({
      mountWorldPlay: mount,
    }));
    await settle();
    exit();
    stop();
    expect(background.inert).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
