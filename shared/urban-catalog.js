/** Shared IDs keep existing commerce records compatible as AODASE PETS adds local sectors. */
export const BUSINESS_CATEGORIES = Object.freeze(
  [
    { id: 'restaurante', label: 'Restaurantes', icon: '🍽️' },
    { id: 'comida_rapida', label: 'Comida rápida', icon: '🍔' },
    { id: 'postres', label: 'Postres', icon: '🍨' },
    { id: 'panaderia', label: 'Panaderías', icon: '🥖' },
    { id: 'cafeteria', label: 'Cafeterías', icon: '☕' },
    { id: 'tienda', label: 'Tiendas', icon: '🛍️' },
    { id: 'moda', label: 'Moda', icon: '👕' },
    { id: 'gimnasio', label: 'Gimnasios', icon: '🏋️' },
    { id: 'entretenimiento', label: 'Entretenimiento', icon: '🎟️' },
    { id: 'servicios', label: 'Servicios', icon: '🛠️' },
    { id: 'tecnologia', label: 'Tecnología', icon: '💻' },
    { id: 'centro_comercial', label: 'Centros comerciales', icon: '🏬' },
    { id: 'otros', label: 'Otros negocios', icon: '📍' },
  ].map(Object.freeze)
);

export const DEFAULT_CITY_ID = 'CO-MET-VVC';

/** Add verified cities here as the rollout expands. A city record does not imply partners. */
export const URBAN_CITIES = Object.freeze([
  Object.freeze({
    id: DEFAULT_CITY_ID,
    name: 'Villavicencio',
    country_code: 'CO',
    country_name: 'Colombia',
    region_id: 'CO-MET',
    region_name: 'Meta',
    timezone: 'America/Bogota',
    pilot: true,
  }),
]);

export function normalizeSearchText(value) {
  return typeof value === 'string'
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('es')
    : '';
}

export function getBusinessCategory(category) {
  return BUSINESS_CATEGORIES.find((entry) => entry.id === category);
}

export function getCategoryLabel(category) {
  const known = getBusinessCategory(category);
  if (known) return known.label;
  const readable = typeof category === 'string' ? category.replace(/[_-]+/g, ' ').trim() : '';
  return readable
    ? readable.charAt(0).toLocaleUpperCase('es') + readable.slice(1)
    : 'Sin categoría';
}

export function findUrbanCity(value) {
  const needle = normalizeSearchText(value);
  return URBAN_CITIES.find(
    (city) => normalizeSearchText(city.id) === needle || normalizeSearchText(city.name) === needle
  );
}

function optionalText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePlaceRoles(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  return [
    ...new Set(
      value.filter((role) => typeof role === 'string' && role.trim()).map((role) => role.trim())
    ),
  ].slice(0, 8);
}

/** Enrich legacy city text without changing the original ID, city or category columns. */
export function normalizeStoreMetadata(store) {
  const city =
    findUrbanCity(store.city_id) ||
    (!optionalText(store.city_id) ? findUrbanCity(store.city) : undefined);
  return {
    ...store,
    city_id: city?.id || optionalText(store.city_id),
    country_code: city?.country_code || optionalText(store.country_code),
    region_id: city?.region_id || optionalText(store.region_id),
    game_name: optionalText(store.game_name),
    affinity: optionalText(store.affinity),
    place_roles: normalizePlaceRoles(store.place_roles),
  };
}

export function getStoreCityKey(store) {
  const normalized = normalizeStoreMetadata(store);
  return (
    normalized.city_id ||
    (normalizeSearchText(store.city) ? `legacy:${normalizeSearchText(store.city)}` : 'unassigned')
  );
}

export function getStoreLocationLabel(store) {
  const normalized = normalizeStoreMetadata(store);
  const city = findUrbanCity(normalized.city_id);
  if (city) return `${city.name} · ${city.region_name}`;
  return optionalText(store.city) || 'Ciudad por confirmar';
}

/** Pure filtering is shared by UI tests and permits legacy categories/cities to remain visible. */
export function filterBusinessStores(stores, filters = {}) {
  const words = normalizeSearchText(filters.query).split(/\s+/).filter(Boolean);
  return stores.filter((store) => {
    if (filters.city && getStoreCityKey(store) !== filters.city) return false;
    if (filters.category && store.category !== filters.category) return false;
    const text = normalizeSearchText(
      [
        store.name,
        store.description,
        store.short_description,
        store.game_name,
        getCategoryLabel(store.category),
      ]
        .filter(Boolean)
        .join(' ')
    );
    return words.every((word) => text.includes(word));
  });
}

export function urbanCatalog() {
  return {
    default_city_id: DEFAULT_CITY_ID,
    cities: URBAN_CITIES,
    categories: BUSINESS_CATEGORIES,
  };
}
