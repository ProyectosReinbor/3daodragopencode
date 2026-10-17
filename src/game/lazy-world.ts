import './lazy-world.css';
type WorldModule = Pick<typeof import('./world-play'), 'mountWorldPlay'>;
type WorldOptions = Parameters<WorldModule['mountWorldPlay']>[0];

/** Keep cartography out of the landing bundle and discard late results after navigation. */
export function mountLazyWorld(
  options: WorldOptions,
  load: () => Promise<WorldModule> = () => import('./world-play')
): () => void {
  let disposed = false,
    loading = false;
  let stop: (() => void) | undefined;
  const background = document.querySelector<HTMLElement>('#app');
  const previousInert = background?.inert || false;
  const previousFocus = document.activeElement as HTMLElement | null;
  const panel = document.createElement('section');
  panel.className = 'world-loading-screen';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Cargando el mundo');
  function releasePanel() {
    panel.remove();
    if (background) background.inert = previousInert;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop?.();
    releasePanel();
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  function leave(profile = options.profile) {
    if (disposed) return;
    dispose();
    options.onExit(profile);
  }
  async function begin() {
    if (disposed || loading) return;
    loading = true;
    if (background) background.inert = true;
    if (!panel.isConnected) document.body.append(panel);
    panel.innerHTML =
      '<article><h2>Preparando tu aventura</h2><p role="status">Cargando el mundo y sus calles. La primera entrada puede tardar unos segundos.</p><button data-world-cancel>Volver</button></article>';
    panel.querySelector<HTMLButtonElement>('button')!.focus();
    try {
      const module = await load();
      if (disposed) return;
      // Let the world capture the original background state, rather than the loading lock.
      releasePanel();
      stop = module.mountWorldPlay({ ...options, onExit: leave });
      if (disposed) stop();
    } catch {
      if (disposed) return;
      if (background) background.inert = true;
      if (!panel.isConnected) document.body.append(panel);
      panel.innerHTML =
        '<article><h2>No se pudo abrir el mundo</h2><p role="status">Comprueba tu conexión e inténtalo de nuevo.</p><button data-world-retry>Reintentar</button><button data-world-cancel>Volver</button></article>';
      panel.querySelector<HTMLButtonElement>('button')!.focus();
    } finally {
      loading = false;
    }
  }
  panel.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('button');
    if (button?.hasAttribute('data-world-cancel')) leave();
    if (button?.hasAttribute('data-world-retry')) void begin();
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      leave();
    }
  });
  void begin();
  return dispose;
}
