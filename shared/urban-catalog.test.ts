import { describe, expect, it } from 'vitest';
import {
  BUSINESS_CATEGORIES,
  DEFAULT_CITY_ID,
  URBAN_CITIES,
  filterBusinessStores,
  getCategoryLabel,
  getStoreCityKey,
  getStoreLocationLabel,
  normalizeStoreMetadata,
} from './urban-catalog';

describe('shared urban catalog', () => {
  const base = { id: 'existing-id', name: 'Negocio', city: '  VILLAVICENCIO ', category: 'tienda' };
  it('keeps all historic food IDs and opens the catalog to other local sectors', () => {
    const ids = BUSINESS_CATEGORIES.map((category) => category.id);
    expect(ids).toHaveLength(13);
    expect(ids).toEqual(
      expect.arrayContaining([
        'restaurante',
        'comida_rapida',
        'postres',
        'panaderia',
        'cafeteria',
        'tienda',
        'moda',
        'gimnasio',
        'entretenimiento',
        'servicios',
        'tecnologia',
        'centro_comercial',
        'otros',
      ])
    );
    expect(URBAN_CITIES).toEqual([
      expect.objectContaining({
        id: DEFAULT_CITY_ID,
        name: 'Villavicencio',
        country_code: 'CO',
        region_id: 'CO-MET',
        timezone: 'America/Bogota',
      }),
    ]);
  });
  it('adds canonical pilot metadata without changing legacy IDs, city or category text', () => {
    const store = normalizeStoreMetadata(base);
    expect(store).toMatchObject({
      ...base,
      city_id: 'CO-MET-VVC',
      country_code: 'CO',
      region_id: 'CO-MET',
    });
    expect(getStoreLocationLabel(store)).toBe('Villavicencio · Meta');
    expect(
      normalizeStoreMetadata({ ...base, city: 'Madrid', category: 'artesania_local' })
    ).toMatchObject({
      city_id: null,
      country_code: null,
      region_id: null,
      category: 'artesania_local',
    });
    expect(getCategoryLabel('artesania_local')).toBe('Artesania local');
    expect(getStoreCityKey({ ...base, city: ' Bogotá ' })).toBe('legacy:bogota');
  });
  it('reads optional role JSON without exposing malformed metadata as roles', () => {
    expect(
      normalizeStoreMetadata({
        ...base,
        game_name: ' El Refugio ',
        place_roles: '["refugio","refugio","comercio"]',
      })
    ).toMatchObject({ game_name: 'El Refugio', place_roles: ['refugio', 'comercio'] });
    expect(normalizeStoreMetadata({ ...base, place_roles: 'invalid-json' }).place_roles).toBeNull();
    expect(getStoreLocationLabel({ ...base, city: '' })).toBe('Ciudad por confirmar');
  });
  it('combines city, category and accent-insensitive terms from actual descriptions', () => {
    const stores = [
      {
        ...base,
        id: 'sport',
        name: 'Gimnasio Río',
        category: 'gimnasio',
        description: 'Entrenamiento y recuperación muscular',
      },
      {
        ...base,
        id: 'fashion',
        name: 'Moda Llanera',
        category: 'moda',
        description: 'Prendas y accesorios',
      },
      {
        ...base,
        id: 'legacy',
        name: 'Servicio Río',
        city: 'Madrid',
        category: 'servicios',
        description: 'Recuperación',
      },
    ];
    expect(
      filterBusinessStores(stores, {
        city: DEFAULT_CITY_ID,
        category: 'gimnasio',
        query: 'rio RECUPERACION',
      }).map((store) => store.id)
    ).toEqual(['sport']);
    expect(
      filterBusinessStores(stores, { city: 'legacy:madrid' }).map((store) => store.id)
    ).toEqual(['legacy']);
    expect(filterBusinessStores(stores, { query: 'producto inexistente' })).toEqual([]);
  });
});
