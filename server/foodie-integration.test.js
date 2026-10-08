import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { cleanPetName, dartBonus, dartPrize } from './foodie-onboarding.js';
import { applyPurchaseExperience } from './foodie-growth.js';
import jwt from './node_modules/jsonwebtoken/index.js';

const base = 'http://127.0.0.1:3107';
const testSecret = 'foodie-integration-test-only-secret';
let processHandle;
let directory;
let token;
async function request(path, body, method = body ? 'POST' : 'GET', authToken = token) {
  const response = await fetch(base + '/api' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'foodie-integration-'));
  processHandle = spawn(process.execPath, [resolve('server/index.js')], {
    env: { ...process.env, NODE_ENV: 'test', SEED_DEMO_DATA: 'true', PORT: '3107', JWT_SECRET: testSecret, FOODIE_TEST_DATA_DIR: directory },
    stdio: 'ignore', windowsHide: true,
  });
  for (let i = 0; i < 100; i++) {
    if (processHandle.exitCode !== null) throw new Error('El servidor de pruebas no pudo arrancar.');
    try { if ((await fetch(base + '/api/health')).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Tiempo agotado al iniciar el servidor de pruebas.');
});
after(async () => {
  if (processHandle?.exitCode === null) {
    const closed = new Promise((resolve) => processHandle.once('exit', resolve));
    processHandle.kill(); await closed;
  }
  if (directory) {
    for (const filename of await readdir(directory)) await unlink(join(directory, filename));
    await rmdir(directory);
  }
});

test('names reject markup and dart bonus remains bounded', () => {
  assert.equal(cleanPetName('  Mochi feliz  '), 'Mochi feliz');
  assert.throws(() => cleanPetName('<img src=x>'));
  assert.throws(() => cleanPetName('a'));
  assert.equal(dartBonus(0), 1);
  assert.equal(dartPrize(50).rarity, "especial");
  assert.equal(dartPrize(55).rarity, "legendario");
  assert.equal(dartPrize(60).rarity, "epico");
  assert.equal(dartPrize(75).rarity, "raro");
  assert.ok(dartBonus(550 * Math.PI / 2) >= 1);
});

test('purchase XP can cross multiple levels and only changes the selected pet', () => {
  const first = { id: 'one', name: 'Uno', level: 1, xp: 0 };
  const second = { id: 'two', name: 'Dos', level: 1, xp: 0 };
  const profile = { characters: { characters: [first, second], selectedId: 'one' } };
  const result = applyPurchaseExperience(profile, 200, 'two');
  assert.equal(first.level, 1); assert.equal(first.xp, 0);
  assert.ok(result.after.level > 2);
  assert.throws(() => applyPurchaseExperience(profile, 25, 'not-owned'));
});

test('registration, one-time dice/dart, persistence and protected profile writes', async () => {
  const created = await request('/onboarding', {}, 'POST', null);
  assert.equal(created.status, 200);
  const id = created.data.id;
  assert.equal((await request(`/onboarding/${id}/claim`, {}, 'POST', null)).status, 401);
  assert.equal((await request(`/onboarding/${id}/roll`, { name: 'Mochi' })).status, 400);
  const choices = { name: 'Mochi Feliz', element: 'agua', bodyType: 'golem', color: '#559ddb', attemptId: 'initial-roll', powers: ['fireball', 'heal_wave'] };
  const spin = await request(`/onboarding/${id}/roll`, choices);
  const again = await request(`/onboarding/${id}/roll`, { ...choices, element: 'fuego' });
  assert.deepEqual(again.data.pet, spin.data.pet);
  assert.equal(spin.data.pet.traits.element, 'agua');
  assert.deepEqual(spin.data.pet.powers, choices.powers);
  for (const [key, dice] of Object.entries(spin.data.dice)) {
    assert.ok(dice.every(n => n >= 1 && n <= 6));
    assert.equal(spin.data.pet.baseStats[key], dice[0] + dice[1]);
  }
  await request(`/onboarding/${id}/dart/start`, { name: 'Mochi Feliz', stat: 'hp' });
  const hit = await request(`/onboarding/${id}/dart/throw`, { accessible: true });
  assert.equal(hit.data.dart.bonus, 1);
  assert.equal((await request(`/onboarding/${id}/dart/throw`, {})).data.pet.upgrades.length, 1);
  const registered = await request('/register', { phone: '900000001', password: 'foodie-test-only' }, 'POST', null);
  assert.equal(registered.status, 200); token = registered.data.token;
  const claim = await request(`/onboarding/${id}/claim`, {});
  assert.equal(claim.status, 200);
  const profile = claim.data;
  assert.equal(profile.characters.characters[0].name, 'Mochi Feliz');
  assert.equal((await request(`/onboarding/${id}/claim`, {})).data.characters.characters.length, 1);
  assert.equal((await request('/profile')).data.characters.characters[0].id, spin.data.pet.id);
  const stale = structuredClone(profile); stale.revision = 0;
  assert.equal((await request('/profile', stale, 'PUT')).status, 409);
  const tampered = structuredClone(profile);
  tampered.characters.characters[0].xp = 9999; tampered.currency = 99999;
  tampered.redeemedRewards = ['forged'];
  assert.equal((await request('/profile', tampered, 'PUT')).status, 200);
  const saved = (await request('/profile')).data;
  assert.equal(saved.characters.characters[0].xp, 0);
  assert.equal(saved.currency, 0);
  assert.deepEqual(saved.redeemedRewards, []);
  assert.deepEqual(saved.dailyQuests, profile.dailyQuests);
  const other = await request('/register', { phone: '900000002', password: 'foodie-test-only' }, 'POST', null);
  assert.equal((await request(`/onboarding/${id}/claim`, {}, 'POST', other.data.token)).status, 400);
  const wrongPet = await request('/redeem', { code: 'RA-2026-000001', characterId: 'not-owned' });
  assert.equal(wrongPet.status, 400);
  assert.equal((await request('/redeem', { code: 'RA-EXP-000001' })).status, 400);
  const concurrent = await Promise.all([
    request('/redeem', { code: 'RA-2026-000001', characterId: spin.data.pet.id }),
    request('/redeem', { code: 'RA-2026-000001', characterId: spin.data.pet.id }),
  ]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 400]);
  assert.equal(concurrent.find((response) => response.status === 200).data.growth.amount, 25);
  const next = await request('/redeem', { code: 'RA-2026-000002', characterId: spin.data.pet.id });
  assert.equal(next.status, 200); assert.equal(next.data.growth.after.level, 2);
  const rewarded = (await request('/profile')).data;
  assert.equal(rewarded.characters.characters[0].xp, 23);
  assert.equal((await request('/profile', saved, 'PUT')).status, 409);
  assert.equal((await request('/rewards/history')).data.history.length, 2);
  const adminToken = jwt.sign({ role: 'admin' }, testSecret, { expiresIn: '1m' });
  const invoice = await request('/admin/stores/hamburguesas-reino/invoice-codes', { product_id: 'prod-burger-combo', purchase_reference: 'TEST-RECEIPT-001' }, 'POST', adminToken);
  assert.equal(invoice.status, 200); assert.equal(invoice.data.status, 'AVAILABLE');
  const repeatedInvoice = await request('/admin/stores/hamburguesas-reino/invoice-codes', { product_id: 'prod-burger-combo', purchase_reference: 'TEST-RECEIPT-001' }, 'POST', adminToken);
  assert.equal(repeatedInvoice.data.code, invoice.data.code);
  assert.equal((await request('/profile')).data.characters.characters[0].xp, 23);
  const redeemedInvoice = await request('/redeem', { code: invoice.data.qrPayload, characterId: spin.data.pet.id });
  assert.equal(redeemedInvoice.status, 200);
  assert.equal(redeemedInvoice.data.growth.after.xp, 48);
});


test('moving dart awards the displayed position once and rejects invented timestamps', async () => {
  const created = await request('/onboarding', {});
  const id = created.data.id;
  await request(`/onboarding/${id}/roll`, { name: 'Pet Dardo', element: 'luz', bodyType: 'humanoid', color: '#abcdef', powers: ['divine_smite', 'holy_barrier'] });
  const start = await request(`/onboarding/${id}/dart/start`, { stat: 'def' });
  assert.equal((await request(`/onboarding/${id}/dart/throw`, { elapsed: -100 })).status, 400);
  assert.equal((await request(`/onboarding/${id}/dart/throw`, { elapsed: 999999 })).status, 400);
  const elapsed = Math.max(0, Date.now() - start.data.dart.startedAt);
  const hit = await request(`/onboarding/${id}/dart/throw`, { elapsed });
  assert.equal(hit.status, 200);
  assert.deepEqual({ bonus: hit.data.dart.bonus, rarity: hit.data.pet.traits.rarity }, dartPrize(hit.data.dart.position));
  const repeated = await request(`/onboarding/${id}/dart/throw`, { elapsed: 600 });
  assert.deepEqual(repeated.data.pet, hit.data.pet);
  assert.equal(hit.data.pet.upgrades.length, 1);
});


test('editing and rerolling preserve identity and replace the welcome gift', async () => {
  const created = await request('/onboarding', {});
  const id = created.data.id;
  const choices = { name: 'Pet Editable', element: 'aire', bodyType: 'bestia', headShape: 'cube', limbCount: 6, limbLength: 1.4, color: '#ff8800', powers: ['dash', 'wind_blade'] };
  const configured = await request(`/onboarding/${id}/customize`, choices);
  assert.equal(configured.status, 200);
  assert.equal(configured.data.pet.traits.limbCount, 6);
  assert.equal((await request(`/onboarding/${id}/dart/start`, { stat: 'atk' })).status, 400);
  const rolled = await request(`/onboarding/${id}/roll`, { attemptId: 'roll-one' });
  assert.equal(rolled.data.pet.id, configured.data.pet.id);
  await request(`/onboarding/${id}/dart/start`, { stat: 'atk' });
  await request(`/onboarding/${id}/dart/throw`, { accessible: true });
  const back = await request(`/onboarding/${id}/back`, { stage: 'customize' });
  assert.equal(back.data.dart, undefined);
  assert.equal(back.data.pet.upgrades.length, 0);
  assert.deepEqual(back.data.dice, rolled.data.dice);
  const changed = await request(`/onboarding/${id}/customize`, { ...choices, element: 'tierra', headShape: 'diamond', limbCount: 8, limbLength: 1.8 });
  assert.equal(changed.data.pet.id, configured.data.pet.id);
  assert.equal(changed.data.pet.traits.element, 'tierra');
  assert.equal(changed.data.pet.traits.limbCount, 8);
  assert.deepEqual(changed.data.dice, rolled.data.dice);
  const rerolled = await request(`/onboarding/${id}/roll`, { attemptId: 'roll-two' });
  assert.equal(rerolled.data.lastRollId, 'roll-two');
  const retried = await request(`/onboarding/${id}/roll`, { attemptId: 'roll-two' });
  assert.deepEqual(retried.data.dice, rerolled.data.dice);
  for (const [key, dice] of Object.entries(rerolled.data.dice)) assert.equal(rerolled.data.pet.baseStats[key], dice[0]+dice[1]);
  assert.equal((await request(`/onboarding/${id}/customize`, { ...choices, limbCount: 999 })).status, 400);
  await request(`/onboarding/${id}/dart/start`, { stat: 'def' });
  const gift = await request(`/onboarding/${id}/dart/throw`, { accessible: true });
  assert.equal(gift.data.pet.upgrades.length, 1);
  assert.equal(gift.data.pet.upgrades[0].stat, 'def');
});


test('advanced appearance persists through editing, dice, welcome gift and account creation', async () => {
  const id = (await request('/onboarding', {})).data.id;
  const appearance = { species:'alien',mood:'odd',coat:'dirty',limbKind:'hands',wings:'insect',headSize:1.4,eyeLeft:{x:0.2,y:0.1,z:0.05},eyeRight:{x:-0.1,y:0,z:0},sculpt:[{part:'head',x:0,y:1,z:0,radius:0.3,strength:0.2}] };
  const choices = {name:'Alien Foodie',element:'sombra',bodyType:'humanoid',headShape:'round',limbCount:6,limbLength:1,color:'#98b7cc',secondaryColor:'#e4e1f2',accentColor:'#c4a5dc',powers:['shadow_step','heal_wave'],appearance};
  const configured = await request(`/onboarding/${id}/customize`, choices);
  assert.equal(configured.status,200);
  assert.deepEqual(configured.data.pet.traits.appearance.eyeLeft,appearance.eyeLeft);
  assert.deepEqual(configured.data.pet.traits.appearance.sculpt,appearance.sculpt);
  assert.equal(configured.data.pet.traits.accentColor,0xc4a5dc);
  assert.equal((await request(`/onboarding/${id}/customize`, {...choices,appearance:{eyeSize:999}})).status,400);
  assert.equal((await request(`/onboarding/${id}/customize`, {...choices,appearance:{sculpt:[{part:'head',x:100,y:0,z:0,radius:0.3,strength:0.1}]}})).status,400);
  assert.equal((await request(`/onboarding/${id}`)).data.pet.traits.appearance.species,'alien');
  await request(`/onboarding/${id}/roll`,{attemptId:'advanced-roll'});
  await request(`/onboarding/${id}/dart/start`,{stat:'ability'});
  await request(`/onboarding/${id}/dart/throw`,{accessible:true});
  const user=await request('/register',{phone:'900000003',password:'foodie-test-only'},'POST',null);
  const claimed=await request(`/onboarding/${id}/claim`,{},'POST',user.data.token);
  assert.equal(claimed.status,200);
  const stored=(await request('/profile',undefined,'GET',user.data.token)).data.characters.characters[0];
  assert.equal(stored.traits.appearance.species,'alien');
  assert.deepEqual(stored.traits.appearance.sculpt,appearance.sculpt);
  assert.deepEqual(stored.traits.appearance.eyeLeft,appearance.eyeLeft);
  assert.equal((await request(`/onboarding/${id}/customize`,choices)).status,400);
});


test('world rewards are server-owned, persisted, and cannot be replayed or forged', async () => {
  const before = (await request('/profile')).data;
  const pet = before.characters.characters[0];
  assert.equal((await request('/world/start', {characterId:'not-owned'})).status,400);
  const start = await request('/world/start',{characterId:pet.id});
  assert.equal(start.status,200);
  const session = start.data.session;
  assert.equal(start.data.profile.world.coins,40);
  const buy = await request('/world/action',{session,action:'buy',item:'potions'});
  assert.equal(buy.data.profile.world.coins,25);
  assert.equal(buy.data.profile.world.potions,4);
  assert.equal((await request('/world/action',{session,action:'equip',item:'blade'})).status,400);
  assert.equal((await request('/world/action',{session,action:'attack',slot:99,kind:'wolf',enemy:'aldea:0'})).status,400);
  let hit = await request('/world/action',{session,action:'attack',slot:3,kind:'wolf',enemy:'aldea:0'});
  assert.equal(hit.status,200);
  // Welcome dice vary; the ultimate is not guaranteed to kill in one hit.
  for (let attack = 0; hit.data.enemyHealth > 0 && attack < 3; attack++) {
    if (attack) await new Promise(resolve => setTimeout(resolve, 475));
    hit = await request('/world/action',{session,action:'attack',slot:-1,kind:'wolf',enemy:'aldea:0'});
    assert.equal(hit.status,200);
  }
  assert.equal(hit.data.enemyHealth,0);
  assert.equal(hit.data.reward.coins,12);
  assert.equal(hit.data.reward.xp,15);
  assert.equal(hit.data.profile.world.kills,1);
  assert.equal((await request('/world/action',{session,action:'attack',slot:3,kind:'wolf',enemy:'aldea:0'})).status,429);
  assert.equal((await request('/world/action',{session,action:'attack',slot:-1,kind:'wolf',enemy:'aldea:0'})).status,400);
  const forged = structuredClone(hit.data.profile); forged.world.coins=999999;
  assert.equal((await request('/profile',forged,'PUT')).status,200);
  const saved=(await request('/profile')).data;
  assert.equal(saved.world.coins,37);
  assert.equal(saved.world.kills,1);
  assert.equal(saved.characters.characters[0].level,hit.data.profile.characters.characters[0].level);
  const consume=await request('/world/action',{session,action:'consume',item:'potions'});
  assert.equal(consume.data.profile.world.potions,hit.data.profile.world.potions-1);
  assert.equal((await request('/world/action',{session,action:'consume',item:'potions'})).status,400);
  const other=await request('/world/start',{characterId:pet.id});
  assert.equal(other.status,200);
  assert.equal((await request('/world/action',{session,action:'buy',item:'mana'})).status,409);
});
