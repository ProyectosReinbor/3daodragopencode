import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStore, getStores } from './api';
import { mountStoreDetail, mountStoresList } from './stores-ui';
import type { Store, StoreDetail } from './stores';

vi.mock('./api', () => ({ getStores: vi.fn(), getStore: vi.fn() }));
const business = (overrides: Partial<Store> = {}): Store => ({
  id: 'vvc-sport',
  name: 'Gimnasio Río',
  category: 'gimnasio',
  city: 'Villavicencio',
  logo_url: '',
  description: 'Entrenamiento y recuperación muscular',
  short_description: 'Bienestar local',
  banner_url: '',
  lat: null,
  lng: null,
  hours: '',
  active: true,
  promotion_count: 0,
  ...overrides,
});
const callbacks = { onBack: vi.fn(), onStoreSelected: vi.fn(), onRedeem: vi.fn() };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
let stop: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML =
    '<section id="stores-screen"><p class="eyebrow"></p><h2>Restaurantes</h2><button id="stores-back"></button><div id="stores-list"></div></section><button id="store-detail-back"></button><div id="store-detail-header"></div><div id="store-detail-content"></div>';
});
afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
});

describe('urban catalog UI', () => {
  it('starts with the pilot and filters actual businesses by category and description', async () => {
    vi.mocked(getStores).mockResolvedValue({
      stores: [
        business(),
        business({ id: 'fashion', name: 'Moda Llanera', category: 'moda' }),
        business({ id: 'legacy', name: 'Negocio legado', city: 'Madrid', is_demo: true }),
      ],
    });
    stop = mountStoresList(callbacks);
    await settle();
    expect(document.querySelector('h2')!.textContent).toBe('Negocios de tu ciudad');
    expect(document.querySelectorAll('[data-store-id]')).toHaveLength(2);
    const category = document.querySelector<HTMLSelectElement>('[name="business-category"]')!;
    category.value = 'gimnasio';
    category.dispatchEvent(new Event('change'));
    const search = document.querySelector<HTMLInputElement>('[name="business-search"]')!;
    search.value = 'RECUPERACION';
    search.dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('[data-store-id]')).toHaveLength(1);
    (document.querySelector('[data-store-id]') as HTMLElement).click();
    expect(callbacks.onStoreSelected).toHaveBeenCalledExactlyOnceWith('vvc-sport');
    search.value = 'inexistente';
    search.dispatchEvent(new Event('input'));
    expect(document.querySelector('.stores-empty')!.textContent).toContain(
      'No hay negocios que coincidan'
    );
    (document.querySelector('[data-reset-business-filters]') as HTMLElement).click();
    expect(document.querySelectorAll('[data-store-id]')).toHaveLength(3);
    expect(document.querySelector('.urban-demo-badge')!.textContent).toBe('Demostración');
    expect(document.getElementById('stores-list')!.textContent).not.toMatch(
      /\bGPS\b|\bkm\b|ADN|visita verificada/i
    );
  });
  it('shows a real empty state and safely displays business text', async () => {
    vi.mocked(getStores).mockResolvedValue({ stores: [] });
    stop = mountStoresList(callbacks);
    await settle();
    expect(document.querySelector('.stores-empty')!.textContent).toContain(
      'Aún no hay negocios publicados'
    );
    vi.mocked(getStores).mockResolvedValue({
      stores: [
        business({
          name: '<img src=x onerror=alert(1)>',
          short_description: '<script>fake()</script>',
        }),
      ],
    });
    stop = mountStoresList(callbacks);
    await settle();
    expect(document.querySelector('.store-card-name')!.textContent).toBe(
      '<img src=x onerror=alert(1)>'
    );
    expect(document.querySelector('#stores-list img, #stores-list script')).toBeNull();
  });
  it('aborts a prior mount so a delayed catalog cannot replace the current view', async () => {
    let finish!: (value: { stores: Store[] }) => void;
    vi.mocked(getStores).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    mountStoresList(callbacks);
    vi.mocked(getStores).mockResolvedValueOnce({ stores: [] });
    stop = mountStoresList(callbacks);
    await settle();
    finish({ stores: [business()] });
    await settle();
    expect(document.querySelector('[data-store-id]')).toBeNull();
    (document.getElementById('stores-back') as HTMLElement).click();
    expect(callbacks.onBack).toHaveBeenCalledTimes(1);
  });
  it('labels demo details and uses published hours/offers without inventing activity', async () => {
    const store: StoreDetail = { ...business({ is_demo: true }), products: [], promotions: [] };
    vi.mocked(getStore).mockResolvedValue({ store });
    stop = mountStoreDetail(store.id);
    await settle();
    expect(document.getElementById('store-detail-content')!.textContent).toContain(
      'Horario no publicado'
    );
    expect(document.querySelector('.urban-demo-note')!.textContent).toContain(
      'no confirma un negocio aliado'
    );
    expect(document.querySelector('.store-promotions')!.textContent).toContain(
      'no tiene ofertas publicadas'
    );
  });
});
