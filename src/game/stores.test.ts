import { describe, it, expect } from 'vitest';
import type { Store, Promotion, Product, StoreDetail } from './stores';
import {
  isPromotionActive,
  isPromotionUpcoming,
  isPromotionExpired,
  getPromotionStatus,
  formatPromotionDates,
} from './promotions';
import { getRewardLabel, getRarityLabel, getRarityColor, formatPrice } from './products';

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  const now = new Date();
  const future = new Date(now);
  future.setMonth(future.getMonth() + 1);
  return {
    id: 'promo-test',
    store_id: 'store-test',
    name: 'Promo Test',
    description: 'Descripción test',
    banner_url: '',
    start_date: now.toISOString(),
    end_date: future.toISOString(),
    active: true,
    product_ids: [],
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-test',
    store_id: 'store-test',
    name: 'Producto Test',
    description: 'Descripción producto',
    image_url: '',
    price: 10.5,
    currency: 'EUR',
    reward_type: 'item',
    reward_id: 'espada-test',
    reward_name: 'Espada Test',
    reward_rarity: 'raro',
    reward_qty: 1,
    active: true,
    ...overrides,
  };
}

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 'test-store',
    name: 'Test Store',
    logo_url: '',
    category: 'comida_rapida',
    city: 'Madrid',
    description: 'Desc',
    short_description: 'Short',
    banner_url: '',
    lat: 40.41,
    lng: -3.7,
    hours: '12-23',
    active: true,
    promotion_count: 2,
    ...overrides,
  };
}

describe('promotions.ts', () => {
  describe('isPromotionActive', () => {
    it('returns true when current date is between start and end', () => {
      const promo = makePromotion();
      expect(isPromotionActive(promo)).toBe(true);
    });

    it('returns false when promo is inactive', () => {
      const promo = makePromotion({ active: false });
      expect(isPromotionActive(promo)).toBe(false);
    });

    it('returns false when before start date', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const later = new Date(future);
      later.setMonth(later.getMonth() + 1);
      const promo = makePromotion({
        start_date: future.toISOString(),
        end_date: later.toISOString(),
      });
      expect(isPromotionActive(promo)).toBe(false);
    });

    it('returns false when after end date', () => {
      const past = new Date();
      past.setFullYear(past.getFullYear() - 1);
      const earlier = new Date(past);
      earlier.setMonth(earlier.getMonth() - 1);
      const promo = makePromotion({
        start_date: earlier.toISOString(),
        end_date: past.toISOString(),
      });
      expect(isPromotionActive(promo)).toBe(false);
    });
  });

  describe('isPromotionUpcoming', () => {
    it('returns true when start date is in the future', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const later = new Date(future);
      later.setMonth(later.getMonth() + 1);
      const promo = makePromotion({
        start_date: future.toISOString(),
        end_date: later.toISOString(),
      });
      expect(isPromotionUpcoming(promo)).toBe(true);
    });

    it('returns false when already started', () => {
      const promo = makePromotion();
      expect(isPromotionUpcoming(promo)).toBe(false);
    });

    it('returns false when inactive', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const later = new Date(future);
      later.setMonth(later.getMonth() + 1);
      const promo = makePromotion({
        active: false,
        start_date: future.toISOString(),
        end_date: later.toISOString(),
      });
      expect(isPromotionUpcoming(promo)).toBe(false);
    });
  });

  describe('isPromotionExpired', () => {
    it('returns true when end date has passed', () => {
      const past = new Date();
      past.setFullYear(past.getFullYear() - 1);
      const earlier = new Date(past);
      earlier.setMonth(earlier.getMonth() - 1);
      const promo = makePromotion({
        start_date: earlier.toISOString(),
        end_date: past.toISOString(),
      });
      expect(isPromotionExpired(promo)).toBe(true);
    });

    it('returns false when still active', () => {
      const promo = makePromotion();
      expect(isPromotionExpired(promo)).toBe(false);
    });
  });

  describe('getPromotionStatus', () => {
    it('returns "active" for active promotions', () => {
      expect(getPromotionStatus(makePromotion())).toBe('active');
    });

    it('returns "inactive" when active is false', () => {
      expect(getPromotionStatus(makePromotion({ active: false }))).toBe('inactive');
    });

    it('returns "upcoming" for future promotions', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const later = new Date(future);
      later.setMonth(later.getMonth() + 1);
      expect(
        getPromotionStatus(
          makePromotion({ start_date: future.toISOString(), end_date: later.toISOString() })
        )
      ).toBe('upcoming');
    });

    it('returns "expired" for past promotions', () => {
      const past = new Date();
      past.setFullYear(past.getFullYear() - 1);
      const earlier = new Date(past);
      earlier.setMonth(earlier.getMonth() - 1);
      expect(
        getPromotionStatus(
          makePromotion({ start_date: earlier.toISOString(), end_date: past.toISOString() })
        )
      ).toBe('expired');
    });
  });

  describe('formatPromotionDates', () => {
    it('formats start and end dates correctly', () => {
      const promo = makePromotion({
        start_date: '2025-01-01T00:00:00.000Z',
        end_date: '2025-02-01T00:00:00.000Z',
      });
      const result = formatPromotionDates(promo);
      expect(result).toContain('1/1/2025');
      expect(result).toContain('1/2/2025');
      expect(result).toContain('→');
    });
  });
});

describe('products.ts', () => {
  describe('getRewardLabel', () => {
    it('formats item reward', () => {
      const p = makeProduct({ reward_type: 'item', reward_name: 'Espada Test', reward_qty: 1 });
      expect(getRewardLabel(p)).toContain('Espada Test');
    });

    it('includes quantity when > 1', () => {
      const p = makeProduct({ reward_type: 'currency', reward_name: 'Monedas', reward_qty: 500 });
      expect(getRewardLabel(p)).toContain('×500');
    });

    it('shows character type label', () => {
      const p = makeProduct({ reward_type: 'character', reward_name: 'Caballero', reward_qty: 1 });
      expect(getRewardLabel(p)).toMatch(/Personaje.*Caballero/);
    });

    it('shows crystals type label', () => {
      const p = makeProduct({ reward_type: 'crystals', reward_name: 'Cristales', reward_qty: 100 });
      expect(getRewardLabel(p)).toMatch(/Cristales.*Cristales/);
    });
  });

  describe('getRarityLabel', () => {
    it('returns "Común" for comun', () => expect(getRarityLabel('comun')).toBe('Común'));
    it('returns "Raro" for raro', () => expect(getRarityLabel('raro')).toBe('Raro'));
    it('returns "Épico" for epico', () => expect(getRarityLabel('epico')).toBe('Épico'));
    it('returns "Legendario" for legendario', () =>
      expect(getRarityLabel('legendario')).toBe('Legendario'));
    it('returns input for unknown rarity', () => expect(getRarityLabel('mistico')).toBe('mistico'));
  });

  describe('getRarityColor', () => {
    it('returns green for comun', () => expect(getRarityColor('comun')).toBe('#aabbaa'));
    it('returns blue for raro', () => expect(getRarityColor('raro')).toBe('#4488ff'));
    it('returns purple for epico', () => expect(getRarityColor('epico')).toBe('#aa44ff'));
    it('returns gold for legendario', () => expect(getRarityColor('legendario')).toBe('#ffaa00'));
    it('returns default color for unknown', () =>
      expect(getRarityColor('mistico')).toBe('#aabbaa'));
  });

  describe('formatPrice', () => {
    it('formats price with currency', () => {
      const p = makeProduct({ price: 14.99, currency: 'EUR' });
      expect(formatPrice(p)).toBe('€14.99 EUR');
    });
  });
});

describe('stores.ts types', () => {
  it('validates Store interface shape', () => {
    const store: Store = makeStore();
    expect(store.id).toBe('test-store');
    expect(store.promotion_count).toBe(2);
  });

  it('validates Promotion interface shape', () => {
    const promo = makePromotion();
    expect(promo.id).toBe('promo-test');
    expect(promo.store_id).toBe('store-test');
  });

  it('validates Product interface shape', () => {
    const product = makeProduct();
    expect(product.reward_type).toBe('item');
    expect(product.reward_rarity).toBe('raro');
  });

  it('validates StoreDetail interface shape', () => {
    const base = makeStore();
    const detail: StoreDetail = {
      ...base,
      promotions: [makePromotion()],
      products: [makeProduct()],
    };
    expect(detail.promotions).toHaveLength(1);
    expect(detail.products).toHaveLength(1);
  });
});
