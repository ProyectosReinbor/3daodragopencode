import { getStores, getStore } from './api';
import type { Store, StoreDetail, Promotion, Product } from './stores';
import { getPromotionStatus, formatPromotionDates } from './promotions';
import { getRewardLabel, getRarityLabel, getRarityColor, formatPrice } from './products';
import { navigation } from './navigation';

export interface StoresCallbacks {
  onBack: () => void;
  onStoreSelected: (storeId: string) => void;
  onRedeem: () => void;
}

export function mountStoresList(callbacks: StoresCallbacks): void {
  const container = document.getElementById('stores-list');
  if (!container) return;

  container.innerHTML = '<div class="stores-loading">Cargando tiendas...</div>';

  getStores()
    .then((data) => {
      container.innerHTML =
        data.stores.length === 0
          ? '<div class="stores-empty">No hay tiendas disponibles actualmente.</div>'
          : data.stores.map((s) => renderStoreCard(s)).join('');
    })
    .catch(() => {
      container.innerHTML =
        '<div class="stores-error">Error al cargar tiendas. Intenta de nuevo.</div>';
    });

  document.getElementById('stores-back')?.addEventListener('click', callbacks.onBack);
  container.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-store-id]');
    if (card) callbacks.onStoreSelected(card.dataset.storeId!);
  });
}

export function mountStoreDetail(storeId: string): void {
  const container = document.getElementById('store-detail-content');
  const headerEl = document.getElementById('store-detail-header');
  if (!container || !headerEl) return;

  container.innerHTML = '<div class="stores-loading">Cargando tienda...</div>';
  if (headerEl) headerEl.innerHTML = '';

  getStore(storeId)
    .then((data) => {
      const store = data.store;
      renderStoreHeader(store);
      container.innerHTML = `
        <div class="store-info-section">
          <p class="store-description">${store.description}</p>
          <div class="store-meta">
            <span class="store-city">📍 ${store.city}</span>
            <span class="store-hours">🕐 ${store.hours}</span>
          </div>
        </div>
        <div class="store-promotions">
          <h3>Promociones Activas</h3>
          ${
            store.promotions.length === 0
              ? '<p class="stores-empty">No hay promociones activas.</p>'
              : store.promotions.map((p) => renderPromotionCard(p, store)).join('')
          }
        </div>
        <button class="redeem-btn" id="store-detail-redeem">Canjear Factura</button>
      `;
      document.getElementById('store-detail-redeem')?.addEventListener('click', () => {
        navigation.navigate('redeem');
      });
    })
    .catch(() => {
      container.innerHTML = '<div class="stores-error">Error al cargar la tienda.</div>';
    });

  document
    .getElementById('store-detail-back')
    ?.addEventListener('click', () => navigation.goBack());
}

function renderStoreHeader(store: StoreDetail): void {
  const headerEl = document.getElementById('store-detail-header');
  if (!headerEl) return;
  headerEl.innerHTML = `
    <div class="store-detail-brand">
      <div class="store-logo-placeholder">${store.name.charAt(0)}</div>
      <div>
        <h2>${store.name}</h2>
        <span class="store-category-badge">${getCategoryLabel(store.category)}</span>
      </div>
    </div>
  `;
}

function renderStoreCard(store: Store): string {
  return `
    <div class="store-card" data-store-id="${store.id}">
      <div class="store-card-logo">${store.name.charAt(0)}</div>
      <div class="store-card-body">
        <strong class="store-card-name">${store.name}</strong>
        <span class="store-card-category">${getCategoryLabel(store.category)}</span>
        <span class="store-card-city">${store.city}</span>
        <p class="store-card-desc">${store.short_description}</p>
        ${store.promotion_count > 0 ? `<span class="store-card-promos">${store.promotion_count} promoción(es)</span>` : ''}
      </div>
    </div>
  `;
}

function renderPromotionCard(promo: Promotion, store: StoreDetail): string {
  const status = getPromotionStatus(promo);
  const dates = formatPromotionDates(promo);
  const storeProducts = store.products;

  return `
    <div class="promo-card ${status}">
      <div class="promo-header">
        <strong>${promo.name}</strong>
        <span class="promo-status ${status}">${statusLabel(status)}</span>
      </div>
      <p class="promo-desc">${promo.description}</p>
      <span class="promo-dates">${dates}</span>
      ${
        storeProducts.length > 0
          ? `
        <div class="promo-products">
          <h4>Productos participantes:</h4>
          ${storeProducts.map((pr) => renderProductCard(pr)).join('')}
        </div>
      `
          : ''
      }
    </div>
  `;
}

function renderProductCard(product: Product): string {
  const rewardInfo = getRewardLabel(product);
  const rarityColorVal = getRarityColor(product.reward_rarity);
  return `
    <div class="product-card">
      <div class="product-info">
        <strong>${product.name}</strong>
        <p class="product-desc">${product.description}</p>
        <span class="product-price">${formatPrice(product)}</span>
      </div>
      <div class="product-reward">
        <span class="reward-preview-label">Recompensa:</span>
        <span class="reward-name" style="color:${rarityColorVal}">${rewardInfo}</span>
        <span class="reward-rarity">${getRarityLabel(product.reward_rarity)}</span>
      </div>
    </div>
  `;
}

function getCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    comida_rapida: 'Comida Rápida',
    restaurante: 'Restaurante',
    postres: 'Postres',
    cafeteria: 'Cafetería',
    panaderia: 'Panadería',
  };
  return labels[cat] ?? cat;
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
