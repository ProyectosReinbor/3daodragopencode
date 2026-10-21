import test from 'node:test';
import assert from 'node:assert/strict';
import { mountFoodieWorld } from './foodie-world.js';

function harness() {
  let now = 100000;
  const pet = (id) => ({ id, name: 'QA', level: 1, xp: 0,
    baseStats: { atk: 8, ability: 8, def: 8, spd: 8, hp: 8 }, upgrades: [] });
  const profiles = new Map(['owner', 'other'].map((owner) => [owner, {
    characters: { selectedId: 'pet', characters: [pet('pet'), pet('second')] },
  }]));
  let routes;
  let failSave = false;
  function restart() {
    routes = new Map();
    mountFoodieWorld({ post: (path, ...handlers) => routes.set(path, handlers.at(-1)) }, {
      auth: () => {}, clock: () => now,
      getProfile: (owner) => structuredClone(profiles.get(owner)),
      saveProfile: (owner, profile) => {
        if (failSave) throw new Error('Injected storage failure');
        profiles.set(owner, structuredClone(profile));
      },
    });
  }
  restart();
  function call(path, body, owner = 'owner') {
    let status = 200, data;
    routes.get('/api/world/' + path)({ phone: owner, body }, {
      status(code) { status = code; return this; },
      json(value) { data = value; return this; },
    });
    return { status, data };
  }
  return { call, restart, profiles, advance: (ms) => { now += ms; },
    failSave: (value) => { failSave = value; },
    start: (pet = 'pet', owner = 'owner') => call('start', { characterId: pet }, owner).data.session };
}
const attack = (session, slot = 3) => ({ session, action: 'attack', enemy: 'aldea:0', kind: 'wolf', slot });

test('account combat survives reconnect, pet changes and process restart without duplicate rewards', () => {
  const h = harness();
  let session = h.start();
  assert.equal(h.call('action', attack(session)).data.enemyHealth, 0);
  const rewarded = structuredClone(h.profiles.get('owner').world);
  const oldSession = session;
  session = h.start('second');
  assert.equal(h.call('action', attack(oldSession)).status, 409);
  assert.equal(h.call('action', attack(session)).status, 429);
  assert.equal(h.call('action', attack(session, -1)).status, 400);
  assert.deepEqual(h.profiles.get('owner').world, rewarded);
  h.restart();
  session = h.start();
  assert.equal(h.call('action', attack(session)).status, 429);
  assert.equal(h.call('action', attack(session, -1)).status, 400);
  h.advance(22000);
  assert.equal(h.call('action', attack(session)).status, 200);
  assert.equal(h.profiles.get('owner').world.kills, 2);
  const otherSession = h.start('pet', 'other');
  assert.equal(h.call('action', attack(otherSession), 'other').status, 200);
  assert.equal(h.profiles.get('other').world.kills, 1);
});

test('partial enemy health and basic attack cooldown persist across restarts', () => {
  const h = harness();
  let session = h.start();
  const first = h.call('action', attack(session, -1));
  assert.equal(first.status, 200);
  assert.ok(first.data.enemyHealth > 0);
  h.restart();
  session = h.start();
  assert.equal(h.call('action', attack(session, -1)).status, 429);
  h.advance(450);
  const second = h.call('action', attack(session, -1));
  assert.equal(second.status, 200);
  assert.ok(second.data.enemyHealth < first.data.enemyHealth);
});

test('consumable cooldowns survive reconnection and remain independent', () => {
  const h = harness();
  let session = h.start();
  const use = (item) => h.call('action', { session, action: 'consume', item });
  assert.equal(use('potions').status, 200);
  h.restart();
  session = h.start();
  assert.equal(use('potions').status, 400);
  assert.equal(use('mana').status, 200);
  h.advance(1500);
  assert.equal(use('potions').status, 200);
  assert.equal(h.profiles.get('owner').world.potions, 1);
});

test('failed profile writes do not consume a cooldown or reward an encounter', () => {
  const h = harness();
  const session = h.start();
  const before = structuredClone(h.profiles.get('owner'));
  h.failSave(true);
  assert.throws(() => h.call('action', attack(session)), /Injected storage failure/);
  assert.deepEqual(h.profiles.get('owner'), before);
  h.failSave(false);
  assert.equal(h.call('action', attack(session)).status, 200);
  assert.equal(h.profiles.get('owner').world.kills, 1);
});
