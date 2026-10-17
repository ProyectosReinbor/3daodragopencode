import type { VenueGameChallenge } from '../../shared/venue-game.js';
const LIGHTS = [
  ['☀', 'Sol'],
  ['☾', 'Luna'],
  ['❧', 'Hoja'],
  ['◆', 'Cristal'],
];
export function mountVenueMemory(
  container: HTMLElement,
  challenge: VenueGameChallenge,
  now: () => number,
  submit: (answers: number[]) => Promise<{ won: boolean; message: string }>
): () => void {
  let stopped = false,
    frame = 0,
    sending = false,
    lastCue = -2;
  const start = performance.now(),
    answers: number[] = [];
  const root = document.createElement('div');
  root.className = 'venue-memory';
  root.innerHTML =
    '<p role="status">Observa y memoriza las luces.</p><div class="venue-memory-lights">' +
    LIGHTS.map(
      ([icon, name], i) =>
        `<button data-memory-choice="${i}" aria-label="${name}" aria-pressed="false" disabled><b>${icon}</b><span>${name}</span></button>`
    ).join('') +
    '</div><p>Primero observa; después repite las tres luces en el mismo orden.</p>';
  container.append(root);
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-memory-choice]')];
  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
  }
  function result(message: string, retry: boolean) {
    if (stopped || !root.isConnected || root.closest('[hidden]')) return;
    status.textContent = message;
    buttons.forEach((button) => {
      button.disabled = true;
      button.setAttribute('aria-pressed', 'false');
    });
    root.insertAdjacentHTML(
      'beforeend',
      retry
        ? '<button data-venue-play>Jugar otra vez</button>'
        : '<button data-close>Volver al local</button>'
    );
    stop();
  }
  root.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-memory-choice]');
    if (!button || button.disabled || stopped || sending) return;
    answers.push(Number(button.dataset.memoryChoice));
    status.textContent = `Tu turno: ${answers.length}/3 luces.`;
    if (answers.length === 3) {
      sending = true;
      buttons.forEach((item) => {
        item.disabled = true;
      });
      status.textContent = 'Comprobando tu secuencia…';
      try {
        const response = await submit([...answers]);
        result(response.message, !response.won);
      } catch {
        result('No se pudo confirmar el intento. Vuelve a intentarlo.', true);
      }
    }
  });
  function update() {
    if (stopped || !root.isConnected || root.closest('[hidden]')) {
      stop();
      return;
    }
    if (now() > challenge.expiresAt) {
      result('El intento venció. Puedes iniciar otra partida.', true);
      return;
    }
    const elapsed = performance.now() - start;
    if (elapsed < 3500) {
      const cue = elapsed < 500 ? -1 : Math.floor((elapsed - 500) / 1000);
      const lit = cue >= 0 && (elapsed - 500) % 1000 < 700 ? challenge.pattern[cue] : -1;
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === lit)));
      if (cue !== lastCue) {
        lastCue = cue;
        status.textContent =
          cue < 0
            ? 'Observa y memoriza las luces.'
            : `Luz ${cue + 1}: ${LIGHTS[challenge.pattern[cue]][1]}`;
      }
    } else if (!sending) {
      buttons.forEach((button) => {
        button.disabled = false;
        button.setAttribute('aria-pressed', 'false');
      });
      if (lastCue !== 3) {
        lastCue = 3;
        status.textContent = 'Tu turno: repite las tres luces.';
        buttons[0].focus();
      }
    }
    frame = requestAnimationFrame(update);
  }
  frame = requestAnimationFrame(update);
  return stop;
}
