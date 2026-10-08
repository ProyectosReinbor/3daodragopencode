import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase } from './database.js';

const base = 'http://127.0.0.1:3113';
let child, directory, token, petId;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, body, auth = token) {
  const response = await fetch(base + '/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
async function action(action, fields = {}) {
  return request('/guardian/action', { action, requestId: randomUUID(), ...fields });
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'foodie-guardian-e2e-'));
  child = spawn(process.execPath, [resolve('server/index.js')], {
    env: { ...process.env, NODE_ENV: 'test', PORT: '3113', JWT_SECRET: 'guardian-e2e-local-only', FOODIE_TEST_DATA_DIR: directory, AODASE_INCUBATION_MS: '90000' },
    stdio: 'ignore', windowsHide: true,
  });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('El servidor aislado no pudo arrancar.');
    try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* starting */ }
    await pause(100);
  }
  const user = await request('/register', { phone: '901010001', password: 'guardian-e2e-test-only' }, null);
  assert.equal(user.status, 200); token = user.data.token;
  const session = (await request('/onboarding', {})).data;
  const configured = await request(`/onboarding/${session.id}/customize`, {
    name: 'Guardián de prueba', element: 'aire', bodyType: 'bestia', color: '#6f95bc', powers: ['fireball', 'heal_wave'],
  });
  assert.equal(configured.status, 200);
  await request(`/onboarding/${session.id}/roll`, { attemptId: randomUUID() });
  await request(`/onboarding/${session.id}/dart/start`, { stat: 'atk' });
  await request(`/onboarding/${session.id}/dart/throw`, { accessible: true });
  const claimed = await request(`/onboarding/${session.id}/claim`, {});
  assert.equal(claimed.status, 200); petId = claimed.data.characters.characters[0].id;
});
after(async () => {
  if (child?.exitCode === null) {
    const ended = new Promise(resolve => child.once('exit', resolve)); child.kill(); await ended;
  }
  if (directory) { for (const file of await readdir(directory)) await unlink(join(directory, file)); await rmdir(directory); }
});

test('guardian requires auth, preserves founder and hides the genotype', async () => {
  assert.equal((await request('/guardian', undefined, null)).status, 401);
  const first = await request('/guardian');
  assert.equal(first.status, 200);
  assert.equal(first.data.profile.characters.characters[0].id, petId);
  const summary = first.data.guardian.genetics[petId];
  assert.equal(summary.generation, 0);
  assert.ok(summary.hiddenGenes > 0);
  assert.equal(summary.alleles, undefined);
  assert.equal(summary._genome, undefined);
  assert.ok(!JSON.stringify(first.data.guardian).includes('cooldowns'));
  const next = await request('/guardian');
  assert.equal(next.data.profile.revision, first.data.profile.revision);
});

test('care persists, cannot change another pet and request replay applies once', async () => {
  const foreign = await action('feed', { petId: 'FP-not-owned' });
  assert.equal(foreign.status, 403);
  const original = (await request('/guardian')).data;
  const requestId = randomUUID();
  const body = { action: 'feed', petId, requestId };
  const [one, two] = await Promise.all([request('/guardian/action', body), request('/guardian/action', body)]);
  assert.equal(one.status, 200); assert.equal(two.status, 200);
  const persisted = (await request('/guardian')).data;
  assert.equal(persisted.guardian.food, original.guardian.food - 1);
  assert.ok(persisted.guardian.care[petId].satiety > original.guardian.care[petId].satiety);
  assert.equal((await request('/guardian/action', { action: 'play', petId, requestId })).status, 409);
  assert.equal((await action('train', { petId })).status, 429);
});

test('mission reward is atomic and claimed only once even with separate request IDs', async () => {
  const before = (await request('/guardian')).data;
  const [one, two] = await Promise.all([
    action('claim_mission', { missionId: 'firstcare', petId }),
    action('claim_mission', { missionId: 'firstcare', petId }),
  ]);
  assert.equal(one.status, 200); assert.equal(two.status, 200);
  const saved = (await request('/guardian')).data;
  assert.equal(saved.guardian.food, before.guardian.food + 5);
  assert.equal(saved.profile.world.coins, (before.profile.world?.coins ?? 40) + 10);
  assert.equal(saved.guardian.missions.find(m => m.id === 'firstcare').claimed, true);
});

test('egg matures on server time and creates one new canonical pet', async () => {
  const chosen = await action('choose_egg', { theme: 'fire' });
  assert.equal(chosen.status, 200);
  const egg = chosen.data.guardian.eggs[0];
  assert.equal(egg.readyAt - chosen.data.guardian.serverNow, 90000);
  const originalPet = chosen.data.profile.characters.characters[0];
  assert.equal((await action('hatch', { eggId: egg.id })).status, 409);
  for (let i = 0; i < 3; i++) {
    if (i) await pause(3050);
    const warm = await action('warm_egg', { eggId: egg.id });
    assert.equal(warm.status, 200);
  }
  assert.equal((await request('/guardian')).data.guardian.eggs[0].status, 'ready');
  // Backdate only the egg in the isolated test DB; keep a full ninety-second
  // incubation interval and avoid an insecure production test override.
  const database = await createDatabase(join(directory, 'game.db'));
  try {
    const stored = database.prepare('SELECT data FROM foodie_guardians WHERE phone = ?').get('901010001');
    const guardian = JSON.parse(stored.data), persistedEgg = guardian.eggs.find(candidate => candidate.id === egg.id);
    persistedEgg.createdAt = Date.now() - 90100;
    persistedEgg.readyAt = persistedEgg.createdAt + 90000;
    database.prepare('UPDATE foodie_guardians SET data = ? WHERE phone = ?').run(JSON.stringify(guardian), '901010001');
  } finally { database.close(); }
  const requestId = randomUUID();
  const [born, repeated] = await Promise.all([
    request('/guardian/action', { action: 'hatch', eggId: egg.id, requestId }),
    request('/guardian/action', { action: 'hatch', eggId: egg.id, requestId }),
  ]);
  assert.equal(born.status, 200); assert.equal(repeated.status, 200);
  assert.equal(born.data.profile.characters.characters.length, 2);
  const newbornId = born.data.guardian.eggs[0].petId;
  assert.equal(newbornId, repeated.data.guardian.eggs[0].petId);
  const saved = (await request('/profile')).data;
  assert.equal(saved.characters.characters.length, 2);
  assert.deepEqual(saved.characters.characters.find(p => p.id === originalPet.id), originalPet);
  assert.equal(saved.selectedCharacter, originalPet.id);
  assert.ok(saved.characters.characters.some(p => p.id === newbornId));
  const again = await action('hatch', { eggId: egg.id });
  assert.equal(again.data.profile.characters.characters.length, 2);
  const another = await action('choose_egg', { theme: 'mystery' });
  assert.equal(another.data.guardian.eggs.length, 1);
});
