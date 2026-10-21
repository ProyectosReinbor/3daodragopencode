import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseOnce } from './world-purchases.js';
import { initialWorldProgress } from '../shared/world-items.js';
import { mountFoodieWorld } from './foodie-world.js';

test('purchase receipts survive serialization and replay even when the balance is no longer sufficient', () => {
  const world = { ...initialWorldProgress(), coins: 15 };
  const intent = { requestId: 'purchase-test-001', item: 'potions', quantity: 1 };
  assert.equal(purchaseOnce(world, intent).replayed, false);
  const restored = JSON.parse(JSON.stringify(world));
  assert.equal(purchaseOnce(restored, intent).replayed, true);
  assert.equal(restored.coins, 0);
  assert.equal(restored.potions, 4);
  const before = structuredClone(restored);
  assert.throws(() => purchaseOnce(restored, { ...intent, quantity: 3 }), { status: 409 });
  assert.throws(() => purchaseOnce(restored, { ...intent, requestId: 'purchase-test-002' }));
  assert.deepEqual(restored, before);
});

test('debit and receipt survive controller restart together and a failed save permits a safe retry', () => {
  let profile = { characters: { characters: [{ id: 'pet' }] }, world: initialWorldProgress() };
  let failSave = true;
  let routes;
  function restart() {
    routes = new Map();
    mountFoodieWorld({ post: (path, ...handlers) => routes.set(path, handlers.at(-1)) }, {
      auth: () => {}, getProfile: () => structuredClone(profile),
      saveProfile: (_owner, value) => {
        if (failSave) throw Error('Injected save failure');
        profile = structuredClone(value);
      },
    });
  }
  function call(path, body) {
    let status = 200, data;
    routes.get('/api/world/' + path)({ phone: 'qa-owner', body }, {
      status(code) { status = code; return this; }, json(value) { data = value; return this; },
    });
    return { status, data };
  }
  restart();
  failSave = false;
  let session = call('start', { characterId: 'pet' }).data.session;
  const intent = { action: 'buy', item: 'mana', quantity: 1, requestId: 'purchase-test-003' };
  failSave = true;
  assert.throws(() => call('action', { ...intent, session }), /Injected save failure/);
  assert.equal(profile.world.coins, 40);
  assert.equal(profile.world.purchaseReceipts, undefined);
  failSave = false;
  assert.equal(call('action', { ...intent, session }).status, 200);
  restart();
  session = call('start', { characterId: 'pet' }).data.session;
  assert.equal(call('action', { ...intent, session }).status, 200);
  assert.equal(profile.world.coins, 28);
  assert.equal(profile.world.mana, 4);
});
