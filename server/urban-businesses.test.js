import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createDatabase } from './database.js';
import { migrateUrbanBusinesses, mountUrbanBusinesses, normalizeBusinessInput, presentUrbanStore } from './urban-businesses.js';

async function legacyDatabase() {
  const db = await createDatabase(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE stores (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, logo_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
    short_description TEXT NOT NULL DEFAULT '', banner_url TEXT NOT NULL DEFAULT '',
    lat REAL NOT NULL DEFAULT 0, lng REAL NOT NULL DEFAULT 0, hours TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1
  ); CREATE TABLE products (id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE);
  CREATE TABLE invoice_codes (code TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id));`);
  return db;
}

test('additive migration keeps legacy coordinates, IDs, FK and QR records and only marks exact demo signatures', async () => {
  const db = await legacyDatabase();
  try {
    const insert = db.prepare('INSERT INTO stores(id,name,city,category,lat,lng) VALUES (?,?,?,?,?,?)');
    insert.run('hamburguesas-reino', 'Hamburguesas del Reino', 'Madrid', 'comida_rapida', 40.4168, -3.7038);
    insert.run('pizzeria-imperial', 'Negocio real con ID legado', 'Barcelona', 'tienda', 0, 0);
    insert.run('vvc', 'Negocio del Llano', 'VILLAVICENCIO', 'servicios', 4.15, -73.64);
    db.prepare('INSERT INTO products VALUES (?,?)').run('existing-product', 'hamburguesas-reino');
    db.prepare('INSERT INTO invoice_codes VALUES (?,?)').run('EXISTING-QR', 'existing-product');
    migrateUrbanBusinesses(db); migrateUrbanBusinesses(db);
    const demo = db.prepare('SELECT * FROM stores WHERE id=?').get('hamburguesas-reino');
    assert.equal(demo.lat, 40.4168);
    assert.equal(demo.city, 'Madrid');
    assert.equal(demo.category, 'comida_rapida');
    assert.equal(presentUrbanStore(demo).is_demo, true);
    const real = db.prepare('SELECT * FROM stores WHERE id=?').get('pizzeria-imperial');
    assert.equal(real.is_demo, 0);
    assert.equal(real.lat, 0);
    assert.equal(presentUrbanStore(real).lat, null);
    const pilot = db.prepare('SELECT * FROM stores WHERE id=?').get('vvc');
    assert.equal(pilot.city, 'VILLAVICENCIO');
    assert.equal(pilot.city_id, 'CO-MET-VVC');
    assert.equal(pilot.country_code, 'CO');
    assert.equal(pilot.region_id, 'CO-MET');
    assert.equal(presentUrbanStore(pilot).location_known, true);
    assert.equal(db.prepare('SELECT product_id FROM invoice_codes WHERE code=?').get('EXISTING-QR').product_id, 'existing-product');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

test('validators retain absent legacy fields while rejecting unsupported categories/cities and invalid coordinate pairs', () => {
  const input = { id: 'fashion-vvc', name: 'Moda del Llano', category: 'moda', city_id: 'CO-MET-VVC' };
  const created = normalizeBusinessInput(input);
  assert.equal(created.city, 'Villavicencio');
  assert.equal(created.location_known, 0);
  assert.equal(presentUrbanStore(created).lat, null);
  assert.throws(() => normalizeBusinessInput({ ...input, category: 'fake_category' }), /categoría/);
  assert.throws(() => normalizeBusinessInput({ ...input, city_id: 'CO-UNKNOWN' }), /city_id/);
  assert.throws(() => normalizeBusinessInput({ ...input, city: 'Madrid' }), /misma ciudad/);
  assert.throws(() => normalizeBusinessInput({ ...input, lat: 4.15 }), /juntas/);
  assert.throws(() => normalizeBusinessInput({ ...input, lat: 91, lng: -73.64 }), /lat/);
  assert.throws(() => normalizeBusinessInput({ ...input, lat: 4.15, lng: -181 }), /lng/);
  assert.throws(() => normalizeBusinessInput({ ...input, lat: '', lng: -73.64 }), /lat/);
  const explicitZero = normalizeBusinessInput({ ...input, lat: 0, lng: 0 });
  assert.equal(presentUrbanStore(explicitZero).lat, 0);
  assert.equal(presentUrbanStore(explicitZero).location_known, true);
  const legacy = { ...created, id: 'old-id', city: 'Madrid', category: 'artesania_local', city_id: null, country_code: null, region_id: null, lat: 40.4, lng: -3.7, location_known: 1 };
  const edited = normalizeBusinessInput({ name: 'Nombre actualizado' }, legacy);
  assert.equal(edited.id, 'old-id');
  assert.equal(edited.category, 'artesania_local');
  assert.equal(edited.city, 'Madrid');
  assert.equal(edited.lat, 40.4);
  assert.throws(() => normalizeBusinessInput({ id: 'changed-id' }, legacy), /no se puede cambiar/);
});

test('urban catalog endpoints seed no businesses and admin create/update persist canonical and optional metadata', async () => {
  const db = await legacyDatabase();
  const app = express(); app.use(express.json());
  const adminAuth = (req, res, next) => req.headers.authorization === 'Bearer catalog-test-admin' ? next() : res.status(403).json({ error: 'Admin required' });
  mountUrbanBusinesses(app, { db, adminAuth });
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, body, method = 'POST', authenticated = true) {
    const response = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer catalog-test-admin' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    const catalog = await request('/api/urban/catalog', null, 'GET', false);
    assert.equal(catalog.status, 200);
    assert.equal(catalog.data.categories.length, 13);
    assert.equal(catalog.data.default_city_id, 'CO-MET-VVC');
    const cities = await request('/api/cities', null, 'GET', false);
    assert.equal(cities.data.cities.length, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM stores').get().count, 0);
    assert.equal((await request('/api/admin/stores', { id: 'no-auth', name: 'No auth' }, 'POST', false)).status, 403);
    const created = await request('/api/admin/stores', { id: 'fashion-vvc', name: 'Moda del Llano', category: 'moda', city_id: 'CO-MET-VVC' });
    assert.equal(created.status, 200);
    assert.equal(created.data.store.city, 'Villavicencio');
    assert.equal(created.data.store.lat, null);
    assert.equal(created.data.store.location_known, false);
    assert.equal(created.data.store.is_demo, false);
    assert.equal((await request('/api/admin/stores', { id: 'fashion-vvc', name: 'Duplicado' })).status, 409);
    const updated = await request('/api/admin/stores/fashion-vvc', { lat: '4.15', lng: '-73.64', game_name: 'El Telar', affinity: 'creatividad', place_roles: ['comercio', 'comercio'], active: false }, 'PATCH');
    assert.equal(updated.status, 200);
    assert.equal(updated.data.store.lat, 4.15);
    assert.equal(updated.data.store.lng, -73.64);
    assert.equal(updated.data.store.game_name, 'El Telar');
    assert.deepEqual(updated.data.store.place_roles, ['comercio']);
    assert.equal(updated.data.store.active, false);
    const invalid = await request('/api/admin/stores/fashion-vvc', { lat: 4.15, lng: 500 }, 'PATCH');
    assert.equal(invalid.status, 400);
    assert.equal(db.prepare('SELECT lng FROM stores WHERE id=?').get('fashion-vvc').lng, -73.64);
    const cleared = await request('/api/admin/stores/fashion-vvc', { lat: null, lng: null }, 'PUT');
    assert.equal(cleared.data.store.lat, null);
    assert.equal(cleared.data.store.location_known, false);
    assert.equal((await request('/api/admin/stores/missing', { name: 'Missing' }, 'PATCH')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});
