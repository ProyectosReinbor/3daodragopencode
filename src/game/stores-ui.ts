import { getStores, getStore } from './api';
import {
  BUSINESS_CATEGORIES,
  DEFAULT_CITY_ID,
  URBAN_CITIES,
  filterBusinessStores,
  getCategoryLabel,
  getStoreCityKey,
  getStoreLocationLabel,
  normalizeStoreMetadata,
  type Store,
  type StoreDetail,
  type Promotion,
  type Product,
} from './stores';
import { getPromotionStatus, formatPromotionDates } from './promotions';
import { getRewardLabel, getRarityLabel, getRarityColor, formatPrice } from './products';
import { navigation } from './navigation';

export interface StoresCallbacks {
  onBack: () => void;
  onStoreSelected: (storeId: string) => void;
  onRedeem: () => void;
}

const sessions = new WeakMap<HTMLElement, AbortController>();
const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
  );
function beginSession(container: HTMLElement) {
  sessions.get(container)?.abort();
  const events = new AbortController();
  sessions.set(container, events);
  return events;
}

/** The pilot selection is a catalog filter, not a claim about the player's GPS position. */
export function mountStoresList(callbacks: StoresCallbacks): () => void {
  const container = document.getElementById('stores-list');
  if (!container) return () => {};
  const events = beginSession(container);
  const heading = document.querySelector('#stores-screen h2');
  if (heading) heading.textContent = 'Negocios de tu ciudad';
  const eyebrow = document.querySelector('#stores-screen .eyebrow');
  if (eyebrow) eyebrow.textContent = 'AODASE PETS · CIUDAD';
  container.classList.add('urban-catalog');
  container.innerHTML = '<div class="stores-loading" role="status">Cargando negocios…</div>';
  document
    .getElementById('stores-back')
    ?.addEventListener('click', callbacks.onBack, { signal: events.signal });
  getStores()
    .then((data) => {
      if (events.signal.aborted || !container.isConnected) return;
      const stores = data.stores.map((store) => normalizeStoreMetadata(store));
      const cities = new Map(
        URBAN_CITIES.map((city) => [city.id, `${city.name} · ${city.region_name}`])
      );
      for (const store of stores) {
        const key = getStoreCityKey(store);
        if (!cities.has(key)) cities.set(key, getStoreLocationLabel(store));
      }
      const categories = new Map(
        BUSINESS_CATEGORIES.map((category) => [String(category.id), category.label])
      );
      for (const store of stores) {
        if (store.category && !categories.has(store.category))
          categories.set(store.category, getCategoryLabel(store.category));
      }
      container.innerHTML = `
      <p class="urban-pilot-note">Villavicencio es nuestra ciudad piloto. Consulta los negocios publicados y sus ofertas disponibles.</p>
      <form class="urban-catalog-filters" aria-label="Filtrar negocios">
        <label>Buscar negocio<input type="search" name="business-search" placeholder="Nombre, producto o servicio" autocomplete="off"></label>
        <label>Ciudad<select name="business-city">${[...cities.entries()].map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`).join('')}<option value="">Todas las ciudades publicadas</option></select></label>
        <label>Categoría<select name="business-category"><option value="">Todas las categorías</option>${[...categories.entries()].map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`).join('')}</select></label>
      </form>
      <p class="urban-catalog-count" role="status" aria-live="polite"></p>
      <div class="urban-catalog-results"></div>`;
      const search = container.querySelector<HTMLInputElement>('[name="business-search"]')!;
      const city = container.querySelector<HTMLSelectElement>('[name="business-city"]')!;
      const category = container.querySelector<HTMLSelectElement>('[name="business-category"]')!;
      const results = container.querySelector<HTMLElement>('.urban-catalog-results')!;
      const count = container.querySelector<HTMLElement>('.urban-catalog-count')!;
      city.value = DEFAULT_CITY_ID;
      function render() {
        const visible = filterBusinessStores(stores, {
          city: city.value,
          category: category.value,
          query: search.value,
        });
        count.textContent = `${visible.length} ${visible.length === 1 ? 'negocio publicado' : 'negocios publicados'}`;
        if (visible.length) {
          results.innerHTML = visible.map(renderStoreCard).join('');
          return;
        }
        const message = !stores.length
          ? 'Aún no hay negocios publicados. El piloto comienza en Villavicencio.'
          : city.value === DEFAULT_CITY_ID && !category.value && !search.value.trim()
            ? 'Todavía no hay negocios publicados en Villavicencio.'
            : 'No hay negocios que coincidan con estos filtros.';
        results.innerHTML = `<div class="stores-empty"><p>${message}</p>${stores.length ? '<button type="button" data-reset-business-filters>Ver todos los negocios publicados</button>' : ''}</div>`;
      }
      search.addEventListener('input', render, { signal: events.signal });
      city.addEventListener('change', render, { signal: events.signal });
      category.addEventListener('change', render, { signal: events.signal });
      container
        .querySelector('form')!
        .addEventListener('submit', (event) => event.preventDefault(), { signal: events.signal });
      container.addEventListener(
        'click',
        (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest('[data-reset-business-filters]')) {
            search.value = category.value = city.value = '';
            render();
            return;
          }
          const card = target?.closest<HTMLElement>('[data-store-id]');
          if (card?.dataset.storeId) callbacks.onStoreSelected(card.dataset.storeId);
        },
        { signal: events.signal }
      );
      render();
    })
    .catch(() => {
      if (events.signal.aborted || !container.isConnected) return;
      container.innerHTML =
        '<div class="stores-error" role="alert">No pudimos cargar los negocios. Vuelve a abrir el catálogo para intentarlo de nuevo.</div>';
    });
  return () => events.abort();
}

export function mountStoreDetail(storeId: string): () => void {
  const container = document.getElementById('store-detail-content');
  const headerEl = document.getElementById('store-detail-header');
  if (!container || !headerEl) return () => {};
  const events = beginSession(container);
  container.innerHTML = '<div class="stores-loading" role="status">Cargando negocio…</div>';
  headerEl.innerHTML = '';
  getStore(storeId)
    .then((data) => {
      if (events.signal.aborted || !container.isConnected) return;
      const store = normalizeStoreMetadata(data.store);
      renderStoreHeader(store);
      container.innerHTML = `
      <div class="store-info-section">
        <p class="store-description">${escapeHtml(store.description || 'El negocio aún no ha publicado una descripción.')}</p>
        <div class="store-meta">
          <span class="store-city">📍 ${escapeHtml(getStoreLocationLabel(store))}</span>
          <span class="store-hours">🕐 ${escapeHtml(store.hours || 'Horario no publicado')}</span>
        </div>
        ${store.is_demo ? '<p class="urban-demo-note">Demostración: este registro sirve para probar el catálogo y no confirma un negocio aliado.</p>' : ''}
      </div>
      <div class="store-promotions">
        <h3>Ofertas publicadas</h3>
        ${store.promotions.length === 0 ? '<p class="stores-empty">Este negocio no tiene ofertas publicadas.</p>' : store.promotions.map((promo) => renderPromotionCard(promo, store)).join('')}
      </div>
      <button class="redeem-btn" id="store-detail-redeem" type="button">Canjear código de compra</button>`;
      document
        .getElementById('store-detail-redeem')
        ?.addEventListener('click', () => navigation.navigate('redeem'), { signal: events.signal });
    })
    .catch(() => {
      if (events.signal.aborted || !container.isConnected) return;
      container.innerHTML =
        '<div class="stores-error" role="alert">No pudimos cargar este negocio.</div>';
    });
  document
    .getElementById('store-detail-back')
    ?.addEventListener('click', () => navigation.goBack(), { signal: events.signal });
  return () => events.abort();
}

function renderStoreHeader(store: StoreDetail): void {
  const headerEl = document.getElementById('store-detail-header');
  if (!headerEl) return;
  headerEl.innerHTML = `
    <div class="store-detail-brand">
      <div class="store-logo-placeholder" aria-hidden="true">${escapeHtml(store.name.charAt(0))}</div>
      <div>
        <h2>${escapeHtml(store.name)}</h2>
        <span class="store-category-badge">${escapeHtml(getCategoryLabel(store.category))}</span>
        ${store.is_demo ? '<span class="urban-demo-badge">Demostración</span>' : ''}
        ${store.game_name ? `<small class="urban-game-name">En AODASE PETS: ${escapeHtml(store.game_name)}</small>` : ''}
      </div>
    </div>`;
}
function renderStoreCard(store: Store): string {
  return `
    <button type="button" class="store-card" data-store-id="${escapeHtml(store.id)}" aria-label="Ver ${escapeHtml(store.name)}">
      <span class="store-card-logo" aria-hidden="true">${escapeHtml(store.name.charAt(0))}</span>
      <span class="store-card-body">
        <strong class="store-card-name">${escapeHtml(store.name)}</strong>
        <span class="store-card-category">${escapeHtml(getCategoryLabel(store.category))}</span>
        <span class="store-card-city">${escapeHtml(getStoreLocationLabel(store))}</span>
        <span class="store-card-desc">${escapeHtml(store.short_description || store.description || 'Descripción pendiente de publicación.')}</span>
        ${store.is_demo ? '<span class="urban-demo-badge">Demostración</span>' : ''}
        ${store.promotion_count > 0 ? `<span class="store-card-promos">${store.promotion_count} ${store.promotion_count === 1 ? 'oferta publicada' : 'ofertas publicadas'}</span>` : ''}
      </span>
    </button>`;
}
function renderPromotionCard(promo: Promotion, store: StoreDetail): string {
  const status = getPromotionStatus(promo);
  const products = store.products.filter((product) => promo.product_ids.includes(product.id));
  return `
    <div class="promo-card ${status}">
      <div class="promo-header">
        <strong>${escapeHtml(promo.name)}</strong>
        <span class="promo-status ${status}">${statusLabel(status)}</span>
      </div>
      <p class="promo-desc">${escapeHtml(promo.description)}</p>
      <span class="promo-dates">${escapeHtml(formatPromotionDates(promo))}</span>
      ${products.length ? `<div class="promo-products"><h4>Productos y servicios participantes:</h4>${products.map(renderProductCard).join('')}</div>` : ''}
    </div>`;
}
function renderProductCard(product: Product): string {
  return `
    <div class="product-card">
      <div class="product-info">
        <strong>${escapeHtml(product.name)}</strong>
        <p class="product-desc">${escapeHtml(product.description)}</p>
        <span class="product-price">${escapeHtml(formatPrice(product))}</span>
      </div>
      <div class="product-reward">
        <span class="reward-preview-label">Recompensa publicada:</span>
        <span class="reward-name" style="color:${getRarityColor(product.reward_rarity)}">${escapeHtml(getRewardLabel(product))}</span>
        <span class="reward-rarity">${escapeHtml(getRarityLabel(product.reward_rarity))}</span>
      </div>
    </div>`;
}
function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Activa',
    upcoming: 'Próximamente',
    expired: 'Expirada',
    inactive: 'Inactiva',
  };
  return labels[status] ?? status;
}
