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

export interface Store {
  id: string;
  name: string;
  logo_url: string;
  category: string;
  city: string;
  description: string;
  short_description: string;
  banner_url: string;
  lat: number;
  lng: number;
  hours: string;
  active: boolean;
  promotion_count: number;
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
