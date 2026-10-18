export const GAMEPAD_ACTIONS = {
  attack: 0,
  dash: 1,
  interact: 2,
  ultimate: 3,
  power1: 4,
  power2: 5,
  potion: 6,
  mana: 7,
  map: 8,
  menu: 9,
  target: 11,
} as const;
export type GamepadAction = keyof typeof GAMEPAD_ACTIONS;
export function stick(x = 0, y = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const length = Math.hypot(x, y),
    deadzone = 0.2;
  if (length <= deadzone) return { x: 0, y: 0 };
  const strength = (Math.min(1, length) - deadzone) / (1 - deadzone);
  return { x: (x / length) * strength, y: (y / length) * strength };
}
export function createGamepadReader(
  getPads: () => readonly (Gamepad | null)[] = () => navigator.getGamepads?.() || []
) {
  let identity = '',
    armed = false,
    previous = new Set<number>();
  return {
    poll(enabled = true) {
      let pads: readonly (Gamepad | null)[] = [];
      try {
        pads = getPads();
      } catch {
        /* A browser policy may block access. */
      }
      const available = pads.filter((pad): pad is Gamepad => !!pad?.connected);
      const pad =
        available.find((p) => `${p.index}:${p.id}` === identity && p.mapping === 'standard') ||
        available.find((p) => p.mapping === 'standard');
      const empty = {
        move: { x: 0, y: 0 },
        look: { x: 0, y: 0 },
        actions: new Set<GamepadAction>(),
        navigation: 0,
      };
      const status = pad ? 'connected' : available.length ? 'unsupported' : 'disconnected';
      if (!pad) {
        identity = '';
        armed = false;
        previous.clear();
        return { ...empty, status };
      }
      const nextIdentity = `${pad.index}:${pad.id}`;
      if (identity !== nextIdentity) {
        identity = nextIdentity;
        armed = false;
        previous.clear();
      }
      const down = new Set(
        pad.buttons.flatMap((b, index) => (b.pressed || b.value > 0.5 ? [index] : []))
      );
      const move = stick(pad.axes[0], pad.axes[1]),
        look = stick(pad.axes[2], pad.axes[3]);
      if (!enabled) armed = false;
      if (!armed) {
        armed = enabled && !down.size && !move.x && !move.y && !look.x && !look.y;
        previous = down;
        return { ...empty, status };
      }
      const actions = new Set<GamepadAction>();
      for (const [action, index] of Object.entries(GAMEPAD_ACTIONS))
        if (down.has(index) && !previous.has(index)) actions.add(action as GamepadAction);
      previous = down;
      const navigation = down.has(12)
        ? -1
        : down.has(13)
          ? 1
          : down.has(14)
            ? -1
            : down.has(15)
              ? 1
              : Math.abs(move.y) > 0.55
                ? Math.sign(move.y)
                : Math.abs(move.x) > 0.55
                  ? Math.sign(move.x)
                  : 0;
      return { move, look, actions, navigation, status };
    },
  };
}

export function navigateGamepadPanel(scope: HTMLElement, direction: number) {
  const buttons = [...scope.querySelectorAll<HTMLButtonElement>('button')].filter(
    (button) => !button.disabled && !button.closest('[hidden], [aria-hidden="true"]')
  );
  if (!buttons.length) return null;
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const index =
    current < 0
      ? direction < 0
        ? buttons.length - 1
        : 0
      : (current + direction + buttons.length) % buttons.length;
  scope
    .querySelectorAll('.world-gamepad-focus')
    .forEach((el) => el.classList.remove('world-gamepad-focus'));
  const button = buttons[index];
  button.classList.add('world-gamepad-focus');
  button.focus({ preventScroll: true });
  button.scrollIntoView?.({ block: 'nearest' });
  return button;
}
