export interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string;
  image_url: string;
  price: number;
  currency: string;
  reward_type: 'character' | 'item' | 'currency' | 'crystals' | 'consumable';
  reward_id: string;
  reward_name: string;
  reward_rarity: string;
  reward_qty: number;
  active: boolean;
}

export interface Promotion {
  id: string;
  store_id: string;
  name: string;
  description: string;
  banner_url: string;
  start_date: string;
  end_date: string;
  active: boolean;
  product_ids: string[];
}

import type { BusinessMetadata } from '../../shared/urban-catalog';
export {
  BUSINESS_CATEGORIES,
  DEFAULT_CITY_ID,
  URBAN_CITIES,
  filterBusinessStores,
  getCategoryLabel,
  getStoreCityKey,
  getStoreLocationLabel,
  normalizeStoreMetadata,
} from '../../shared/urban-catalog';

export interface Store extends BusinessMetadata {
  id: string;
  name: string;
  logo_url: string;
  category: string;
  city: string;
  description: string;
  short_description: string;
  banner_url: string;
  lat: number | null;
  lng: number | null;
  hours: string;
  active: boolean;
  promotion_count: number;
  /** Loaded coordinates are optional and never imply GPS verification. */
  location_known?: boolean;
  is_demo?: boolean;
}

export interface StoreDetail extends Store {
  promotions: Promotion[];
  products: Product[];
}

export interface StoreListResponse {
  stores: Store[];
}

export interface StoreDetailResponse {
  store: StoreDetail;
}

export interface PromotionsResponse {
  promotions: Promotion[];
}

export interface ProductsResponse {
  products: Product[];
}
