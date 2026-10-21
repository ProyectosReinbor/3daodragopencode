import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountFoodieWorld } from './foodie-world.js';
import { buyConsumables } from '../shared/world-shop.js';
import { initialWorldProgress } from '../shared/world-items.js';

test('shop rejects invalid or unaffordable packages without partial mutations', () => {
  const world = initialWorldProgress(), before = structuredClone(world);
  for (const [item, quantity] of [['potions', 3], ['mana', 5], ['potions', '1'], ['mana', 0], ['mana', -1], ['mana', 2], ['mana', 1.5], ['mana', null], ['__proto__', 1], ['constructor', 1]]) {
    assert.throws(() => buyConsumables(world, item, quantity));
    assert.deepEqual(world, before);
  }
  buyConsumables(world, 'potions');
  assert.equal(world.coins, 25);
  assert.equal(world.potions, 4);
  world.coins = 60;
  buyConsumables(world, 'mana', 5);
  assert.equal(world.coins, 0);
  assert.equal(world.mana, 8);
});

test('shop API owns prices and quantities and requires the account session', async () => {
  let profile = { characters: { characters: [{ id: 'pet' }] }, world: { ...initialWorldProgress(), coins: 100 } };
  const app = express(); app.use(express.json());
  mountFoodieWorld(app, { auth: (req, res, next) => { req.phone = req.headers['x-user'] || 'owner'; next(); }, getProfile: () => structuredClone(profile), saveProfile: (_phone, p) => { profile = structuredClone(p); } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  let session;
  const request = async (body, path = 'action', user = 'owner') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/world/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user': user }, body: JSON.stringify({ session, requestId: crypto.randomUUID(), ...body }) });
    return { status: response.status, data: await response.json() };
  };
  try {
    session = (await request({ characterId: 'pet' }, 'start')).data.session;
    assert.equal((await request({ action: 'buy', item: 'mana', quantity: 3 }, 'action', 'other')).status, 409);
    assert.equal((await request({ action: 'buy', item: 'mana', quantity: 3, price: 0 })).status, 200);
    assert.equal(profile.world.coins, 64);
    assert.equal(profile.world.mana, 6);
    const before = structuredClone(profile);
    assert.equal((await request({ action: 'buy', item: 'potions', quantity: 5 })).status, 400);
    assert.equal((await request({ action: 'buy', item: 'mana', quantity: '3' })).status, 400);
    assert.deepEqual(profile, before);
    assert.equal((await request({ action: 'buy', item: 'potions' })).status, 200);
    assert.equal(profile.world.coins, 49);
    assert.equal(profile.world.potions, 4);
    const intent = { action: 'buy', item: 'mana', quantity: 1, requestId: 'repeat-purchase-qa' };
    const results = await Promise.all([request(intent), request(intent)]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.equal(profile.world.coins, 37);
    assert.equal(profile.world.mana, 7);
    assert.equal((await request({ ...intent, quantity: 3 })).status, 409);
    assert.equal((await request({ ...intent, item: 'potions' })).status, 409);
    session = (await request({ characterId: 'pet' }, 'start')).data.session;
    assert.equal((await request(intent)).status, 200);
    assert.equal(profile.world.coins, 37);
    assert.equal((await request({ ...intent, requestId: null })).status, 400);
    assert.equal((await request({ ...intent, requestId: '__proto__' })).status, 400);

  } finally { await new Promise(resolve => server.close(resolve)); }
});
