import { normalizeAppearance } from '../shared/pet-appearance.js';
import { randomInt, randomUUID } from 'node:crypto';

export const ELEMENTS = ['fuego', 'agua', 'tierra', 'aire', 'sombra', 'luz'];
const STAT_KEYS = ['atk', 'def', 'spd', 'hp', 'ability'];

export function dartPosition(elapsed) {
  return 5 + 90 * (1 - Math.abs((elapsed % 2400) / 1200 - 1));
}
export function dartPrize(position) {
  const distance = Math.abs(position - 50);
  return distance <= 2 ? { bonus: 5, rarity: 'especial' }
    : distance <= 6 ? { bonus: 4, rarity: 'legendario' }
    : distance <= 15 ? { bonus: 3, rarity: 'epico' }
    : distance <= 30 ? { bonus: 2, rarity: 'raro' }
    : { bonus: 1, rarity: 'comun' };
}
export function dartBonus(elapsed) { return dartPrize(dartPosition(elapsed)).bonus; }
const POWERS = ['fireball', 'flame_burst', 'heal_wave', 'frost_shield', 'stone_wall', 'earthquake', 'dash', 'wind_blade', 'shadow_step', 'dark_pulse', 'divine_smite', 'holy_barrier'];
export function cleanPetName(value) {
  if (typeof value !== 'string') throw new Error('Escribe el nombre de tu Pet.');
  const name = value.trim().normalize('NFC');
  if (Array.from(name).length < 2 || Array.from(name).length > 24 || !/^[\p{L}\p{N} '\-]+$/u.test(name)) {
    throw new Error('Usa de 2 a 24 letras, números, espacios, guiones o apóstrofes.');
  }
  return name;
}

function createPet(choice) {
  const name = cleanPetName(choice.name);
  if (!ELEMENTS.includes(choice.element) || !['humanoid', 'bestia', 'espectral', 'golem'].includes(choice.bodyType)) throw new Error('Elige un elemento y una forma válidos.');
  if (!/^#[0-9a-f]{6}$/i.test(choice.color)) throw new Error('Elige un color válido.');
  if (!Array.isArray(choice.powers) || choice.powers.length !== 2 || new Set(choice.powers).size !== 2 || choice.powers.some(p => !POWERS.includes(p))) throw new Error('Elige dos poderes diferentes.');
  const headShape = choice.headShape ?? 'round';
  const limbLength = choice.limbLength ?? 1;
  const limbCount = choice.limbCount ?? 4;
  if (!['round', 'cube', 'diamond'].includes(headShape) || !Number.isFinite(limbLength) || limbLength < 0.5 || limbLength > 1.8 || ![0, 2, 4, 6, 8].includes(limbCount)) throw new Error('Revisa la cabeza y las extremidades elegidas.');
  const appearance = normalizeAppearance(choice.appearance);
  for (const key of ['secondaryColor', 'accentColor']) {
    if (choice[key] !== undefined && !/^#[0-9a-f]{6}$/i.test(choice[key])) throw new Error('Elige colores válidos para los detalles.');
  }
  const dice = Object.fromEntries(STAT_KEYS.map(key => [key, [randomInt(1, 7), randomInt(1, 7)]]));
  return { dice, pet: {
    id: `FP-${randomUUID()}`, name, powers: choice.powers,
    traits: { appearance, headShape, limbLength, limbCount, element: choice.element, rarity: 'comun', bodyType: choice.bodyType,
      primaryColor: parseInt(choice.color.slice(1), 16), secondaryColor: choice.secondaryColor ? parseInt(choice.secondaryColor.slice(1), 16) : 0xffd4a3, accentColor: choice.accentColor ? parseInt(choice.accentColor.slice(1), 16) : 0xfff4db,
      eyeStyle: randomInt(5), hornStyle: randomInt(2), wingStyle: 0, pattern: randomInt(4) },
    baseStats: Object.fromEntries(STAT_KEYS.map(key => [key, dice[key][0] + dice[key][1]])),
    level: 1, xp: 0, upgrades: [], unlockedAt: Date.now(), source: 'starter', isStarter: true,
  }};
}

function starterProfile(pet) {
  return {
    version: 2, characters: { characters: [pet], selectedId: pet.id }, selectedCharacter: pet.id,
    inventory: { trigo: 0, mineral: 0, esencia: 0, madera: 0, hierba: 0 },
    crafted: Object.fromEntries(['racion', 'espada', 'pocion', 'escudo', 'unguento', 'armadura', 'amuleto', 'pocion_fuerza', 'pocion_velocidad', 'antidoto', 'gran_pocion', 'elixir'].map((key) => [key, 0])),
    redeemedRewards: [], quest: { resources: 0, creatures: 0, completed: false }, quests: [],
    attributePoints: 0, currentZone: 'aldea', unlockedZones: ['aldea'], loot: [], achievements: [],
    dailyQuests: { date: '', quests: [], states: [], loginStreak: 0, lastLoginDate: '', totalClaimed: 0 },
    currency: 0, crystals: 0,
  };
}

export function mountFoodieOnboarding(app, { db, auth, getProfile, saveProfile }) {
  db.exec(`CREATE TABLE IF NOT EXISTS foodie_onboarding (
    id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL, claimed_by TEXT
  )`);
  const update = (id, session) => db.prepare('UPDATE foodie_onboarding SET data = ? WHERE id = ?').run(JSON.stringify(session), id);
  function load(id) {
    const row = db.prepare('SELECT * FROM foodie_onboarding WHERE id = ?').get(id);
    if (!row || row.expires_at < Date.now()) throw new Error('Tu sesión expiró. Vuelve a empezar desde la portada.');
    return { row, session: JSON.parse(row.data) };
  }
  const respond = (res, id, session) => res.json({ id, ...session, serverNow: Date.now() });
  const handle = (fn) => (req, res) => {
    try { fn(req, res); } catch (error) { res.status(400).json({ error: error.message }); }
  };

  app.post('/api/onboarding', handle((_req, res) => {
    db.prepare('DELETE FROM foodie_onboarding WHERE expires_at < ? AND claimed_by IS NULL').run(Date.now());
    const id = randomUUID();
    const session = { stage: 'customize' };
    db.prepare('INSERT INTO foodie_onboarding (id, data, expires_at) VALUES (?, ?, ?)').run(id, JSON.stringify(session), Date.now() + 86400000);
    respond(res, id, session);
  }));
  app.get('/api/onboarding/:id', handle((req, res) => {
    const { session } = load(req.params.id);
    respond(res, req.params.id, session);
  }));
  function clearGift(session) {
    if (session.pet) {
      session.pet.upgrades = session.pet.upgrades.filter(upgrade => upgrade.label !== 'Dardo de bienvenida');
      session.pet.traits.rarity = 'comun';
    }
    delete session.dart;
  }
  function editable(id) {
    const loaded = load(id);
    if (loaded.row.claimed_by) throw new Error('Este Pet ya fue guardado.');
    return loaded;
  }
  app.post('/api/onboarding/:id/back', handle((req, res) => {
    const { session, row } = editable(req.params.id);
    if (!['customize', 'dice'].includes(req.body.stage) || (req.body.stage === 'dice' && !session.dice)) throw new Error('Ese paso todavía no está disponible.');
    clearGift(session); session.stage = req.body.stage; update(row.id, session);
    respond(res, row.id, session);
  }));
  app.post('/api/onboarding/:id/customize', handle((req, res) => {
    const { session, row } = editable(req.params.id);
    const next = createPet(req.body);
    if (session.pet) {
      next.pet.id = session.pet.id; next.pet.unlockedAt = session.pet.unlockedAt;
      next.pet.baseStats = session.pet.baseStats;
    }
    session.pet = next.pet; clearGift(session); session.stage = 'dice'; update(row.id, session);
    respond(res, row.id, session);
  }));
  app.post('/api/onboarding/:id/roll', handle((req, res) => {
    const { session, row } = editable(req.params.id);
    if (req.body.attemptId && req.body.attemptId === session.lastRollId) return respond(res, row.id, session);
    if (req.body.element) {
      const next = createPet(req.body);
      if (session.pet) { next.pet.id = session.pet.id; next.pet.unlockedAt = session.pet.unlockedAt; }
      Object.assign(session, next);
    } else {
      if (!session.pet) throw new Error('Diseña tu Pet primero.');
      session.dice = Object.fromEntries(STAT_KEYS.map(key => [key, [randomInt(1, 7), randomInt(1, 7)]]));
      session.pet.baseStats = Object.fromEntries(STAT_KEYS.map(key => [key, session.dice[key][0] + session.dice[key][1]]));
    }
    clearGift(session); session.stage = 'dice'; session.lastRollId = req.body.attemptId;
    update(row.id, session); respond(res, row.id, session);
  }));
  app.post('/api/onboarding/:id/dart/start', handle((req, res) => {
    const { session, row } = load(req.params.id);
    if (row.claimed_by || !session.pet || !session.dice) throw new Error('Primero lanza los dados de tu Pet.');
    if (!STAT_KEYS.includes(req.body.stat)) throw new Error('Selecciona una estadística válida.');
    if (!session.dart) {
      if (req.body.name) session.pet.name = cleanPetName(req.body.name);
      session.dart = { startedAt: Date.now(), stat: req.body.stat };
      session.stage = 'dart'; update(row.id, session);
    }
    respond(res, row.id, session);
  }));
  app.post('/api/onboarding/:id/dart/throw', handle((req, res) => {
    const { session, row } = load(req.params.id);
    if (row.claimed_by || !session.dart) throw new Error('Primero prepara tu dardo.');
    if (session.dart.bonus === undefined) {
      const elapsed = Date.now() - session.dart.startedAt;
      const shot = req.body.elapsed;
      if (req.body.accessible !== true && (!Number.isFinite(shot) || shot < 0 || shot > elapsed + 250 || elapsed - shot > 2000)) throw new Error('El lanzamiento llegó tarde. Vuelve a intentarlo.');
      const position = req.body.accessible === true || elapsed > 30000 ? 5 : dartPosition(shot);
      const { bonus, rarity } = dartPrize(position);
      session.dart.bonus = bonus; session.dart.position = position;
      session.pet.traits.rarity = rarity;
      if (bonus) session.pet.upgrades.push({ source: 'game', label: 'Dardo de bienvenida', stat: session.dart.stat, amount: bonus, timestamp: Date.now() });
      session.stage = 'summary'; update(row.id, session);
    }
    respond(res, row.id, session);
  }));
  app.post('/api/onboarding/:id/claim', auth, handle((req, res) => {
    const transaction = db.transaction(() => {
      const { session, row } = load(req.params.id);
      if (row.claimed_by && row.claimed_by !== req.phone) throw new Error('Este Pet ya pertenece a otra cuenta.');
      const existing = getProfile(req.phone);
      if (existing?.characters?.characters?.length || existing?.nft) return existing;
      if (session.stage !== 'summary') throw new Error('Completa los dados y el dardo antes de guardar.');
      const profile = starterProfile(session.pet);
      saveProfile(req.phone, profile);
      db.prepare('UPDATE foodie_onboarding SET claimed_by = ? WHERE id = ?').run(req.phone, row.id);
      return profile;
    });
    res.json(transaction());
  }));
}
