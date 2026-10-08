import {
  DEFAULT_CITY_ID, URBAN_CITIES, findUrbanCity, getBusinessCategory,
  normalizeSearchText, normalizeStoreMetadata, urbanCatalog,
} from '../shared/urban-catalog.js';

const DEMO_SIGNATURES = [
  ['hamburguesas-reino', 'Hamburguesas del Reino', 'Madrid'],
  ['pizzeria-imperial', 'Pizzería Imperial', 'Barcelona'],
  ['heladeria-dragon', 'Heladería Dragón Azul', 'Valencia'],
  ['cafe-medieval', 'Café Medieval', 'Sevilla'],
  ['panaderia-bosque', 'Panadería del Bosque', 'Granada'],
];

export class UrbanBusinessError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function validCoordinates(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/** DTO coordinates indicate loaded data only; they never establish a verified physical visit. */
export function presentUrbanStore(row) {
  const loaded = (row.location_known === 1 || row.location_known === true) && validCoordinates(row.lat, row.lng);
  return {
    ...normalizeStoreMetadata(row),
    active: row.active === 1 || row.active === true,
    is_demo: row.is_demo === 1 || row.is_demo === true,
    location_known: loaded,
    lat: loaded ? row.lat : null,
    lng: loaded ? row.lng : null,
  };
}

/** Additive migration preserves store IDs, QR references, relationships and legacy values. */
export function migrateUrbanBusinesses(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(stores)').all().map(column => column.name));
  if (!columns.size) throw new Error('Create the stores table before migrating the urban catalog.');
  const newLocationFlag = !columns.has('location_known');
  db.transaction(() => {
    for (const column of ['city_id', 'country_code', 'region_id', 'game_name', 'affinity', 'place_roles']) {
      if (!columns.has(column)) db.exec(`ALTER TABLE stores ADD COLUMN ${column} TEXT`);
    }
    if (newLocationFlag) db.exec('ALTER TABLE stores ADD COLUMN location_known INTEGER NOT NULL DEFAULT 0');
    if (!columns.has('is_demo')) db.exec('ALTER TABLE stores ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0');
    const locate = db.prepare('UPDATE stores SET location_known = ? WHERE id = ?');
    const cityMetadata = db.prepare('UPDATE stores SET city_id = ?, country_code = ?, region_id = ? WHERE id = ?');
    for (const row of db.prepare('SELECT * FROM stores').all()) {
      if (newLocationFlag) locate.run(validCoordinates(row.lat, row.lng) && !(row.lat === 0 && row.lng === 0) ? 1 : 0, row.id);
      if (!row.city_id && findUrbanCity(row.city)) {
        const city = findUrbanCity(row.city);
        cityMetadata.run(city.id, city.country_code, city.region_id, row.id);
      }
    }
    const markDemo = db.prepare('UPDATE stores SET is_demo = 1 WHERE id = ? AND name = ? AND city = ?');
    for (const signature of DEMO_SIGNATURES) markDemo.run(...signature);
  })();
}

function text(value, field, max, { nullable = false, required = false } = {}) {
  if (nullable && (value == null || value === '')) return null;
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    throw new UrbanBusinessError(`${field}: introduce un texto${required ? ' no vacío' : ''} de hasta ${max} caracteres.`);
  return value.trim();
}

function coordinate(value, field, bound) {
  if (typeof value !== 'number' && typeof value !== 'string') throw new UrbanBusinessError(`${field}: coordenada inválida.`);
  if (typeof value === 'string' && !value.trim()) throw new UrbanBusinessError(`${field}: coordenada inválida.`);
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > bound) throw new UrbanBusinessError(`${field}: debe estar entre -${bound} y ${bound}.`);
  return number;
}

/** Validate declared catalog data. No visit, mission, affinity effect or reward is awarded here. */
export function normalizeBusinessInput(input, existing = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new UrbanBusinessError('Datos del negocio inválidos.');
  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  if (existing && has('id') && input.id !== existing.id) throw new UrbanBusinessError('El ID del negocio no se puede cambiar.');
  const store = existing ? { ...existing } : {
    id: '', name: '', logo_url: '', category: 'otros', city: 'Villavicencio', description: '',
    short_description: '', banner_url: '', lat: 0, lng: 0, hours: '', active: 1,
    city_id: DEFAULT_CITY_ID, country_code: 'CO', region_id: 'CO-MET',
    game_name: null, affinity: null, place_roles: null, location_known: 0, is_demo: 0,
  };
  if (!existing) {
    store.id = text(input.id, 'id', 80, { required: true });
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(store.id)) throw new UrbanBusinessError('id: usa letras, números, guiones o guiones bajos.');
  }
  if (!existing || has('name')) store.name = text(input.name, 'name', 120, { required: true });
  if (has('category')) {
    if (!getBusinessCategory(input.category)) throw new UrbanBusinessError('Selecciona una categoría del catálogo.');
    store.category = input.category;
  }
  for (const [key, max] of Object.entries({ description: 4000, short_description: 400, hours: 160, logo_url: 2000, banner_url: 2000 })) {
    if (has(key)) store[key] = text(input[key], key, max);
  }
  if (has('city')) {
    store.city = text(input.city, 'city', 120, { required: true });
    if (!has('city_id')) {
      const inferred = findUrbanCity(store.city);
      store.city_id = inferred?.id || null;
      store.country_code = inferred?.country_code || null;
      store.region_id = inferred?.region_id || null;
    }
  }
  if (has('city_id')) {
    store.city_id = text(input.city_id, 'city_id', 40, { nullable: true });
    if (store.city_id && !URBAN_CITIES.some(city => city.id === store.city_id)) throw new UrbanBusinessError('city_id no está habilitada en el catálogo de ciudades.');
    if (!store.city_id) { store.country_code = null; store.region_id = null; }
  }
  const city = findUrbanCity(store.city_id);
  if (city) {
    if (has('city') && normalizeSearchText(store.city) !== normalizeSearchText(city.name)) throw new UrbanBusinessError('city y city_id deben corresponder a la misma ciudad.');
    if (!has('city') && has('city_id')) store.city = city.name;
    if (has('country_code') && input.country_code !== city.country_code) throw new UrbanBusinessError('country_code no corresponde a la ciudad.');
    if (has('region_id') && input.region_id !== city.region_id) throw new UrbanBusinessError('region_id no corresponde a la ciudad.');
    store.country_code = city.country_code;
    store.region_id = city.region_id;
  } else {
    if (has('country_code')) {
      store.country_code = text(input.country_code, 'country_code', 2, { nullable: true });
      if (store.country_code && !/^[A-Z]{2}$/.test(store.country_code)) throw new UrbanBusinessError('country_code debe usar dos letras mayúsculas.');
    }
    if (has('region_id')) store.region_id = text(input.region_id, 'region_id', 40, { nullable: true });
  }
  for (const field of ['game_name', 'affinity']) if (has(field)) store[field] = text(input[field], field, 80, { nullable: true });
  if (has('place_roles')) {
    if (input.place_roles === null) store.place_roles = null;
    else {
      if (!Array.isArray(input.place_roles) || input.place_roles.length > 8) throw new UrbanBusinessError('place_roles debe ser una lista de hasta 8 roles.');
      store.place_roles = JSON.stringify([...new Set(input.place_roles.map(role => text(role, 'place_roles', 40, { required: true })))]);
    }
  }
  if (has('lat') !== has('lng')) throw new UrbanBusinessError('Carga lat y lng juntas, o deja ambas sin ubicación.');
  if (has('lat')) {
    const empty = value => value === null || value === '';
    if (empty(input.lat) && empty(input.lng)) {
      store.lat = store.lng = 0;
      store.location_known = 0;
    } else {
      store.lat = coordinate(input.lat, 'lat', 90);
      store.lng = coordinate(input.lng, 'lng', 180);
      store.location_known = 1;
    }
  }
  if (has('active')) {
    if (![true, false, 0, 1].includes(input.active)) throw new UrbanBusinessError('active debe ser verdadero o falso.');
    store.active = input.active ? 1 : 0;
  }
  return store;
}

export function mountUrbanBusinesses(app, { db, adminAuth }) {
  migrateUrbanBusinesses(db);
  app.get('/api/urban/catalog', (_req, res) => res.json(urbanCatalog()));
  app.get('/api/cities', (_req, res) => res.json({ cities: URBAN_CITIES, default_city_id: DEFAULT_CITY_ID }));
  const fields = ['id', 'name', 'logo_url', 'category', 'city', 'description', 'short_description', 'banner_url', 'lat', 'lng', 'hours', 'active', 'city_id', 'country_code', 'region_id', 'game_name', 'affinity', 'place_roles', 'location_known', 'is_demo'];
  const read = db.prepare('SELECT * FROM stores WHERE id = ?');
  const insert = db.prepare(`INSERT INTO stores (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`);
  const update = db.prepare(`UPDATE stores SET ${fields.slice(1).map(field => `${field} = ?`).join(', ')} WHERE id = ?`);
  const handle = action => (req, res) => {
    try { res.json({ ok: true, store: presentUrbanStore(action(req)) }); }
    catch (error) {
      if (error instanceof UrbanBusinessError) return res.status(error.status).json({ error: error.message });
      console.error('[AODASE urban catalog]', error);
      return res.status(500).json({ error: 'No se pudo guardar el negocio.' });
    }
  };
  const create = db.transaction(body => {
    const store = normalizeBusinessInput(body);
    if (read.get(store.id)) throw new UrbanBusinessError('Ya existe un negocio con ese ID.', 409);
    insert.run(...fields.map(field => store[field]));
    return read.get(store.id);
  });
  const edit = db.transaction((id, body) => {
    const previous = read.get(id);
    if (!previous) throw new UrbanBusinessError('Negocio no encontrado.', 404);
    const store = normalizeBusinessInput(body, previous);
    update.run(...fields.slice(1).map(field => store[field]), id);
    return read.get(id);
  });
  app.post('/api/admin/stores', adminAuth, handle(req => create(req.body)));
  app.patch('/api/admin/stores/:id', adminAuth, handle(req => edit(req.params.id, req.body)));
  app.put('/api/admin/stores/:id', adminAuth, handle(req => edit(req.params.id, req.body)));
}
