import type { Element, Rarity, BodyType, StatName, NftStats, NftUpgrade, NftTraits } from './nft';
import { mulberry32, phoneHash, totalStats as nftTotalStats, xpForLevel } from './nft';

export type { StatName };

export interface CharacterStats {
  atk: number;
  def: number;
  spd: number;
  hp: number;
  ability: number;
}

export interface Character {
  id: string;
  name: string;
  traits: NftTraits;
  baseStats: NftStats;
  level: number;
  xp: number;
  upgrades: NftUpgrade[];
  unlockedAt: number;
  source: 'generated' | 'starter' | 'promo' | 'exclusive';
  isStarter: boolean;
}

export interface CharacterCollection {
  characters: Character[];
  selectedId: string;
}

const SLIME_TRAITS: NftTraits = {
  element: 'agua',
  rarity: 'comun',
  bodyType: 'golem',
  primaryColor: 0x44cc88,
  secondaryColor: 0x33aa77,
  accentColor: 0x88eecc,
  eyeStyle: 0,
  hornStyle: 0,
  wingStyle: 0,
  pattern: 0,
};

const SLIME_STATS: NftStats = {
  atk: 4,
  def: 4,
  spd: 4,
  hp: 4,
  ability: 4,
};

const ELEMENT_PREFIXES: Record<Element, string[]> = {
  fuego: ['Ignis', 'Pyro', 'Ember', 'Flam', 'Scorch', 'Cinder'],
  agua: ['Aqua', 'Tidal', 'Wave', 'Marin', 'Coral', 'Abyss'],
  tierra: ['Terra', 'Stone', 'Iron', 'Crystal', 'Boulder', 'Granite'],
  aire: ['Zephyr', 'Gale', 'Wind', 'Storm', 'Breeze', 'Nimbus'],
  sombra: ['Umbra', 'Shadow', 'Void', 'Dark', 'Night', 'Phantom'],
  luz: ['Solar', 'Luna', 'Star', 'Radiant', 'Dawn', 'Prism'],
};

type Rng = () => number;

function globalRng(): Rng {
  return Math.random;
}

const NAME_SUFFIXES = [
  'thar',
  'ion',
  'os',
  'ix',
  'an',
  'or',
  'ius',
  'ex',
  'ar',
  'um',
  'el',
  'is',
  'ax',
  'en',
];

function genId(rng: Rng = globalRng()): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'RA-';
  for (let i = 0; i < 8; i++) id += c[Math.floor(rng() * c.length)];
  return id;
}

function pick<T>(arr: T[], rng: Rng = globalRng()): T {
  return arr[Math.floor(rng() * arr.length)];
}

function weighted<T>(items: [T, number][], rng: Rng = globalRng()): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

const ELEMENT_COLORS: Record<
  Element,
  { primary: number[]; secondary: number[]; accent: number[] }
> = {
  fuego: {
    primary: [0xcc3333, 0xdd4422, 0xbb2244],
    secondary: [0xff8844, 0xee6633],
    accent: [0xffcc00, 0xffaa22],
  },
  agua: {
    primary: [0x3366cc, 0x2255bb, 0x4477dd],
    secondary: [0x44aadd, 0x3399cc],
    accent: [0x88ddff, 0x66ccee],
  },
  tierra: {
    primary: [0x668844, 0x557733, 0x779955],
    secondary: [0x8b6914, 0x7a5810],
    accent: [0xddbb44, 0xccaa33],
  },
  aire: {
    primary: [0x88aacc, 0x7799bb, 0x99bbdd],
    secondary: [0xbbddee, 0xaaccdd],
    accent: [0xffffff, 0xeeeeee],
  },
  sombra: {
    primary: [0x443355, 0x332244, 0x554466],
    secondary: [0x664488, 0x553377],
    accent: [0xaa66cc, 0x9955bb],
  },
  luz: {
    primary: [0xddcc88, 0xccbb77, 0xeedd99],
    secondary: [0xffeebb, 0xeedd99],
    accent: [0xffffff, 0xffffee],
  },
};

function distributePool(pool: number, rng: Rng = globalRng()): NftStats {
  const keys: StatName[] = ['atk', 'def', 'spd', 'hp', 'ability'];
  const v: Record<string, number> = {};
  let rem = pool;
  for (const k of keys) {
    v[k] = 2;
    rem -= 2;
  }
  for (let i = 0; i < rem; i++) v[pick(keys, rng)] += 1;
  return { atk: v.atk, def: v.def, spd: v.spd, hp: v.hp, ability: v.ability };
}

function genName(el: Element, id: string, rng: Rng = globalRng()): string {
  return (
    pick(ELEMENT_PREFIXES[el], rng) +
    NAME_SUFFIXES[(id.charCodeAt(3) + id.charCodeAt(6)) % NAME_SUFFIXES.length]
  );
}

function makeCharacter(rng: Rng): Character {
  const id = genId(rng);
  const rarity = weighted<Rarity>(
    [
      ['comun', 55],
      ['raro', 28],
      ['epico', 13],
      ['legendario', 4],
    ],
    rng
  );
  const element = pick<Element>(['fuego', 'agua', 'tierra', 'aire', 'sombra', 'luz'], rng);
  const bodyType = pick<BodyType>(['humanoid', 'bestia', 'espectral', 'golem'], rng);
  const colors = ELEMENT_COLORS[element];
  const pools: Record<Rarity, number> = { comun: 28, raro: 38, epico: 52, legendario: 72 };
  return {
    id,
    name: genName(element, id, rng),
    traits: {
      element,
      rarity,
      bodyType,
      primaryColor: pick(colors.primary, rng),
      secondaryColor: pick(colors.secondary, rng),
      accentColor: pick(colors.accent, rng),
      eyeStyle: Math.floor(rng() * 5),
      hornStyle:
        rarity === 'legendario'
          ? pick([1, 2, 3], rng)
          : rarity === 'epico'
            ? pick([0, 1, 2], rng)
            : pick([0, 0, 1], rng),
      wingStyle:
        rarity === 'legendario'
          ? pick([0, 1, 2, 3], rng)
          : rarity === 'epico'
            ? pick([0, 0, 1], rng)
            : 0,
      pattern: Math.floor(rng() * 4),
    },
    baseStats: distributePool(pools[rarity], rng),
    level: 1,
    xp: 0,
    upgrades: [],
    unlockedAt: Date.now(),
    source: 'generated',
    isStarter: false,
  };
}

export function createStarterCharacter(): Character {
  return {
    id: 'RA-SLIME-ANCESTRAL',
    name: 'Slime Ancestral',
    traits: { ...SLIME_TRAITS },
    baseStats: { ...SLIME_STATS },
    level: 1,
    xp: 0,
    upgrades: [],
    unlockedAt: Date.now(),
    source: 'starter',
    isStarter: true,
  };
}

export function generateCharacterFromPhone(phoneStr: string): Character {
  const seed = phoneHash(phoneStr);
  const rng = mulberry32(seed);
  const c = makeCharacter(rng);
  return c;
}

export function totalStats(character: Character): NftStats {
  return nftTotalStats(character as any);
}

export function createEmptyCollection(): CharacterCollection {
  return {
    characters: [],
    selectedId: '',
  };
}

export function ensureStarterCharacter(collection: CharacterCollection): CharacterCollection {
  if (collection.characters.length === 0) {
    const starter = createStarterCharacter();
    collection.characters.push(starter);
    collection.selectedId = starter.id;
  }
  if (
    !collection.selectedId ||
    !collection.characters.find((c) => c.id === collection.selectedId)
  ) {
    collection.selectedId = collection.characters[0].id;
  }
  return collection;
}

export class CharacterManager {
  constructor(private collection: CharacterCollection) {}

  getAll(): Character[] {
    return this.collection.characters;
  }

  getActive(): Character {
    const active = this.collection.characters.find((c) => c.id === this.collection.selectedId);
    if (!active) {
      const starter = createStarterCharacter();
      this.collection.characters.push(starter);
      this.collection.selectedId = starter.id;
      return starter;
    }
    return active;
  }

  getById(id: string): Character | undefined {
    return this.collection.characters.find((c) => c.id === id);
  }

  selectCharacter(id: string): boolean {
    const found = this.collection.characters.find((c) => c.id === id);
    if (!found) return false;
    this.collection.selectedId = id;
    return true;
  }

  addCharacter(character: Character): void {
    this.collection.characters.push(character);
  }

  unlockCharacter(character: Character): void {
    const existing = this.collection.characters.find((c) => c.id === character.id);
    if (!existing) {
      this.collection.characters.push(character);
    }
  }

  hasCharacter(id: string): boolean {
    return this.collection.characters.some((c) => c.id === id);
  }

  getCollection(): CharacterCollection {
    return this.collection;
  }

  setCollection(collection: CharacterCollection): void {
    this.collection = collection;
  }

  count(): number {
    return this.collection.characters.length;
  }

  addExperience(amount: number): void {
    const active = this.getActive();
    active.xp += amount;
  }

  addLevel(): boolean {
    const active = this.getActive();
    const required = xpForLevel(active.level);
    if (active.xp >= required) {
      active.xp -= required;
      active.level += 1;
      return true;
    }
    return false;
  }
}
