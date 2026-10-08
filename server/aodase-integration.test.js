import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { join, resolve, basename, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase } from './database.js';

const incubationMs = 90000;
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let child, directory, base, token;
let serverOutput = '', startupError;

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function request(path, body, authToken = token) {
  const response = await fetch(base + '/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

const action = (action, fields = {}) => request('/guardian/action', { action, requestId: randomUUID(), ...fields });

// Age only this test's temporary persisted egg. Production has no clock/expiry
// override route; the HTTP assertions still use server/index.js and real time.
async function matureIsolatedEgg(phone, eggId) {
  assert.ok(basename(directory).startsWith('aodase-integration-'));
  const database = await createDatabase(join(directory, 'game.db'));
  try {
    const row = database.prepare('SELECT data FROM foodie_guardians WHERE phone = ?').get(phone);
    const state = JSON.parse(row.data), egg = state.eggs.find(egg => egg.id === eggId);
    egg.createdAt = Date.now() - incubationMs - 100;
    egg.readyAt = egg.createdAt + incubationMs;
    database.prepare('UPDATE foodie_guardians SET data = ?, updated_at = ? WHERE phone = ?').run(JSON.stringify(state), Date.now(), phone);
    return egg.readyAt;
  } finally { database.close(); }
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'aodase-integration-'));
  const port = await availablePort();
  base = `http://127.0.0.1:${port}`;
  const environment = {
    ...process.env, NODE_ENV: 'test', PORT: String(port),
    JWT_SECRET: `aodase-isolated-test-${randomUUID()}`,
    FOODIE_TEST_DATA_DIR: directory, AODASE_INCUBATION_MS: String(incubationMs),
  };
  delete environment.SEED_DEMO_DATA;
  child = spawn(process.execPath, [resolve('server/index.js')], {
    env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  child.once('error', error => { startupError = error; });
  const capture = chunk => { serverOutput = (serverOutput + String(chunk)).slice(-4000); };
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (startupError || child.exitCode !== null) throw new Error(`No se pudo iniciar el servidor aislado: ${startupError?.message || serverOutput}`);
    try { if ((await fetch(base + '/api/health')).ok) return; } catch { /* starting */ }
    await pause(100);
  }
  throw new Error(`Tiempo agotado al iniciar el servidor aislado: ${serverOutput}`);
});

after(async () => {
  if (child?.exitCode === null) {
    const closed = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await closed;
  }
  if (directory) {
    const target = resolve(directory), temporaryRoot = resolve(tmpdir()) + sep;
    assert.ok(target.startsWith(temporaryRoot) && basename(target).startsWith('aodase-integration-'));
    for (const file of await readdir(target)) await unlink(join(target, file));
    await rmdir(target);
  }
});

test('new account enforces ninety seconds and hatches an aged isolated egg before naming it', async () => {
  const registration = await request('/register', { phone: '901020003', password: `aodase-test-${randomUUID()}` }, null);
  assert.equal(registration.status, 200); token = registration.data.token;
  assert.equal((await request('/guardian', undefined, null)).status, 401);
  const rawProfile = (await request('/profile')).data;
  assert.equal(rawProfile.nft, null); assert.equal(rawProfile.characters?.characters?.length || 0, 0);
  assert.equal(rawProfile.revision, 1);
  const home = await request('/guardian'); assert.equal(home.status, 200);
  assert.deepEqual(home.data.profile.characters.characters, []);
  assert.deepEqual(home.data.guardian.care, {}); assert.deepEqual(home.data.guardian.eggs, []);
  assert.equal(home.data.profile.revision, rawProfile.revision);
  assert.equal((await request('/guardian')).data.profile.revision, rawProfile.revision);
  assert.deepEqual((await request('/profile')).data, rawProfile);
  assert.equal((await action('feed')).status, 403);
  assert.equal((await action('rename_pet', { name: 'Pip' })).status, 403);

  const choice = { action: 'choose_egg', theme: 'water', requestId: randomUUID(), readyAt: 0, incubationMs: 0 };
  const chosen = await request('/guardian/action', choice); assert.equal(chosen.status, 200);
  const egg = chosen.data.guardian.eggs[0];
  assert.equal(egg.readyAt - chosen.data.guardian.serverNow, incubationMs);
  assert.equal(chosen.data.profile.characters.characters.length, 0);
  assert.equal((await request('/guardian/action', choice)).data.guardian.eggs[0].id, egg.id);
  assert.equal((await action('choose_egg', { theme: 'fire' })).data.guardian.eggs[0].id, egg.id);
  const prematureBirth = { action: 'hatch', eggId: egg.id, requestId: randomUUID(), serverNow: egg.readyAt + 1 };
  assert.equal((await request('/guardian/action', prematureBirth)).status, 409);

  for (let care = 1; care <= 3; care++) {
    if (care > 1) await pause(3050);
    const warming = { action: 'warm_egg', eggId: egg.id, requestId: randomUUID() };
    const warmed = await request('/guardian/action', warming); assert.equal(warmed.status, 200);
    assert.equal(warmed.data.guardian.eggs[0].care, care);
    assert.equal((await request('/guardian/action', warming)).data.guardian.eggs[0].care, care);
    if (care < 3) assert.equal((await action('warm_egg', { eggId: egg.id })).status, 429);
  }
  assert.equal((await action('claim_mission', { missionId: 'incubation' })).status, 403);
  assert.equal((await request('/guardian')).data.guardian.eggs[0].status, 'ready');
  assert.deepEqual((await request('/profile')).data, rawProfile);
  egg.readyAt = await matureIsolatedEgg('901020003', egg.id);

  const births = await Promise.all([
    request('/guardian/action', prematureBirth), request('/guardian/action', prematureBirth),
    action('hatch', { eggId: egg.id }),
  ]);
  assert.ok(births.every(result => result.status === 200));
  const born = births[0].data, newborn = born.profile.characters.characters[0];
  assert.ok(born.guardian.serverNow >= egg.readyAt);
  assert.equal(born.guardian.eggs[0].status, 'hatched');
  assert.equal(born.profile.characters.characters.length, 1);
  assert.equal(born.profile.characters.selectedId, newborn.id); assert.equal(born.profile.selectedCharacter, newborn.id);
  assert.equal(newborn.isStarter, true); assert.equal(newborn.level, 1); assert.equal(newborn.xp, 0);
  assert.match(newborn.id, /^FP-[0-9a-f-]{36}$/);
  assert.equal(born.profile.revision, rawProfile.revision + 1);
  assert.ok(births.every(result => result.data.guardian.eggs[0].petId === newborn.id));
  assert.ok(!JSON.stringify(born).includes('alleles'));

  const naming = { action: 'rename_pet', petId: newborn.id, name: ' Pétalo ', requestId: randomUUID() };
  const names = await Promise.all([request('/guardian/action', naming), request('/guardian/action', naming)]);
  assert.ok(names.every(result => result.status === 200));
  assert.ok(names.every(result => result.data.profile.characters.characters[0].name === 'Pétalo'));
  const renamedRevision = rawProfile.revision + 2;
  assert.ok(names.every(result => result.data.profile.revision === renamedRevision));
  assert.equal((await request('/guardian/action', { ...naming, name: 'Otro nombre' })).status, 409);
  assert.equal((await action('rename_pet', { petId: newborn.id, name: '<b>Pétalo</b>' })).status, 400);
  assert.equal((await action('rename_pet', { petId: 'FP-not-owned', name: 'Pip' })).status, 403);
  const saved = (await request('/profile')).data;
  assert.equal(saved.characters.characters.length, 1);
  assert.equal(saved.characters.characters[0].name, 'Pétalo'); assert.equal(saved.revision, renamedRevision);
  assert.equal(saved.characters.selectedId, newborn.id); assert.equal(saved.selectedCharacter, newborn.id);
  assert.equal((await request('/guardian')).data.profile.revision, renamedRevision);
});

test('urban catalog publishes thirteen categories and Villavicencio without demo stores', async () => {
  const catalog = await request('/urban/catalog', undefined, null); assert.equal(catalog.status, 200);
  assert.equal(catalog.data.categories.length, 13);
  assert.deepEqual(catalog.data.categories.map(category => category.id), [
    'restaurante', 'comida_rapida', 'postres', 'panaderia', 'cafeteria', 'tienda', 'moda',
    'gimnasio', 'entretenimiento', 'servicios', 'tecnologia', 'centro_comercial', 'otros',
  ]);
  assert.equal(new Set(catalog.data.categories.map(category => category.id)).size, 13);
  const city = catalog.data.cities.find(city => city.id === catalog.data.default_city_id);
  assert.equal(city.name, 'Villavicencio'); assert.equal(city.country_code, 'CO'); assert.equal(city.region_name, 'Meta');
  const cities = await request('/cities', undefined, null); assert.equal(cities.status, 200);
  assert.equal(cities.data.default_city_id, city.id);
  assert.deepEqual(cities.data.cities, catalog.data.cities);
  const stores = await request('/stores', undefined, null); assert.equal(stores.status, 200);
  assert.deepEqual(stores.data.stores, []);
});

test('store creation rejects an ordinary account and leaves the public list empty', async () => {
  const business = { id: 'isolated-test-shop', name: 'Negocio de prueba', city_id: 'CO-MET-VVC', category: 'tienda' };
  assert.equal((await request('/admin/stores', business, null)).status, 401);
  const ordinaryAccount = await request('/admin/stores', business);
  assert.equal(ordinaryAccount.status, 401);
  assert.match(ordinaryAccount.data.error, /admin/i);
  assert.deepEqual((await request('/stores', undefined, null)).data.stores, []);
});
