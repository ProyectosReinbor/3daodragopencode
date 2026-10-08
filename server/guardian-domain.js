import { createHash, randomInt, randomUUID } from 'node:crypto';
import { APPEARANCE_ENUMS, APPEARANCE_NUMBERS, DEFAULT_APPEARANCE, normalizeAppearance } from '../shared/pet-appearance.js';
import { petSpeciesName } from '../shared/pet-species.js';
import { generatePetTraits } from '../shared/pet-genetics.js';
import { initialWorldProgress } from '../shared/world-items.js';
import { applyPurchaseExperience } from './foodie-growth.js';

export const CARE_COOLDOWN_MS = 3000;
export const INCUBATION_MS = 90000;
export const MAX_INCUBATION_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_COLLECTION = 40;
const DECAY_TICK_MS = 15 * 60 * 1000;
const MAX_DECAY_TICKS = 96;
const METERS = ['satiety', 'energy', 'mood', 'hygiene', 'affection', 'health', 'curiosity'];
const CARE_ACTIONS = ['feed', 'play', 'rest', 'bathe', 'pet', 'train'];
const STAT_KEYS = ['atk', 'def', 'spd', 'hp', 'ability'];
const THEMES = {
  forest: { label: 'Huevo del bosque', element: 'tierra', colors: [0x86a674, 0xe8ddbd, 0xe9bd77], name: 'Musgo' },
  fire: { label: 'Huevo de fuego', element: 'fuego', colors: [0xe78958, 0xffdfb2, 0xbc715f], name: 'Brasa' },
  water: { label: 'Huevo de agua', element: 'agua', colors: [0x8cbcc4, 0xe8f4e8, 0xc4b6da], name: 'Burbuja' },
  mystery: { label: 'Huevo misterioso', element: 'luz', colors: [0xb19bc9, 0xf2e4cc, 0x95c8bb], name: 'Chispa' },
};
export const MISSION_SPECS = [
  { id: 'firstcare', title: 'Un primer vínculo', description: 'Cuida a uno de tus AODASE Pets.', target: 1, reward: { food: 5, coins: 10, xp: 10 } },
  { id: 'incubation', title: 'Calor de hogar', description: 'Da calor tres veces a tu huevo.', target: 3, reward: { food: 4, coins: 15, xp: 15 } },
  { id: 'hatching', title: 'Una nueva amistad', description: 'Ayuda a nacer a tu compañero.', target: 1, reward: { food: 6, coins: 25, xp: 25 } },
];

export class GuardianError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Captured at route mount. A stored egg's readyAt is never recalculated.
export function resolveIncubationMs(value = process.env.AODASE_INCUBATION_MS) {
  if (value === undefined || value === '') return INCUBATION_MS;
  const duration = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value;
  if (!Number.isSafeInteger(duration) || duration < INCUBATION_MS || duration > MAX_INCUBATION_MS) {
    throw new Error(`AODASE_INCUBATION_MS debe ser un entero entre ${INCUBATION_MS} y ${MAX_INCUBATION_MS} milisegundos.`);
  }
  return duration;
}

/** Complete profile defaults for accounts that begin with an egg rather than an editor pet. */
export function initializeEmptyGuardianProfile(profile = {}) {
  const defaults = {
    version: 2, characters: { characters: [], selectedId: '' }, selectedCharacter: '',
    inventory: { trigo: 0, mineral: 0, esencia: 0, madera: 0, hierba: 0 },
    crafted: Object.fromEntries(['racion', 'espada', 'pocion', 'escudo', 'unguento', 'armadura', 'amuleto', 'pocion_fuerza', 'pocion_velocidad', 'antidoto', 'gran_pocion', 'elixir'].map(key => [key, 0])),
    redeemedRewards: [], quest: { resources: 0, creatures: 0, completed: false }, quests: [],
    attributePoints: 0, currentZone: 'aldea', unlockedZones: ['aldea'], loot: [], achievements: [],
    dailyQuests: { date: '', quests: [], states: [], loginStreak: 0, lastLoginDate: '', totalClaimed: 0 }, currency: 0, crystals: 0,
  };
  for (const [key, value] of Object.entries(defaults)) if (profile[key] === undefined || profile[key] === null) profile[key] = value;
  if (!Array.isArray(profile.characters?.characters)) profile.characters = defaults.characters;
  return profile;
}

export function cleanGuardianName(value) {
  if (typeof value !== 'string') throw new GuardianError('Escribe el nombre de tu Pet.');
  const name = value.trim().normalize('NFC');
  if (Array.from(name).length < 1 || Array.from(name).length > 24 || /[<>\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(name)) {
    throw new GuardianError('Usa de 1 a 24 caracteres de texto, sin HTML ni saltos de línea.');
  }
  return name;
}
const integer = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
const stageFor = (pet) => pet.level >= 10 ? 'adult' : pet.level >= 4 ? 'juvenile' : 'baby';
const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
const choose = (values, rng) => values[rng(values.length)];
const uniquePush = (values, value) => { if (!values.includes(value)) values.push(value); };
const ownedPets = (profile) => Array.isArray(profile?.characters?.characters) ? profile.characters.characters : [];

function careFor(pet, now) {
  return { satiety: 75, energy: 80, mood: 80, hygiene: 80, affection: 35, health: 100, curiosity: 70,
    updatedAt: now, stage: stageFor(pet), personality: 'curioso', activity: 'Conociendo su hogar', _decayAt: now, _affectionTicks: 0 };
}

// Integer, quarter-hour decay preserves its own clock across visits and care actions.
// Absence is capped at one day, and health never causes permanent death.
export function decayCare(care, now) {
  const previous = Number.isFinite(care._decayAt) ? care._decayAt : care.updatedAt;
  const elapsed = Math.max(0, now - previous);
  const ticks = Math.min(MAX_DECAY_TICKS, Math.floor(elapsed / DECAY_TICK_MS));
  for (const meter of METERS) care[meter] = integer(care[meter], meter === 'health' ? 20 : 0);
  if (!ticks) return care;
  for (const meter of ['satiety', 'energy', 'mood', 'hygiene', 'curiosity']) care[meter] = integer(care[meter] - ticks);
  const affectionTicks = integer(care._affectionTicks, 0, 3) + ticks;
  care.affection = integer(care.affection - Math.floor(affectionTicks / 4));
  care._affectionTicks = affectionTicks % 4;
  if (care.satiety < 20 || care.hygiene < 20) care.health = integer(care.health - Math.min(15, ticks), 20);
  care._decayAt = elapsed >= MAX_DECAY_TICKS * DECAY_TICK_MS ? now : previous + ticks * DECAY_TICK_MS;
  care.updatedAt = now;
  if (care.energy < 20) care.activity = 'Necesita descansar';
  else if (care.satiety < 20) care.activity = 'Tiene hambre';
  return care;
}

function appearanceForFounder(pet) {
  try {
    if (pet.traits?.appearance) return normalizeAppearance(pet.traits.appearance);
    const body = pet.traits?.bodyType;
    const species = body === 'espectral' ? 'spirit' : body === 'golem' ? 'monster' : body === 'humanoid' ? 'alien' : 'cat';
    return normalizeAppearance({ ...DEFAULT_APPEARANCE, species,
      headY: -0.1,
      coat: body === 'espectral' || body === 'humanoid' ? 'smooth' : 'fluffy',
      wings: pet.traits?.wingStyle > 1 ? 'bat' : pet.traits?.wingStyle > 0 ? 'feather' : 'none',
      spikes: Math.min(8, Math.max(0, Math.round(pet.traits?.hornStyle || 0) * 2)),
      limbKind: body === 'espectral' ? 'tentacles' : body === 'humanoid' || body === 'golem' ? 'hands' : 'paws' });
  }
  catch { return structuredClone(DEFAULT_APPEARANCE); }
}

function makeGenome(appearance, affinity, { generation = 0, parents = [], origin = 'founder', rng = randomInt, uuid = randomUUID, traits = {} } = {}) {
  const alleles = {};
  for (const [gene, options] of Object.entries(APPEARANCE_ENUMS)) {
    const expressed = options.includes(appearance[gene]) ? appearance[gene] : options[0];
    // Each locus has a dominant expressed allele and a server-only recessive one.
    alleles[gene] = [{ value: expressed, dominance: 'dominant' }, { value: choose(options, rng), dominance: 'recessive' }];
  }
  for (const [gene, [min, max]] of Object.entries(APPEARANCE_NUMBERS)) {
    alleles[gene] = [{ value: appearance[gene], dominance: 'dominant' }, {
      value: gene === 'spikes' ? rng(max - min + 1) + min : Math.round((min + rng(1000000) / 1000000 * (max - min)) * 1000) / 1000,
      dominance: 'recessive',
    }];
  }
  const traitOptions = { bodyType: ['bestia', 'humanoid', 'golem', 'espectral'], headShape: ['round', 'cube', 'diamond'],
    limbCount: [0, 2, 4, 6, 8], eyeStyle: [0, 1, 2, 3, 4], hornStyle: [0, 1], wingStyle: [0, 1], pattern: [0, 1, 2, 3] };
  for (const [gene, options] of Object.entries(traitOptions)) if (traits[gene] !== undefined) {
    alleles[gene] = [{ value: traits[gene], dominance: 'dominant' }, { value: choose(options, rng), dominance: 'recessive' }];
  }
  if (Number.isFinite(traits.limbLength)) alleles.limbLength = [{ value: traits.limbLength, dominance: 'dominant' },
    { value: Math.round((0.5 + rng(1000000) / 1000000 * 1.3) * 1000) / 1000, dominance: 'recessive' }];
  for (const gene of ['primaryColor', 'secondaryColor', 'accentColor']) if (Number.isInteger(traits[gene])) {
    alleles[gene] = [{ value: traits[gene], dominance: 'dominant' }, { value: rng(0x1000000), dominance: 'recessive' }];
  }
  alleles.affinity = [{ value: affinity, dominance: 'dominant' }, { value: choose(['tierra', 'fuego', 'agua', 'aire', 'sombra', 'luz'], rng), dominance: 'recessive' }];
  const knownGenes = ['coat', 'ears', 'wings', 'tail', 'eyes', 'markings', 'eyeColor'].filter(gene => alleles[gene]).map(gene => `${gene}:${alleles[gene][0].value}`);
  const summary = { genomeId: `GEN-${uuid()}`, fingerprint: fingerprint(alleles), generation, parents, origin,
    species: appearance.species, affinity, knownGenes, hiddenGenes: Object.keys(alleles).length };
  return { alleles, public: summary };
}

function discover(state, genome) {
  uniquePush(state.discoveries.species, genome.public.species);
  for (const gene of genome.public.knownGenes) uniquePush(state.discoveries.genes, gene);
}

export function createGuardianState(profile, now, random = {}) {
  const state = { version: 1, food: 8, eggs: [], care: {}, genomes: {}, discoveries: { species: [], genes: [], zones: ['aldea'] },
    progress: { firstcare: 0, incubation: 0, hatching: 0 }, claims: {}, cooldowns: {} };
  reconcileGuardian(state, profile, now, random);
  return state;
}

// Existing approved editor/starter pets remain intact; this adds a gen-0 record.
export function reconcileGuardian(state, profile, now, random = {}) {
  for (const pet of ownedPets(profile)) {
    if (!state.care[pet.id]) state.care[pet.id] = careFor(pet, now);
    if (!state.genomes[pet.id]) {
      state.genomes[pet.id] = makeGenome(appearanceForFounder(pet), pet.traits?.element || 'tierra', { ...random, traits: pet.traits || {} });
      discover(state, state.genomes[pet.id]);
    }
    decayCare(state.care[pet.id], now);
    state.care[pet.id].stage = stageFor(pet);
  }
  return state;
}

export function guardianDTO(state, profile, now) {
  const care = {}, genetics = {};
  for (const pet of ownedPets(profile)) {
    const stored = state.care[pet.id];
    if (!stored || !state.genomes[pet.id]) continue;
    care[pet.id] = Object.fromEntries(METERS.map(meter => [meter, integer(stored[meter], meter === 'health' ? 20 : 0)]));
    Object.assign(care[pet.id], { updatedAt: stored.updatedAt, stage: stageFor(pet), personality: stored.personality, activity: stored.activity });
    genetics[pet.id] = structuredClone(state.genomes[pet.id].public);
  }
  return { version: 1, serverNow: now, food: integer(state.food, 0, 9999),
    eggs: state.eggs.map(egg => ({ id: egg.id, theme: egg.theme, label: egg.label,
      status: egg.petId ? 'hatched' : now >= egg.readyAt || egg.care >= egg.requiredCare ? 'ready' : 'incubating',
      care: egg.care, requiredCare: egg.requiredCare, createdAt: egg.createdAt, readyAt: egg.readyAt,
      warmthBonus: Math.min(3, Math.max(0, egg.care)), ...(egg.petId ? { petId: egg.petId } : {}) })),
    care, genetics, discoveries: structuredClone(state.discoveries),
    missions: MISSION_SPECS.map(mission => ({ ...structuredClone(mission), progress: Math.min(mission.target, state.progress[mission.id]), claimed: Boolean(state.claims[mission.id]) })) };
}

function getOwnedPet(profile, petId) {
  const id = petId || profile.characters?.selectedId || profile.selectedCharacter;
  const pet = ownedPets(profile).find(pet => pet.id === id);
  if (!pet) throw new GuardianError('Selecciona un AODASE Pet de tu colección.', 403);
  return pet;
}
function getOwnedEgg(state, eggId) {
  const egg = state.eggs.find(egg => egg.id === eggId);
  if (!egg) throw new GuardianError('Este huevo no pertenece a tu hogar.', 403);
  return egg;
}
function checkCooldown(state, key, now) {
  if ((state.cooldowns[key] || 0) > now) throw new GuardianError('Espera tres segundos antes de volver a cuidar.', 429);
}
function finishCooldown(state, key, now) { state.cooldowns[key] = now + CARE_COOLDOWN_MS; }
function boost(care, values) {
  for (const [meter, value] of Object.entries(values)) care[meter] = integer(care[meter] + value, meter === 'health' ? 20 : 0);
}

function prepareEgg(theme, now, { rng = randomInt, uuid = randomUUID } = {}, incubationMs = INCUBATION_MS) {
  const spec = THEMES[theme];
  const traits = generatePetTraits(theme, () => rng(1000000) / 1000000);
  const appearance = traits.appearance;
  const genome = makeGenome(appearance, traits.element, { origin: `egg:${theme}`, generation: 0, rng, uuid, traits });
  const stats = Object.fromEntries(STAT_KEYS.map(key => [key, rng(6) + rng(6) + 2]));
  return { id: `EGG-${uuid()}`, theme, label: spec.label, care: 0, requiredCare: 3, readyAt: now + incubationMs,
    genome, appearance, traits, stats, createdAt: now, lastWarmAt: 0 };
}

function hatchPet(egg, now, uuid = randomUUID) {
  const spec = THEMES[egg.theme];
  // Old eggs retain their original persisted phenotype and themed palette.
  const traits = egg.traits ? structuredClone(egg.traits) : {
    appearance: structuredClone(egg.appearance), element: spec.element, rarity: 'comun', bodyType: egg.appearance.species === 'spirit' ? 'espectral' : egg.appearance.species === 'alien' ? 'humanoid' : 'bestia',
    headShape: 'round', limbLength: 0.9, limbCount: 4, primaryColor: spec.colors[0], secondaryColor: spec.colors[1], accentColor: spec.colors[2],
    eyeStyle: 0, hornStyle: egg.appearance.species === 'dragon' ? 1 : 0, wingStyle: egg.appearance.wings === 'none' ? 0 : 1, pattern: 0,
  };
  const powers = { fuego: ['fireball', 'flame_burst'], agua: ['heal_wave', 'frost_shield'], tierra: ['stone_wall', 'earthquake'],
    aire: ['dash', 'wind_blade'], sombra: ['shadow_step', 'dark_pulse'], luz: ['divine_smite', 'holy_barrier'] };
  const warmth = Math.min(3, Math.max(0, Math.floor(egg.care || 0)));
  const baseStats = Object.fromEntries(STAT_KEYS.map(key => [key, egg.stats[key] + warmth]));
  return { id: `FP-${uuid()}`, name: petSpeciesName(traits.appearance.species), level: 1, xp: 0, baseStats, upgrades: [],
    unlockedAt: now, source: 'exclusive', isStarter: false,
    powers: powers[traits.element], traits };
}

export function normalizeGuardianRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GuardianError('Acción inválida.');
  if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_:.-]{1,100}$/.test(body.requestId)) throw new GuardianError('Envía un identificador de solicitud válido.');
  if (!['choose_egg', 'warm_egg', 'hatch', ...CARE_ACTIONS, 'claim_mission', 'rename_pet'].includes(body.action)) throw new GuardianError('Acción desconocida.');
  const request = { action: body.action, requestId: body.requestId };
  for (const key of ['petId', 'eggId', 'theme', 'missionId']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'string' || body[key].length > 100) throw new GuardianError('Acción inválida.');
      request[key] = body[key];
    }
  }
  if (body.action === 'rename_pet') request.name = cleanGuardianName(body.name);
  return request;
}
export function guardianRequestFingerprint(request) {
  const values = [request.action, request.petId || '', request.eggId || '', request.theme || '', request.missionId || ''];
  // Retain existing fingerprints for every pre-rename action and receipt.
  if (request.action === 'rename_pet') values.push(request.name);
  return fingerprint(values);
}

/** Mutates only server-loaded state/profile; callers persist both in one transaction. */
export function applyGuardianAction(state, profile, request, now, random = {}, incubationMs = INCUBATION_MS) {
  reconcileGuardian(state, profile, now, random);
  const { action } = request;
  if (action === 'choose_egg') {
    if (!Object.hasOwn(THEMES, request.theme)) throw new GuardianError('Elige un huevo del bosque, fuego, agua o misterio.');
    if (state.eggs.length) return { message: 'Tu huevo de bienvenida ya está en tu hogar.', profileChanged: false };
    if (ownedPets(profile).length >= MAX_COLLECTION) throw new GuardianError('Tu colección está llena.');
    state.eggs.push(prepareEgg(request.theme, now, random, resolveIncubationMs(incubationMs)));
    return { message: 'Tu huevo tiene un hogar. Dale calor para conocer a tu compañero.', profileChanged: false };
  }
  if (action === 'warm_egg') {
    const egg = getOwnedEgg(state, request.eggId);
    if (egg.petId || egg.care >= egg.requiredCare) return { message: 'El huevo ya recibió todo el cariño que necesita.', profileChanged: false };
    checkCooldown(state, `egg:${egg.id}`, now);
    egg.care++; egg.lastWarmAt = now; state.progress.incubation = Math.min(3, state.progress.incubation + 1);
    finishCooldown(state, `egg:${egg.id}`, now);
    return { message: `El huevo responde al calor: +${Math.min(3, egg.care)} a cada estadística al nacer.${egg.care >= egg.requiredCare ? ' ¡Está listo para abrirse!' : ''}`, profileChanged: false };
  }
  if (action === 'hatch') {
    const egg = getOwnedEgg(state, request.eggId);
    if (egg.petId) return { message: 'Tu compañero ya nació y está en tu colección.', profileChanged: false };
    if (now < egg.readyAt && egg.care < egg.requiredCare) throw new GuardianError('Tu huevo necesita terminar la incubación o recibir calor tres veces.', 409);
    if (ownedPets(profile).length >= MAX_COLLECTION) throw new GuardianError('Tu colección está llena.');
    const pet = hatchPet(egg, now, random.uuid);
    const isFirstPet = ownedPets(profile).length === 0;
    if (isFirstPet) initializeEmptyGuardianProfile(profile);
    profile.characters.characters.push(pet);
    if (isFirstPet) {
      profile.characters.selectedId = pet.id;
      profile.selectedCharacter = pet.id;
      pet.isStarter = true;
    }
    egg.petId = pet.id;
    state.care[pet.id] = careFor(pet, now); state.genomes[pet.id] = egg.genome;
    discover(state, egg.genome); state.progress.hatching = 1;
    return { message: `${pet.name} acaba de nacer. Ya puedes cuidarle en tu hogar.`, profileChanged: true };
  }
  if (action === 'rename_pet') {
    const pet = getOwnedPet(profile, request.petId);
    const name = cleanGuardianName(request.name);
    const profileChanged = pet.name !== name;
    pet.name = name;
    return { message: `Tu Pet ahora se llama ${name}.`, profileChanged };
  }
  if (action === 'claim_mission') {
    const mission = MISSION_SPECS.find(mission => mission.id === request.missionId);
    if (!mission) throw new GuardianError('Selecciona una misión válida.');
    const pet = getOwnedPet(profile, request.petId);
    if (state.claims[mission.id]) return { message: 'Ya recibiste la recompensa de esta misión.', profileChanged: false };
    if (state.progress[mission.id] < mission.target) throw new GuardianError('Completa la misión antes de recibir su recompensa.', 409);
    profile.world ||= initialWorldProgress();
    profile.world.coins = integer(profile.world.coins, 0, Number.MAX_SAFE_INTEGER - mission.reward.coins) + mission.reward.coins;
    applyPurchaseExperience(profile, mission.reward.xp, pet.id);
    state.food = integer(state.food + mission.reward.food, 0, 9999);
    state.claims[mission.id] = { at: now, petId: pet.id };
    state.care[pet.id].stage = stageFor(pet);
    return { message: `Misión completada: +${mission.reward.food} comida, +${mission.reward.coins} monedas y +${mission.reward.xp} XP.`, profileChanged: true };
  }
  const pet = getOwnedPet(profile, request.petId);
  const care = state.care[pet.id];
  checkCooldown(state, `pet:${pet.id}`, now);
  let profileChanged = false;
  if (action === 'feed') {
    if (state.food < 1) throw new GuardianError('Juega con tu Pet para conseguir comida gratis.');
    state.food--; boost(care, { satiety: 25, mood: 4, affection: 3, health: 4 }); care.activity = 'Disfrutando una comida';
  } else if (action === 'play') {
    if (care.energy < 6) throw new GuardianError('Descansa un momento para recuperar energía.');
    boost(care, { energy: -6, satiety: -3, mood: 16, affection: 6, curiosity: 8 });
    state.food = integer(state.food + 2, 0, 9999); care.activity = 'Jugando contigo';
  } else if (action === 'rest') {
    boost(care, { energy: 28, health: 4, mood: 4 }); care.activity = 'Descansando en su hogar';
  } else if (action === 'bathe') {
    boost(care, { hygiene: 30, mood: 4, health: 3 }); care.activity = 'Limpio y cómodo';
  } else if (action === 'pet') {
    boost(care, { affection: 16, mood: 10, health: 1 }); care.activity = 'Recibiendo cariño';
  } else if (action === 'train') {
    if (care.energy < 8) throw new GuardianError('Tu Pet necesita descansar antes de entrenar.');
    boost(care, { energy: -8, satiety: -4, mood: 4, affection: 2, curiosity: 12 });
    applyPurchaseExperience(profile, 3, pet.id); profileChanged = true; care.activity = 'Aprendiendo algo nuevo';
  } else throw new GuardianError('Acción desconocida.');
  care.updatedAt = now; care.stage = stageFor(pet);
  state.progress.firstcare = 1;
  finishCooldown(state, `pet:${pet.id}`, now);
  return { message: action === 'play' ? `${pet.name} se divierte contigo. Encontraste 2 raciones.` : action === 'train' ? `${pet.name} aprendió contigo: +3 XP.` : `${pet.name} agradece tus cuidados.`, profileChanged };
}
