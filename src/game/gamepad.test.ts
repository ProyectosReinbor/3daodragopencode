import { expect, it } from 'vitest';
import { createGamepadReader, navigateGamepadPanel, stick, GAMEPAD_ACTIONS } from './gamepad';
function controller(index = 0) {
  return {
    index,
    id: `pad-${index}`,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0, touched: false })),
  } as unknown as Gamepad;
}
it('filters drift and rescales diagonal sticks without losing analog movement', () => {
  expect(stick(0.1, -0.1)).toEqual({ x: 0, y: 0 });
  expect(stick(NaN, 1)).toEqual({ x: 0, y: 0 });
  expect(stick(0.6, 0).x).toBeCloseTo(0.5);
  expect(Math.hypot(...Object.values(stick(1, 1)))).toBeCloseTo(1);
});
it('arms only after release and emits actions once per press', () => {
  const pad = controller(),
    reader = createGamepadReader(() => [null, pad]);
  (pad.buttons[0] as { pressed: boolean }).pressed = true;
  expect(reader.poll().actions.size).toBe(0);
  (pad.buttons[0] as { pressed: boolean }).pressed = false;
  reader.poll();
  (pad.buttons[0] as { pressed: boolean }).pressed = true;
  expect(reader.poll().actions.has('attack')).toBe(true);
  expect(reader.poll().actions.size).toBe(0);
  reader.poll(false);
  expect(reader.poll().actions.size).toBe(0);
});
it('clears disconnected input, keeps a stable controller and rejects nonstandard layouts', () => {
  const first = controller(),
    second = controller(1);
  let pads: (Gamepad | null)[] = [first, second];
  const reader = createGamepadReader(() => pads);
  reader.poll();
  (first.axes as number[])[0] = 1;
  (second.axes as number[])[0] = -1;
  pads = [second, first];
  expect(reader.poll().move.x).toBe(1);
  pads = [null];
  expect(reader.poll().move.x).toBe(0);
  pads = [first];
  expect(reader.poll().move.x).toBe(0);
  (first.axes as number[])[0] = 0;
  reader.poll();
  (first.axes as number[])[0] = 1;
  expect(reader.poll().move.x).toBe(1);
  Object.assign(first, { mapping: '' });
  expect(reader.poll().status).toBe('unsupported');
});
it('survives unavailable APIs and browser permission errors', () => {
  expect(
    createGamepadReader(() => {
      throw new Error('blocked');
    }).poll().status
  ).toBe('disconnected');
  expect(createGamepadReader(() => []).poll().actions.size).toBe(0);
});
it('maps every gameplay action and reads triggers and menu directions', () => {
  const pad = controller(),
    reader = createGamepadReader(() => [pad]);
  reader.poll();
  for (const [action, index] of Object.entries(GAMEPAD_ACTIONS)) {
    (pad.buttons[index] as { value: number }).value = 0.8;
    expect([...reader.poll().actions]).toEqual([action]);
    (pad.buttons[index] as { value: number }).value = 0;
    reader.poll();
  }
  (pad.buttons[13] as { pressed: boolean }).pressed = true;
  expect(reader.poll().navigation).toBe(1);
  (pad.buttons[13] as { pressed: boolean }).pressed = false;
  (pad.axes as number[])[1] = -1;
  expect(reader.poll().navigation).toBe(-1);
});
it('navigates enabled visible panel buttons and wraps without activating them', () => {
  document.body.innerHTML =
    '<div id="panel"><button id="first">Uno</button><button disabled>No</button><section hidden><button>No</button></section><button id="last">Dos</button></div>';
  const panel = document.querySelector<HTMLElement>('#panel')!;
  expect(navigateGamepadPanel(panel, 0)?.id).toBe('first');
  expect(navigateGamepadPanel(panel, 1)?.id).toBe('last');
  expect(navigateGamepadPanel(panel, 1)?.id).toBe('first');
  expect(navigateGamepadPanel(panel, -1)?.id).toBe('last');
  expect(panel.querySelectorAll('.world-gamepad-focus')).toHaveLength(1);
});
