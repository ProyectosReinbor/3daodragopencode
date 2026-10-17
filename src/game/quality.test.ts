import { afterEach, describe, expect, it, vi } from 'vitest';
import { getQuality, saveQuality, pixelRatioFor } from './quality';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe('graphics preferences', () => {
  it('persists the selected preset and caps resolution', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    expect(saveQuality('medium')).toBe(true);
    expect(getQuality()).toBe('medium');
    expect(pixelRatioFor('low')).toBe(0.8);
    expect(pixelRatioFor('high')).toBe(1.35);
  });
  it('keeps working when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw Error('blocked');
    });
    expect(['low', 'medium', 'high']).toContain(getQuality());
    expect(saveQuality('low')).toBe(false);
  });
});
