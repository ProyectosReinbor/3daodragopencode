import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from './node_modules/express/index.js';
import { createDatabase } from './database.js';
import { APPEARANCE_ENUMS, APPEARANCE_NUMBERS, DEFAULT_APPEARANCE, normalizeAppearance } from '../shared/pet-appearance.js';
import { CARE_COOLDOWN_MS, INCUBATION_MS, MAX_INCUBATION_MS, MAX_COLLECTION, createGuardianState, reconcileGuardian, decayCare, guardianDTO, applyGuardianAction, cleanGuardianName, normalizeGuardianRequest, guardianRequestFingerprint, resolveIncubationMs } from './guardian-domain.js';
import { mountFoodieGuardian } from './foodie-guardian.js';

const start = 1_800_000_000_000;
function profile(id = 'FP-founder') {
  return { version: 2, revision: 1, characters: { characters: [{ id, name: 'Mochi', level: 1, xp: 0,
    baseStats: { atk: 7, def: 6, spd: 8, hp: 9, ability: 5 }, upgrades: [], source: 'starter', isStarter: true,
    traits: { element: 'agua', appearance: { ...structuredClone(DEFAULT_APPEARANCE), coat: 'striped' } } }], selectedId: id }, selectedCharacter: id };
}
const act = (state, player, action, now, other = {}) => applyGuardianAction(state, player, { action, requestId: 'domain', ...other }, now);
function fullyWarm(state, player, egg) {
  for (let index = 0; index < 3; index++) act(state, player, 'warm_egg', start + index * CARE_COOLDOWN_MS, { eggId: egg.id });
}

test('founders preserve the editor pet and expose only a public gen-0 genome summary', () => {
  const player = profile(), original = structuredClone(player);
  const state = createGuardianState(player, start);
  const dto = guardianDTO(state, player, start);
  assert.deepEqual(player, original);
  assert.equal(dto.genetics['FP-founder'].generation, 0);
  assert.deepEqual(dto.genetics['FP-founder'].parents, []);
  assert.equal(state.genomes['FP-founder'].alleles.coat[0].value, 'striped');
  assert.ok(state.genomes['FP-founder'].alleles.coat[1]);
  assert.ok(dto.genetics['FP-founder'].knownGenes.includes('coat:striped'));
  assert.ok(dto.genetics['FP-founder'].hiddenGenes > 0);
  assert.ok(!JSON.stringify(dto).includes('alleles'));
  assert.ok(!JSON.stringify(dto).includes('dominance'));
  assert.ok(!JSON.stringify(dto).includes('recessive'));
  assert.ok(!JSON.stringify(dto).includes('_decayAt'));
});

test('care decay uses server time, caps absence, preserves its clock across visits and never kills', () => {
  const state = createGuardianState(profile(), start);
  const care = state.care['FP-founder'];
  decayCare(care, start - 1000);
  assert.equal(care.satiety, 75);
  for (let visit = 1; visit <= 15; visit++) decayCare(care, start + visit * 60_000);
  assert.equal(care.satiety, 74);
  const oneDay = structuredClone(care), longAbsence = structuredClone(care);
  decayCare(oneDay, start + 15 * 60_000 + 86400000);
  decayCare(longAbsence, start + 15 * 60_000 + 86400000 * 30);
  for (const key of ['satiety', 'energy', 'mood', 'hygiene', 'affection', 'health', 'curiosity']) assert.equal(oneDay[key], longAbsence[key]);
  for (let day = 0; day < 50; day++) decayCare(longAbsence, start + 86400000 * (31 + day));
  assert.equal(longAbsence.health, 20);
  for (const key of ['satiety', 'energy', 'mood', 'hygiene', 'affection', 'health', 'curiosity']) {
    assert.ok(Number.isInteger(longAbsence[key])); assert.ok(longAbsence[key] >= 0 && longAbsence[key] <= 100);
  }
});

test('care actions retain decay ticks and provide a free recovery and food loop', () => {
  const player = profile(), state = createGuardianState(player, start);
  state.food = 0; state.care['FP-founder'].energy = 0; state.care['FP-founder'].satiety = 0;
  assert.throws(() => act(state, player, 'feed', start), /comida gratis/);
  assert.throws(() => act(state, player, 'play', start), /Descansa/);
  act(state, player, 'rest', start);
  assert.throws(() => act(state, player, 'play', start + 1), error => error.status === 429);
  act(state, player, 'play', start + CARE_COOLDOWN_MS);
  assert.equal(state.food, 2);
  act(state, player, 'feed', start + CARE_COOLDOWN_MS * 2);
  assert.equal(state.food, 1); assert.equal(state.care['FP-founder'].satiety, 25);
  assert.equal(state.progress.firstcare, 1);
  for (let index = 3; index < 305; index++) act(state, player, 'pet', start + index * CARE_COOLDOWN_MS);
  assert.equal(state.care['FP-founder'].satiety, 24);
});

test('three warmth actions unlock early birth with stronger stats and a cooldown', () => {
  const player = profile(), original = structuredClone(player.characters), state = createGuardianState(player, start);
  act(state, player, 'choose_egg', start, { theme: 'fire' });
  const egg = state.eggs[0];
  act(state, player, 'choose_egg', start, { theme: 'water' });
  assert.equal(state.eggs.length, 1); assert.equal(egg.theme, 'fire');
  act(state, player, 'warm_egg', start, { eggId: egg.id });
  assert.throws(() => act(state, player, 'warm_egg', start + 1, { eggId: egg.id }), error => error.status === 429);
  act(state, player, 'warm_egg', start + CARE_COOLDOWN_MS, { eggId: egg.id });
  act(state, player, 'warm_egg', start + CARE_COOLDOWN_MS * 2, { eggId: egg.id });
  assert.equal(guardianDTO(state, player, start + CARE_COOLDOWN_MS * 2).eggs[0].status, 'ready');
  assert.equal(guardianDTO(state, player, start + INCUBATION_MS).eggs[0].status, 'ready');
  act(state, player, 'hatch', start + CARE_COOLDOWN_MS * 2, { eggId: egg.id });
  const born = player.characters.characters[1];
  assert.match(born.id, /^FP-[0-9a-f-]{36}$/);
  assert.equal(born.level, 1); assert.equal(born.xp, 0);
  assert.equal(born.traits.appearance.species, egg.appearance.species);
  assert.deepEqual(born.traits, egg.traits);
  assert.deepEqual(normalizeAppearance(born.traits.appearance), born.traits.appearance);
  for (const value of Object.values(born.baseStats)) assert.ok(Number.isInteger(value) && value >= 5 && value <= 15);
  assert.deepEqual(player.characters.characters[0], original.characters[0]);
  assert.equal(player.characters.selectedId, original.selectedId);
  assert.equal(player.selectedCharacter, 'FP-founder');
  act(state, player, 'hatch', start + INCUBATION_MS, { eggId: egg.id });
  assert.equal(player.characters.characters.length, 2);
  assert.equal(state.progress.hatching, 1);
  assert.equal(guardianDTO(state, player, start + INCUBATION_MS).eggs[0].petId, born.id);
});

test('all themed hatch phenotypes conform to the shared editor schema and stay bounded', () => {
  for (const theme of ['forest', 'fire', 'water', 'mystery']) {
    for (let trial = 0; trial < 12; trial++) {
      const player = profile(), state = createGuardianState(player, start);
      act(state, player, 'choose_egg', start, { theme }); fullyWarm(state, player, state.eggs[0]);
      act(state, player, 'hatch', start + INCUBATION_MS, { eggId: state.eggs[0].id });
      const born = player.characters.characters[1];
      assert.deepEqual(normalizeAppearance(born.traits.appearance), born.traits.appearance);
      for (const value of Object.values(born.baseStats)) assert.ok(Number.isInteger(value) && value >= 5 && value <= 15);
    }
  }
});

test('ownership, collection cap and mission rewards are validated on the server', () => {
  const player = profile(), state = createGuardianState(player, start);
  assert.throws(() => act(state, player, 'pet', start, { petId: 'FP-stranger' }), error => error.status === 403);
  assert.throws(() => act(state, player, 'warm_egg', start, { eggId: 'EGG-stranger' }), error => error.status === 403);
  assert.throws(() => act(state, player, 'claim_mission', start, { missionId: 'firstcare' }), error => error.status === 409);
  act(state, player, 'pet', start);
  act(state, player, 'claim_mission', start, { missionId: 'firstcare' });
  assert.equal(player.world.coins, 50); assert.equal(player.characters.characters[0].xp, 10); assert.equal(state.food, 13);
  assert.throws(() => act(state, player, 'claim_mission', start, { missionId: 'firstcare', petId: 'FP-stranger' }), error => error.status === 403);
  act(state, player, 'claim_mission', start, { missionId: 'firstcare' });
  assert.equal(player.world.coins, 50); assert.equal(player.characters.characters[0].xp, 10); assert.equal(state.food, 13);
  player.characters.characters[0].level = 10; reconcileGuardian(state, player, start);
  assert.equal(guardianDTO(state, player, start).care['FP-founder'].stage, 'adult');
  for (let index = 1; index < MAX_COLLECTION; index++) player.characters.characters.push({ ...player.characters.characters[0], id: `FP-founder-${index}` });
  assert.throws(() => act(state, player, 'choose_egg', start, { theme: 'forest' }), /llena/);
});

test('an empty account begins with an egg and selects only its first hatched Pet', () => {
  const player = { revision: 1, nft: null, game: null }, state = createGuardianState(player, start);
  const empty = guardianDTO(state, player, start);
  assert.deepEqual(empty.care, {}); assert.deepEqual(empty.genetics, {}); assert.deepEqual(empty.eggs, []);
  assert.throws(() => act(state, player, 'pet', start), error => error.status === 403);
  assert.throws(() => act(state, player, 'rename_pet', start, { name: 'Pip' }), error => error.status === 403);
  act(state, player, 'choose_egg', start, { theme: 'forest' });
  fullyWarm(state, player, state.eggs[0]);
  assert.throws(() => act(state, player, 'claim_mission', start, { missionId: 'incubation' }), error => error.status === 403);
  act(state, player, 'hatch', start + INCUBATION_MS, { eggId: state.eggs[0].id });
  const first = player.characters.characters[0];
  assert.equal(player.characters.characters.length, 1);
  assert.equal(player.characters.selectedId, first.id); assert.equal(player.selectedCharacter, first.id);
  assert.equal(first.isStarter, true); assert.equal(first.level, 1); assert.equal(first.xp, 0);
  assert.equal(player.attributePoints, 0); assert.equal(player.inventory.trigo, 0); assert.equal(player.crafted.racion, 0);
  act(state, player, 'hatch', start + INCUBATION_MS, { eggId: state.eggs[0].id });
  assert.equal(player.characters.characters.length, 1);
  act(state, player, 'rename_pet', start + INCUBATION_MS, { name: ' Pip ' });
  assert.equal(first.name, 'Pip'); assert.equal(state.progress.firstcare, 0);
  act(state, player, 'claim_mission', start + INCUBATION_MS, { missionId: 'incubation' });
  assert.equal(player.world.coins, 55); assert.equal(first.xp, 15);
});

test('incubation configuration validates integer bounds and never moves an existing readyAt', () => {
  assert.equal(resolveIncubationMs(''), INCUBATION_MS);
  assert.equal(INCUBATION_MS, 90000);
  assert.equal(resolveIncubationMs('90000'), INCUBATION_MS);
  assert.equal(resolveIncubationMs(' 259200000 '), 3 * 86400000);
  assert.equal(resolveIncubationMs(MAX_INCUBATION_MS), MAX_INCUBATION_MS);
  for (const value of ['invalid', '3e5', '90000.5', '-1', ' ', null, true, NaN, Infinity, 30000, 89999, MAX_INCUBATION_MS + 1]) {
    assert.throws(() => resolveIncubationMs(value), /AODASE_INCUBATION_MS/);
  }
  const player = {}, state = createGuardianState(player, start), duration = 3 * 86400000;
  applyGuardianAction(state, player, { action: 'choose_egg', theme: 'water' }, start, {}, duration);
  const egg = state.eggs[0]; assert.equal(egg.readyAt, start + duration);
  applyGuardianAction(state, player, { action: 'choose_egg', theme: 'fire' }, start + 2000, {}, INCUBATION_MS);
  assert.equal(egg.readyAt, start + duration); assert.equal(egg.theme, 'water');
  fullyWarm(state, player, egg);
  assert.equal(guardianDTO(state, player, start + CARE_COOLDOWN_MS * 2).eggs[0].status, 'ready');
  act(state, player, 'hatch', start + duration, { eggId: egg.id });
  assert.equal(player.characters.characters.length, 1);
});

test('ninety seconds is sufficient to hatch without any warmth actions', () => {
  const player = {}, state = createGuardianState(player, start);
  act(state, player, 'choose_egg', start, { theme: 'forest' });
  const egg = state.eggs[0]; assert.equal(egg.care, 0);
  assert.equal(guardianDTO(state, player, start + INCUBATION_MS - 1).eggs[0].status, 'incubating');
  assert.throws(() => act(state, player, 'hatch', start + INCUBATION_MS - 1, { eggId: egg.id }), error => error.status === 409);
  assert.equal(guardianDTO(state, player, start + INCUBATION_MS).eggs[0].status, 'ready');
  act(state, player, 'hatch', start + INCUBATION_MS, { eggId: egg.id });
  assert.equal(player.characters.characters.length, 1);
  assert.equal(state.progress.incubation, 0); assert.equal(state.progress.hatching, 1);
  assert.throws(() => act(state, player, 'claim_mission', start + INCUBATION_MS, { missionId: 'incubation' }), error => error.status === 409);
});

test('each warmth action raises every birth stat exactly once, without changing the stored dice', () => {
  for (let warmth = 0; warmth <= 3; warmth++) {
    const player = {}, state = createGuardianState(player, start);
    act(state, player, 'choose_egg', start, { theme: 'forest' });
    const egg = state.eggs[0], dice = structuredClone(egg.stats);
    for (let i = 0; i < warmth; i++) act(state, player, 'warm_egg', start + i * CARE_COOLDOWN_MS, { eggId: egg.id });
    const birthAt = warmth === 3 ? start + 2 * CARE_COOLDOWN_MS : start + INCUBATION_MS;
    act(state, player, 'hatch', birthAt, { eggId: egg.id });
    const baby = player.characters.characters[0];
    for (const key of Object.keys(dice)) assert.equal(baby.baseStats[key], dice[key] + warmth);
    assert.deepEqual(egg.stats, dice);
    assert.equal(state.care[baby.id].stage, 'baby');
    act(state, player, 'hatch', birthAt, { eggId: egg.id });
    assert.equal(player.characters.characters.length, 1);
    for (const key of Object.keys(dice)) assert.equal(baby.baseStats[key], dice[key] + warmth);
  }
});

test('new expressed alleles exactly describe stored phenotype, numeric features and colors', () => {
  for (let trial = 0; trial < 32; trial++) {
    const player = profile(), state = createGuardianState(player, start);
    act(state, player, 'choose_egg', start, { theme: ['forest', 'fire', 'water', 'mystery'][trial % 4] });
    const egg = state.eggs[0];
    act(state, player, 'hatch', start + INCUBATION_MS, { eggId: egg.id });
    const pet = player.characters.characters[1], alleles = state.genomes[pet.id].alleles;
    for (const key of [...Object.keys(APPEARANCE_ENUMS), ...Object.keys(APPEARANCE_NUMBERS)]) {
      assert.equal(alleles[key][0].value, pet.traits.appearance[key]);
      assert.equal(alleles[key][0].dominance, 'dominant'); assert.equal(alleles[key][1].dominance, 'recessive');
    }
    for (const key of ['primaryColor', 'secondaryColor', 'accentColor', 'bodyType', 'headShape', 'limbCount', 'limbLength', 'eyeStyle', 'hornStyle', 'wingStyle', 'pattern']) {
      assert.equal(alleles[key][0].value, pet.traits[key]);
    }
    assert.equal(alleles.affinity[0].value, pet.traits.element);
    const dto = guardianDTO(state, player, start + INCUBATION_MS);
    assert.equal(dto.genetics[pet.id].hiddenGenes, Object.keys(alleles).length);
    assert.ok(!JSON.stringify(dto).includes('alleles')); assert.ok(!JSON.stringify(dto).includes('recessive'));
  }
});

test('legacy pets, genomes and thirty-second eggs remain unchanged after the new minimum', () => {
  const player = profile(), state = createGuardianState(player, start), originalPet = structuredClone(player.characters.characters[0]);
  const oldAppearance = { ...structuredClone(DEFAULT_APPEARANCE), species: 'dragon', coat: 'scales', wings: 'bat' };
  delete oldAppearance.markings; delete oldAppearance.eyeColor;
  const oldGenome = { alleles: { species: [{ value: 'dragon', dominance: 'dominant' }, { value: 'cat', dominance: 'recessive' }] },
    public: { genomeId: 'GEN-old', fingerprint: 'old-fingerprint', generation: 0, parents: [], origin: 'egg:fire', species: 'dragon', affinity: 'fuego', knownGenes: ['wings:bat'], hiddenGenes: 1 } };
  state.genomes['FP-founder'] = structuredClone(oldGenome);
  state.eggs.push({ id: 'EGG-old', theme: 'fire', label: 'Huevo de fuego', care: 0, requiredCare: 3, readyAt: start + 30000,
    createdAt: start, genome: structuredClone(oldGenome), appearance: oldAppearance, stats: { atk: 7, def: 7, spd: 7, hp: 7, ability: 7 } });
  reconcileGuardian(state, player, start + 30000);
  assert.deepEqual(state.genomes['FP-founder'], oldGenome);
  assert.equal(state.eggs[0].readyAt, start + 30000);
  act(state, player, 'hatch', start + 30000, { eggId: 'EGG-old' });
  const born = player.characters.characters[1];
  assert.deepEqual(player.characters.characters[0], originalPet);
  assert.deepEqual(born.traits.appearance, oldAppearance); assert.equal(born.traits.primaryColor, 0xe78958);
  assert.deepEqual(state.genomes[born.id], oldGenome);
});

test('rename validates Unicode plain text, ownership and normalized request fingerprints', () => {
  assert.equal(cleanGuardianName(' A '), 'A');
  assert.equal(cleanGuardianName('Cafe\u0301'), 'Café');
  assert.equal(cleanGuardianName('Pip 🐱!'), 'Pip 🐱!');
  assert.equal(cleanGuardianName('A'.repeat(24)), 'A'.repeat(24));
  for (const value of [undefined, 3, '', '   ', 'A'.repeat(25), '<b>Pip</b>', 'P\ni', 'P\0i', 'P\u202ei']) {
    assert.throws(() => cleanGuardianName(value));
  }
  const request = normalizeGuardianRequest({ action: 'rename_pet', petId: 'FP-founder', name: ' Pip ', requestId: 'rename-1' });
  const sameName = normalizeGuardianRequest({ ...request, name: 'Pip' });
  const anotherName = normalizeGuardianRequest({ ...request, name: 'Pop' });
  assert.equal(request.name, 'Pip');
  assert.equal(guardianRequestFingerprint(request), guardianRequestFingerprint(sameName));
  assert.notEqual(guardianRequestFingerprint(request), guardianRequestFingerprint(anotherName));
  const player = profile(), state = createGuardianState(player, start), before = structuredClone(player.characters.characters[0]);
  assert.throws(() => act(state, player, 'rename_pet', start, { petId: 'FP-other', name: 'Pip' }), error => error.status === 403);
  act(state, player, 'rename_pet', start, { name: 'Pip' });
  assert.deepEqual(player.characters.characters[0], { ...before, name: 'Pip' });
  assert.equal(state.progress.firstcare, 0);
});

async function fixture({ incubationMs = INCUBATION_MS } = {}) {
  const db = await createDatabase(':memory:'); db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE users (phone TEXT PRIMARY KEY); CREATE TABLE profiles (phone TEXT PRIMARY KEY, data TEXT NOT NULL);');
  for (const phone of ['owner', 'other', 'legacy', 'empty', 'no-profile']) {
    db.prepare('INSERT INTO users (phone) VALUES (?)').run(phone);
    if (phone === 'no-profile') continue;
    const player = phone === 'empty' ? { revision: 1, nft: null, game: null } : profile(`FP-${phone}`);
    if (phone === 'legacy') { player.nft = player.characters.characters[0]; delete player.characters; }
    db.prepare('INSERT INTO profiles (phone, data) VALUES (?, ?)').run(phone, JSON.stringify(player));
  }
  let timestamp = start, shouldFailSave = false;
  const getProfile = phone => { const row = db.prepare('SELECT data FROM profiles WHERE phone = ?').get(phone); return row ? JSON.parse(row.data) : null; };
  const saveProfile = (phone, player) => {
    if (shouldFailSave) throw new Error('injected profile failure');
    player.revision = (getProfile(phone)?.revision || 0) + 1;
    db.prepare('INSERT INTO profiles (phone, data) VALUES (?, ?) ON CONFLICT(phone) DO UPDATE SET data = excluded.data').run(phone, JSON.stringify(player));
  };
  let server, base;
  async function startServer(duration) {
    const app = express(); app.use(express.json());
    mountFoodieGuardian(app, { db, getProfile, saveProfile, incubationMs: duration, now: () => timestamp, auth: (req, res, next) => {
      req.phone = req.get('x-test-user');
      if (!db.prepare('SELECT phone FROM users WHERE phone = ?').get(req.phone)) return res.status(401).json({ error: 'auth' }); next();
    } });
    server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    base = `http://127.0.0.1:${server.address().port}/api/guardian`;
  }
  await startServer(incubationMs);
  return { db, getProfile, now: value => { timestamp = value; }, failSave: value => { shouldFailSave = value; },
    remount: async duration => { await new Promise(resolve => server.close(resolve)); await startServer(duration); },
    request: async (body, phone = 'owner') => {
      const response = await fetch(base + (body ? '/action' : ''), { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-test-user': phone }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    }, close: async () => { await new Promise(resolve => server.close(resolve)); db.close(); } };
}

test('persistent API owns requests, repeats hatch safely, restores saved genomes and prevents double rewards under concurrency', async () => {
  const api = await fixture();
  try {
    assert.equal((await api.request(null, 'unknown')).status, 401);
    const home = await api.request(); assert.equal(home.status, 200);
    const founderGenome = home.data.guardian.genetics['FP-owner'];
    assert.deepEqual((await api.request()).data.guardian.genetics['FP-owner'], founderGenome);
    assert.equal((await api.request({ action: 'pet' })).status, 400);
    assert.equal((await api.request({ action: 'pet', requestId: 'wrong-owner', petId: 'FP-other' })).status, 403);
    const careRequest = { action: 'play', requestId: 'play-1', petId: 'FP-owner', food: 10000, serverNow: start + 1000000 };
    const firstPlay = await api.request(careRequest);
    assert.equal(firstPlay.data.guardian.food, 10);
    const replay = await api.request(careRequest);
    assert.equal(replay.status, 200); assert.equal(replay.data.guardian.food, 10);
    const otherScope = await api.request({ ...careRequest, petId: 'FP-other' }, 'other');
    assert.equal(otherScope.status, 200); assert.equal(otherScope.data.guardian.food, 10);
    assert.equal((await api.request({ ...careRequest, action: 'feed' })).status, 409);
    const claims = await Promise.all(Array.from({ length: 8 }, (_, index) => api.request({ action: 'claim_mission', missionId: 'firstcare', requestId: `claim-${index}` })));
    assert.ok(claims.every(claim => claim.status === 200));
    assert.equal(api.getProfile('owner').world.coins, 50);
    assert.equal(api.getProfile('owner').characters.characters[0].xp, 10);
    assert.equal((await api.request()).data.guardian.food, 15);
    const chosen = await api.request({ action: 'choose_egg', theme: 'water', requestId: 'egg-choose' });
    const eggId = chosen.data.guardian.eggs[0].id;
    const repeatedEgg = await api.request({ action: 'choose_egg', theme: 'fire', requestId: 'egg-choose-again' });
    assert.equal(repeatedEgg.data.guardian.eggs.length, 1); assert.equal(repeatedEgg.data.guardian.eggs[0].id, eggId);
    assert.equal((await api.request({ action: 'warm_egg', eggId, requestId: 'stolen-egg' }, 'other')).status, 403);
    for (let index = 0; index < 3; index++) {
      api.now(start + index * CARE_COOLDOWN_MS);
      assert.equal((await api.request({ action: 'warm_egg', eggId, requestId: `warm-${index}` })).status, 200);
    }
    api.now(start + INCUBATION_MS);
    const hatchRequest = { action: 'hatch', eggId, requestId: 'hatch-one', level: 100, baseStats: { atk: 999 } };
    const hatchResults = await Promise.all([api.request(hatchRequest), api.request(hatchRequest), api.request({ ...hatchRequest, requestId: 'hatch-two' })]);
    assert.ok(hatchResults.every(result => result.status === 200));
    assert.equal(api.getProfile('owner').characters.characters.length, 2);
    assert.equal(api.getProfile('owner').characters.characters[1].level, 1);
    assert.equal(api.getProfile('owner').characters.selectedId, 'FP-owner');
    const saved = JSON.parse(api.db.prepare('SELECT data FROM foodie_guardians WHERE phone = ?').get('owner').data);
    assert.ok(saved.genomes[saved.eggs[0].petId].alleles);
    assert.ok(!JSON.stringify(hatchResults[0].data).includes('alleles'));
    const missionClaims = await Promise.all(['incubation', 'hatching'].flatMap(missionId => [0, 1].map(index => api.request({ action: 'claim_mission', missionId, requestId: `${missionId}-${index}` }))));
    assert.ok(missionClaims.every(result => result.status === 200));
    assert.equal(api.getProfile('owner').world.coins, 90);
    assert.ok((await api.request()).data.guardian.missions.every(mission => mission.claimed));
  } finally { await api.close(); }
});

test('failed profile save rolls back hatch, genome publication and the idempotency receipt together', async () => {
  const api = await fixture();
  try {
    const chosen = await api.request({ action: 'choose_egg', theme: 'fire', requestId: 'choose' });
    const eggId = chosen.data.guardian.eggs[0].id;
    for (let index = 0; index < 3; index++) { api.now(start + index * CARE_COOLDOWN_MS); await api.request({ action: 'warm_egg', eggId, requestId: `warm-${index}` }); }
    api.now(start + INCUBATION_MS); api.failSave(true);
    assert.equal((await api.request({ action: 'hatch', eggId, requestId: 'retry-hatch' })).status, 500);
    assert.equal(api.getProfile('owner').characters.characters.length, 1);
    assert.equal((await api.request()).data.guardian.eggs[0].status, 'ready');
    assert.equal(api.db.prepare('SELECT COUNT(*) AS count FROM foodie_guardian_requests WHERE request_id = ?').get('retry-hatch').count, 0);
    api.failSave(false);
    assert.equal((await api.request({ action: 'hatch', eggId, requestId: 'retry-hatch' })).status, 200);
    assert.equal(api.getProfile('owner').characters.characters.length, 2);
  } finally { await api.close(); }
});

test('legacy NFT profiles gain a founder collection without losing their original editor traits', async () => {
  const api = await fixture();
  try {
    const before = structuredClone(api.getProfile('legacy').nft);
    const result = await api.request(null, 'legacy');
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.profile.nft, before);
    assert.deepEqual(result.data.profile.characters.characters[0].traits, before.traits);
    assert.equal(result.data.guardian.genetics[before.id].generation, 0);
    assert.equal(result.data.profile.characters.selectedId, before.id);
  } finally { await api.close(); }
});

test('empty authenticated API accounts incubate, hatch exactly once and rename with safe request replay', async () => {
  const duration = 3 * 86400000, api = await fixture({ incubationMs: duration });
  try {
    const initialProfile = structuredClone(api.getProfile('empty'));
    const home = await api.request(null, 'empty'); assert.equal(home.status, 200);
    assert.deepEqual(home.data.profile.characters.characters, []);
    assert.deepEqual(home.data.guardian.care, {});
    assert.deepEqual(api.getProfile('empty'), initialProfile);
    assert.equal((await api.request({ action: 'rest', requestId: 'early-rest' }, 'empty')).status, 403);
    assert.equal((await api.request({ action: 'rename_pet', name: 'Pip', requestId: 'early-name' }, 'empty')).status, 403);
    const choice = { action: 'choose_egg', theme: 'mystery', requestId: 'first-egg', incubationMs: 0 };
    const chosen = await api.request(choice, 'empty');
    const egg = chosen.data.guardian.eggs[0]; assert.equal(egg.readyAt, start + duration);
    assert.equal((await api.request(choice, 'empty')).data.guardian.eggs[0].id, egg.id);
    for (let index = 0; index < 3; index++) {
      api.now(start + index * CARE_COOLDOWN_MS);
      assert.equal((await api.request({ action: 'warm_egg', eggId: egg.id, requestId: `empty-warm-${index}` }, 'empty')).status, 200);
    }
    assert.equal((await api.request({ action: 'claim_mission', missionId: 'incubation', requestId: 'early-claim' }, 'empty')).status, 403);
    api.now(start + INCUBATION_MS);
    assert.equal((await api.request({ action: 'hatch', eggId: egg.id, requestId: 'birth' }, 'empty')).status, 200);
    await api.remount(INCUBATION_MS);
    assert.equal((await api.request(null, 'empty')).data.guardian.eggs[0].readyAt, start + duration);
    assert.equal((await api.request({ action: 'choose_egg', theme: 'forest', requestId: 'rechoose' }, 'empty')).data.guardian.eggs[0].readyAt, start + duration);
    api.now(start + duration - 1);
    assert.equal((await api.request({ action: 'hatch', eggId: egg.id, requestId: 'birth' }, 'empty')).status, 200);
    api.now(start + duration);
    const birth = { action: 'hatch', eggId: egg.id, requestId: 'birth' };
    const born = await Promise.all([api.request(birth, 'empty'), api.request(birth, 'empty')]);
    assert.ok(born.every(result => result.status === 200));
    let saved = api.getProfile('empty'); const pet = saved.characters.characters[0];
    assert.equal(saved.characters.characters.length, 1); assert.equal(saved.characters.selectedId, pet.id); assert.equal(saved.selectedCharacter, pet.id);
    assert.equal(saved.revision, 2); assert.equal(saved.inventory.trigo, 0); assert.equal(pet.isStarter, true);
    const naming = { action: 'rename_pet', petId: pet.id, name: ' Pip 🐱! ', requestId: 'pet-name' };
    const names = await Promise.all([api.request(naming, 'empty'), api.request(naming, 'empty')]);
    assert.ok(names.every(result => result.status === 200));
    saved = api.getProfile('empty'); assert.equal(saved.revision, 3); assert.equal(saved.characters.characters[0].name, 'Pip 🐱!');
    assert.equal((await api.request({ ...naming, name: 'Pop' }, 'empty')).status, 409);
    assert.equal((await api.request({ ...naming, requestId: 'stolen-name' }, 'other')).status, 403);
    assert.equal((await api.request({ ...naming, name: '<b>Pip</b>', requestId: 'bad-name' }, 'empty')).status, 400);
    assert.equal((await api.request({ ...naming, name: 'Pip 🐱!', requestId: 'same-name' }, 'empty')).status, 200);
    assert.equal(api.getProfile('empty').revision, 3);
    assert.ok(!JSON.stringify(names[0].data).includes('alleles'));
  } finally { await api.close(); }
});

test('guardian accepts authenticated accounts with no stored profile and first birth creates one', async () => {
  const api = await fixture();
  try {
    assert.equal(api.getProfile('no-profile'), null);
    assert.equal((await api.request(null, 'no-profile')).status, 200);
    assert.equal(api.getProfile('no-profile'), null);
    const chosen = await api.request({ action: 'choose_egg', theme: 'forest', requestId: 'new-account' }, 'no-profile');
    const eggId = chosen.data.guardian.eggs[0].id;
    for (let index = 0; index < 3; index++) { api.now(start + index * CARE_COOLDOWN_MS); await api.request({ action: 'warm_egg', eggId, requestId: `warm-${index}` }, 'no-profile'); }
    api.now(start + INCUBATION_MS);
    assert.equal((await api.request({ action: 'hatch', eggId, requestId: 'birth' }, 'no-profile')).status, 200);
    assert.equal(api.getProfile('no-profile').characters.characters.length, 1);
    assert.equal(api.getProfile('no-profile').revision, 1);
  } finally { await api.close(); }
});

test('route mount reads AODASE_INCUBATION_MS from server environment', async () => {
  const previous = process.env.AODASE_INCUBATION_MS;
  try {
    process.env.AODASE_INCUBATION_MS = String(5 * 86400000);
    const api = await fixture({ incubationMs: undefined });
    // An omitted override is verified directly because fixture uses a deterministic
    // development duration by default for all other tests.
    assert.equal(resolveIncubationMs(), 5 * 86400000);
    try {
      await api.remount(undefined);
      const chosen = await api.request({ action: 'choose_egg', theme: 'water', requestId: 'env-egg' }, 'empty');
      assert.equal(chosen.data.guardian.eggs[0].readyAt, start + 5 * 86400000);
    } finally { await api.close(); }
    process.env.AODASE_INCUBATION_MS = 'oops';
    assert.throws(() => mountFoodieGuardian({}, {}), /AODASE_INCUBATION_MS/);
  } finally {
    if (previous === undefined) delete process.env.AODASE_INCUBATION_MS;
    else process.env.AODASE_INCUBATION_MS = previous;
  }
});
