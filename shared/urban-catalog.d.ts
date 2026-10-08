export type BusinessCategoryId =
  | 'restaurante'
  | 'comida_rapida'
  | 'postres'
  | 'panaderia'
  | 'cafeteria'
  | 'tienda'
  | 'moda'
  | 'gimnasio'
  | 'entretenimiento'
  | 'servicios'
  | 'tecnologia'
  | 'centro_comercial'
  | 'otros';
export interface BusinessCategory {
  readonly id: BusinessCategoryId;
  readonly label: string;
  readonly icon: string;
}
export interface UrbanCity {
  readonly id: string;
  readonly name: string;
  readonly country_code: string;
  readonly country_name: string;
  readonly region_id: string;
  readonly region_name: string;
  readonly timezone: string;
  readonly pilot: boolean;
}
export interface BusinessMetadata {
  city_id?: string | null;
  country_code?: string | null;
  region_id?: string | null;
  game_name?: string | null;
  affinity?: string | null;
  place_roles?: string[] | string | null;
}
export interface CatalogBusiness extends BusinessMetadata {
  id: string;
  name: string;
  city: string;
  category: string;
  description?: string;
  short_description?: string;
}
export interface NormalizedBusinessMetadata {
  city_id: string | null;
  country_code: string | null;
  region_id: string | null;
  game_name: string | null;
  affinity: string | null;
  place_roles: string[] | null;
}
export interface BusinessFilters {
  city?: string;
  category?: string;
  query?: string;
}
export interface UrbanCatalog {
  default_city_id: string;
  cities: readonly UrbanCity[];
  categories: readonly BusinessCategory[];
}
export const DEFAULT_CITY_ID: 'CO-MET-VVC';
export const BUSINESS_CATEGORIES: readonly BusinessCategory[];
export const URBAN_CITIES: readonly UrbanCity[];
export function normalizeSearchText(value: unknown): string;
export function getBusinessCategory(category: unknown): BusinessCategory | undefined;
export function getCategoryLabel(category: unknown): string;
export function findUrbanCity(value: unknown): UrbanCity | undefined;
export function normalizeStoreMetadata<T extends CatalogBusiness>(
  store: T
): T & NormalizedBusinessMetadata;
export function getStoreCityKey(store: CatalogBusiness): string;
export function getStoreLocationLabel(store: CatalogBusiness): string;
export function filterBusinessStores<T extends CatalogBusiness>(
  stores: T[],
  filters?: BusinessFilters
): T[];
export function urbanCatalog(): UrbanCatalog;
