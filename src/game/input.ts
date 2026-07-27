import { Vector2 } from 'three';

export class InputController {
  readonly movement = new Vector2();
  private readonly pressed = new Set<string>();
  private touchActive = false;

  constructor(
    joystick: HTMLElement,
    knob: HTMLElement,
    onAttack: () => void,
    onInteract: () => void
  ) {
    window.addEventListener('keydown', (event) => {
      this.pressed.add(event.key.toLowerCase());
      if (event.code === 'Space') {
        event.preventDefault();
        onAttack();
      }
      if (event.key.toLowerCase() === 'e') onInteract();
    });
    window.addEventListener('keyup', (event) => this.pressed.delete(event.key.toLowerCase()));
    document.querySelector('#attack-button')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAttack();
    });
    document.querySelector('#interact-button')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onInteract();
    });

    const updateTouch = (event: PointerEvent) => {
      const box = joystick.getBoundingClientRect();
      const centerX = box.left + box.width / 2;
      const centerY = box.top + box.height / 2;
      const radius = box.width * 0.32;
      const offset = new Vector2(event.clientX - centerX, event.clientY - centerY);
      offset.clampLength(0, radius);
      knob.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
      this.movement.set(offset.x / radius, offset.y / radius);
    };

    joystick.addEventListener('pointerdown', (event) => {
      this.touchActive = true;
      joystick.setPointerCapture(event.pointerId);
      updateTouch(event);
    });
    joystick.addEventListener('pointermove', (event) => {
      if (this.touchActive) updateTouch(event);
    });
    joystick.addEventListener('pointerup', () => this.resetTouch(knob));
    joystick.addEventListener('pointercancel', () => this.resetTouch(knob));
  }

  update(): Vector2 {
    if (this.touchActive) return this.movement;
    this.movement
      .set(
        Number(this.pressed.has('d') || this.pressed.has('arrowright')) -
          Number(this.pressed.has('a') || this.pressed.has('arrowleft')),
        Number(this.pressed.has('s') || this.pressed.has('arrowdown')) -
          Number(this.pressed.has('w') || this.pressed.has('arrowup'))
      )
      .normalize();
    return this.movement;
  }

  private resetTouch(knob: HTMLElement) {
    this.touchActive = false;
    this.movement.set(0, 0);
    knob.style.transform = 'translate(0, 0)';
  }
}
