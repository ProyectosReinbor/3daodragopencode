import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountResourceExtraction } from './resource-extraction';
let container: HTMLElement, time: number;
const node = { id: 'mine', name: 'Mina de cristal' };
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="extraction"></div>';
  container = document.querySelector('#extraction')!;
  time = 10000;
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
const advance = (ms: number) => {
  time += ms;
  vi.advanceTimersByTime(ms);
};
const button = () => container.querySelector<HTMLButtonElement>('[data-gather]')!;
it('uses server readiness and expiry instead of a fresh local three-second delay', () => {
  mountResourceExtraction(container, node, { token: 'first', readyAt: 12000 }, () => time);
  expect(button().disabled).toBe(true);
  expect(container.querySelector('progress')!.value).toBe(1);
  advance(1900);
  expect(button().disabled).toBe(true);
  advance(100);
  expect(button().disabled).toBe(false);
  expect(button().dataset.token).toBe('first');
  expect(container.textContent).toContain('Material listo');
  advance(30100);
  expect(button().disabled).toBe(true);
  expect(button().dataset.token).toBeUndefined();
  expect(container.textContent).toContain('venció');
  expect(vi.getTimerCount()).toBe(0);
});
it('never lets the old same-node timer unlock a new challenge', () => {
  mountResourceExtraction(container, node, { token: 'old', readyAt: 11000 }, () => time);
  advance(500);
  const stop = mountResourceExtraction(
    container,
    node,
    { token: 'new', readyAt: 13500 },
    () => time
  );
  advance(500);
  expect(button().disabled).toBe(true);
  expect(button().dataset.token).toBeUndefined();
  advance(2500);
  expect(button().dataset.token).toBe('new');
  stop();
  expect(vi.getTimerCount()).toBe(0);
});
it('cancels updates when the extraction is hidden or the world is disposed', () => {
  mountResourceExtraction(container, node, { token: 'hidden', readyAt: 13000 }, () => time);
  container.hidden = true;
  advance(3000);
  expect(button().disabled).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  container.hidden = false;
  const stop = mountResourceExtraction(
    container,
    node,
    { token: 'disposed', readyAt: 16000 },
    () => time
  );
  stop();
  advance(3000);
  expect(button().disabled).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
