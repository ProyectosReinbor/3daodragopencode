import type { PetAppearance } from '../../shared/pet-appearance.js';
import { buildDesignedPet } from './pet-model';
import type { Group } from 'three';
import { DEFAULT_APPEARANCE, normalizeAppearance } from '../../shared/pet-appearance.js';

export type Element = 'fuego' | 'agua' | 'tierra' | 'aire' | 'sombra' | 'luz';
export type Rarity = 'comun' | 'raro' | 'epico' | 'legendario' | 'especial';
export type BodyType = 'humanoid' | 'bestia' | 'espectral' | 'golem';
export type StatName = 'atk' | 'def' | 'spd' | 'hp' | 'ability';

export interface NftTraits {
  appearance?: PetAppearance;
  headShape?: 'round' | 'cube' | 'diamond';
  limbLength?: number;
  limbCount?: number;
  element: Element;
  rarity: Rarity;
  bodyType: BodyType;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  eyeStyle: number;
  hornStyle: number;
  wingStyle: number;
  pattern: number;
}

export interface NftStats {
  atk: number;
  def: number;
  spd: number;
  hp: number;
  ability: number;
}

export interface NftUpgrade {
  source: 'game' | 'qr';
  label: string;
  stat?: StatName;
  amount?: number;
  timestamp: number;
}

export interface NftCharacter {
  id: string;
  phoneId: string;
  name: string;
  traits: NftTraits;
  baseStats: NftStats;
  level: number;
  xp: number;
  upgrades: NftUpgrade[];
}

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function phoneHash(phone: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < phone.length; i++) {
    h ^= phone.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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

const ELEMENT_PREFIXES: Record<Element, string[]> = {
  fuego: ['Ignis', 'Pyro', 'Ember', 'Flam', 'Scorch', 'Cinder'],
  agua: ['Aqua', 'Tidal', 'Wave', 'Marin', 'Coral', 'Abyss'],
  tierra: ['Terra', 'Stone', 'Iron', 'Crystal', 'Boulder', 'Granite'],
  aire: ['Zephyr', 'Gale', 'Wind', 'Storm', 'Breeze', 'Nimbus'],
  sombra: ['Umbra', 'Shadow', 'Void', 'Dark', 'Night', 'Phantom'],
  luz: ['Solar', 'Luna', 'Star', 'Radiant', 'Dawn', 'Prism'],
};

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

const RARITY_LABELS: Record<Rarity, string> = {
  comun: 'Comun',
  raro: 'Raro',
  epico: 'Epico',
  legendario: 'Legendario',
  especial: 'Especial',
};
const RARITY_CSS: Record<Rarity, string> = {
  comun: '#aaaaaa',
  raro: '#4499dd',
  epico: '#aa55ee',
  legendario: '#eeaa00',
  especial: '#df6499',
};
const ELEMENT_CSS: Record<Element, string> = {
  fuego: '#dd4422',
  agua: '#3399cc',
  tierra: '#668844',
  aire: '#88aacc',
  sombra: '#664488',
  luz: '#ddcc88',
};
const STAT_LABELS: Record<StatName, string> = {
  atk: 'Ataque',
  def: 'Defensa',
  spd: 'Velocidad',
  hp: 'Vida',
  ability: 'Habilidad',
};
const STAT_ICONS: Record<StatName, string> = {
  atk: '⚔',
  def: '🛡',
  spd: '💨',
  hp: '❤',
  ability: '✦',
};

type Rng = () => number;

function seededRng(seed: number): Rng {
  return mulberry32(seed);
}
function globalRng(): Rng {
  return Math.random;
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

function genId(rng: Rng = globalRng()): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'RA-';
  for (let i = 0; i < 8; i++) id += c[Math.floor(rng() * c.length)];
  return id;
}

function genName(el: Element, id: string, rng: Rng = globalRng()): string {
  return (
    pick(ELEMENT_PREFIXES[el], rng) +
    NAME_SUFFIXES[(id.charCodeAt(3) + id.charCodeAt(6)) % NAME_SUFFIXES.length]
  );
}

function pickColor(palette: number[], rng: Rng = globalRng()): number {
  return pick(palette, rng);
}

function makeNft(rng: Rng): NftCharacter {
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
  const pools: Record<Rarity, number> = {
    comun: 28,
    raro: 38,
    epico: 52,
    legendario: 72,
    especial: 84,
  };
  return {
    id,
    phoneId: '',
    name: genName(element, id, rng),
    traits: {
      element,
      rarity,
      bodyType,
      primaryColor: pickColor(colors.primary, rng),
      secondaryColor: pickColor(colors.secondary, rng),
      accentColor: pickColor(colors.accent, rng),
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
  };
}

export function generateNft(): NftCharacter {
  return makeNft(globalRng());
}

export function generateNftFromPhone(phoneStr: string): NftCharacter {
  const seed = phoneHash(phoneStr);
  const nft = makeNft(seededRng(seed));
  nft.phoneId = phoneStr;
  return nft;
}

export function totalStats(nft: NftCharacter): NftStats {
  const s = { ...nft.baseStats };
  for (const u of nft.upgrades) if (u.stat && u.amount) s[u.stat] += u.amount;
  const b = nft.level - 1;
  s.atk += b;
  s.def += b;
  s.spd += b;
  s.hp += b;
  s.ability += b;
  return s;
}

export function xpForLevel(level: number): number {
  return level * 25 + Math.floor(level * level * 2);
}

export function rarityLabel(r: Rarity): string {
  return RARITY_LABELS[r];
}
export function rarityColor(r: Rarity): string {
  return RARITY_CSS[r];
}
export function elementLabel(e: Element): string {
  return {
    fuego: 'Fuego',
    agua: 'Agua',
    tierra: 'Tierra',
    aire: 'Aire',
    sombra: 'Sombra',
    luz: 'Luz',
  }[e];
}
export function elementColor(e: Element): string {
  return ELEMENT_CSS[e];
}
export function statLabel(s: StatName): string {
  return STAT_LABELS[s];
}
export function statIcon(s: StatName): string {
  return STAT_ICONS[s];
}

/** Render stored designs and older collections through the same collectible 3D style. */
export function buildNftModel(nft: NftCharacter): Group {
  const t = nft.traits;
  if (t.appearance) return buildDesignedPet(t);
  const species =
    t.bodyType === 'espectral'
      ? 'spirit'
      : t.bodyType === 'humanoid'
        ? 'alien'
        : t.bodyType === 'golem'
          ? 'monster'
          : 'cat';
  const appearance = normalizeAppearance({
    ...DEFAULT_APPEARANCE,
    species,
    coat: t.bodyType === 'espectral' || t.bodyType === 'humanoid' ? 'smooth' : 'fluffy',
    limbKind:
      t.bodyType === 'espectral'
        ? 'tentacles'
        : t.bodyType === 'humanoid' || t.bodyType === 'golem'
          ? 'hands'
          : 'paws',
    headY: -0.1,
    wings: t.wingStyle > 1 ? 'bat' : t.wingStyle > 0 ? 'feather' : 'none',
    spikes: Math.min(8, Math.max(0, Math.round(t.hornStyle || 0) * 2)),
  })!;
  return buildDesignedPet({
    ...t,
    appearance,
    headShape: t.headShape ?? 'round',
    limbCount: t.limbCount ?? (t.bodyType === 'espectral' ? 2 : 4),
    limbLength: t.limbLength ?? 0.9,
  });
}
