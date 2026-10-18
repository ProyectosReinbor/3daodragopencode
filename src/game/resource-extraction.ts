export function mountResourceExtraction(
  container: HTMLElement,
  node: { id: string; name: string },
  challenge: { token: string; readyAt: number },
  now: () => number
): () => void {
  const panel = document.createElement('article');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Extracción');
  panel.innerHTML =
    '<button data-close aria-label="Cancelar extracción">✕</button><h2></h2><p role="status"></p><progress max="3" value="0" aria-label="Avance de extracción"></progress><button data-gather disabled>Recoger material</button><button data-close>Cancelar y volver al mundo</button>';
  panel.querySelector('h2')!.textContent = node.name;
  const status = panel.querySelector('p')!,
    progress = panel.querySelector('progress')!;
  const collect = panel.querySelector<HTMLButtonElement>('[data-gather]')!;
  collect.dataset.gather = node.id;
  let stopped = false,
    timer = 0;
  function stop() {
    stopped = true;
    window.clearTimeout(timer);
  }
  function tick() {
    if (stopped || !panel.isConnected || panel.closest('[hidden]')) {
      stop();
      return;
    }
    const remaining = challenge.readyAt - now();
    progress.value = Math.max(0, Math.min(3, 3 - remaining / 1000));
    if (remaining < -30000) {
      collect.disabled = true;
      delete collect.dataset.token;
      status.textContent = 'La extracción venció. Vuelve al yacimiento para intentarlo de nuevo.';
      stop();
      return;
    }
    collect.disabled = remaining > 0;
    if (remaining > 0) status.textContent = `Extrayendo material… ${Math.ceil(remaining / 1000)} s`;
    else {
      collect.dataset.token = challenge.token;
      status.textContent = `Material listo. Recógelo en ${Math.max(0, Math.ceil((30000 + remaining) / 1000))} s.`;
    }
    timer = window.setTimeout(tick, 100);
  }
  container.replaceChildren(panel);
  tick();
  return stop;
}
