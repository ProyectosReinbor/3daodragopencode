import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountVenueMemory } from './venue-memory';
describe('venue memory interaction', () => {
  let time: number, frame: FrameRequestCallback, stop: () => void;
  const challenge = {
    token: 'qa',
    venue: 'venue-0',
    pattern: [2, 0, 3],
    issuedAt: 100000,
    readyAt: 103500,
    expiresAt: 160000,
  };
  beforeEach(() => {
    time = 0;
    document.body.innerHTML = '<div id="game"></div>';
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    stop = () => {};
  });
  afterEach(() => {
    stop();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const advance = (milliseconds: number) => {
    time += milliseconds;
    frame(time);
  };
  it('shows cues for several seconds and submits only one complete answer', async () => {
    const submit = vi.fn().mockResolvedValue({ won: true, message: 'Premio confirmado' });
    stop = mountVenueMemory(
      document.querySelector('#game')!,
      challenge,
      () => 100000 + time,
      submit
    );
    const button = (id: number) =>
      document.querySelector<HTMLButtonElement>(`[data-memory-choice="${id}"]`)!;
    expect(button(2).disabled).toBe(true);
    advance(500);
    expect(button(2).getAttribute('aria-pressed')).toBe('true');
    advance(1000);
    expect(button(0).getAttribute('aria-pressed')).toBe('true');
    advance(1000);
    expect(button(3).getAttribute('aria-pressed')).toBe('true');
    expect(submit).not.toHaveBeenCalled();
    advance(1000);
    expect(button(2).disabled).toBe(false);
    button(2).click();
    button(0).click();
    button(3).click();
    button(3).click();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(submit).toHaveBeenCalledExactlyOnceWith([2, 0, 3]);
    expect(document.querySelector('[role="status"]')!.textContent).toBe('Premio confirmado');
    expect(document.querySelector('[data-venue-play]')).toBeNull();
    expect(document.querySelector('[data-close]')).not.toBeNull();
  });
  it('does not submit expired attempts and stops when its panel is removed', () => {
    const submit = vi.fn();
    stop = mountVenueMemory(document.querySelector('#game')!, challenge, () => 200000, submit);
    advance(10);
    expect(document.querySelector('[role="status"]')!.textContent).toContain('venció');
    expect(submit).not.toHaveBeenCalled();
    expect(document.querySelector('[data-venue-play]')).not.toBeNull();
    stop();
    stop = mountVenueMemory(document.querySelector('#game')!, challenge, () => 100000, submit);
    document.querySelector('#game')!.replaceChildren();
    const calls = vi.mocked(requestAnimationFrame).mock.calls.length;
    advance(10);
    expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBe(calls);
    stop = mountVenueMemory(document.querySelector('#game')!, challenge, () => 100000, submit);
    document.querySelector<HTMLElement>('#game')!.hidden = true;
    const hiddenCalls = vi.mocked(requestAnimationFrame).mock.calls.length;
    advance(10);
    expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBe(hiddenCalls);
  });
  it('offers another attempt when confirmation fails', async () => {
    stop = mountVenueMemory(
      document.querySelector('#game')!,
      challenge,
      () => 100000,
      vi.fn().mockRejectedValue(Error('offline'))
    );
    advance(3500);
    for (const id of [2, 0, 3])
      document.querySelector<HTMLButtonElement>(`[data-memory-choice="${id}"]`)!.click();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(document.querySelector('[role="status"]')!.textContent).toContain(
      'No se pudo confirmar'
    );
    expect(document.querySelector('[data-venue-play]')).not.toBeNull();
  });
});
