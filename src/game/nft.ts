import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  TorusGeometry,
  CapsuleGeometry,
} from 'three';

export type Element = 'fuego' | 'agua' | 'tierra' | 'aire' | 'sombra' | 'luz';
export type Rarity = 'comun' | 'raro' | 'epico' | 'legendario' | 'especial';
export type BodyType = 'humanoid' | 'bestia' | 'espectral' | 'golem';
export type StatName = 'atk' | 'def' | 'spd' | 'hp' | 'ability';

export interface NftTraits {
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
  const pools: Record<Rarity, number> = { comun: 28, raro: 38, epico: 52, legendario: 72, especial: 84 };
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

export function buildNftModel(nft: NftCharacter): Group {
  const g = new Group();
  const mat = (c: number) => new MeshLambertMaterial({ color: c, flatShading: true });
  const t = nft.traits;
  const pm = mat(t.primaryColor);
  const sm = mat(t.secondaryColor);
  const am = mat(t.accentColor);

  if (t.headShape) {
    const length = t.limbLength ?? 1;
    const count = t.limbCount ?? 4;
    const legHeight = count ? 0.55 * length : 0.15;
    const bodyY = legHeight + 0.5;
    const bodyGeometry = t.bodyType === 'golem' ? new BoxGeometry(0.85, 0.9, 0.65)
      : t.bodyType === 'bestia' ? new CapsuleGeometry(0.4, 0.55, 6, 10)
      : t.bodyType === 'espectral' ? new SphereGeometry(0.5, 12, 10)
      : new CapsuleGeometry(0.32, 0.45, 6, 10);
    const body = new Mesh(bodyGeometry, pm); body.position.y = bodyY;
    if (t.bodyType === 'bestia') body.rotation.z = Math.PI / 2;
    g.add(body);
    const headGeometry = t.headShape === 'cube' ? new BoxGeometry(0.58, 0.55, 0.55)
      : t.headShape === 'diamond' ? new SphereGeometry(0.4, 4, 2)
      : new SphereGeometry(0.34, 14, 10);
    const headY = bodyY + 0.72;
    const head = new Mesh(headGeometry, pm); head.position.set(0, headY, 0.04); g.add(head);
    for (const x of [-0.12, 0.12]) {
      const eye = new Mesh(new SphereGeometry(0.07, 8, 6), mat(0xffffff)); eye.position.set(x, headY + 0.04, 0.34); g.add(eye);
      const pupil = new Mesh(new SphereGeometry(0.035, 8, 6), mat(0x273224)); pupil.position.set(x, headY + 0.04, 0.395); g.add(pupil);
    }
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const limb = new Mesh(new CapsuleGeometry(0.08, 0.4 * length, 4, 6), pm);
      limb.name = 'custom-limb';
      limb.position.set(Math.cos(angle) * 0.48, legHeight / 2 + 0.02, Math.sin(angle) * 0.38);
      limb.rotation.z = -Math.cos(angle) * 0.3; g.add(limb);
    }
    if (['epico', 'legendario', 'especial'].includes(t.rarity)) {
      const halo = new Mesh(new TorusGeometry(0.46, 0.035, 8, 24), am);
      halo.position.y = headY + 0.55; halo.rotation.x = Math.PI / 2; g.add(halo);
    }
    return g;
  }
  if (t.bodyType === 'humanoid') {
    const head = new Mesh(new SphereGeometry(0.32, 7, 5), mat(0xe0ad7d));
    head.position.y = 1.42;
    g.add(head);
    const body = new Mesh(new CapsuleGeometry(0.38, 0.6, 4, 7), pm);
    body.position.y = 0.82;
    g.add(body);
  } else if (t.bodyType === 'bestia') {
    const torso = new Mesh(new BoxGeometry(1.4, 0.7, 0.8), pm);
    torso.position.y = 1.1;
    g.add(torso);
    const head = new Mesh(new BoxGeometry(0.5, 0.45, 0.5), sm);
    head.position.set(0.8, 1.3, 0);
    g.add(head);
    for (const z of [-0.25, 0.25]) {
      const leg = new Mesh(new BoxGeometry(0.18, 0.7, 0.18), sm);
      leg.position.set(0.4, 0.35, z);
      g.add(leg);
      const leg2 = new Mesh(new BoxGeometry(0.18, 0.7, 0.18), sm);
      leg2.position.set(-0.4, 0.35, z);
      g.add(leg2);
    }
    const tail = new Mesh(new BoxGeometry(0.12, 0.6, 0.12), am);
    tail.position.set(-0.9, 1.3, 0);
    tail.rotation.z = 0.7;
    g.add(tail);
  } else if (t.bodyType === 'espectral') {
    const core = new Mesh(new SphereGeometry(0.5, 8, 6), pm);
    core.position.y = 1.5;
    g.add(core);
    const glow = new Mesh(new SphereGeometry(0.8, 7, 5), sm);
    glow.position.y = 1.5;
    g.add(glow);
    for (let i = 0; i < 4; i++) {
      const wisp = new Mesh(new BoxGeometry(0.12, 0.5, 0.12), am);
      const a = (i / 4) * Math.PI * 2;
      wisp.position.set(Math.cos(a) * 0.5, 0.8, Math.sin(a) * 0.5);
      g.add(wisp);
    }
  } else {
    const torso = new Mesh(new BoxGeometry(0.9, 1.0, 0.8), pm);
    torso.position.y = 1.3;
    g.add(torso);
    const head = new Mesh(new BoxGeometry(0.6, 0.5, 0.55), sm);
    head.position.y = 2.1;
    g.add(head);
    for (const z of [-0.25, 0.25]) {
      const arm = new Mesh(new BoxGeometry(0.25, 0.8, 0.22), pm);
      arm.position.set(0.6, 1.1, z);
      g.add(arm);
      const arm2 = new Mesh(new BoxGeometry(0.25, 0.8, 0.22), pm);
      arm2.position.set(-0.6, 1.1, z);
      g.add(arm2);
    }
  }

  const eyeMat = mat(
    t.rarity === 'legendario' ? 0xffcc00 : t.rarity === 'epico' ? 0xaa55ee : 0xffffff
  );
  const eyeY =
    t.bodyType === 'humanoid'
      ? 1.48
      : t.bodyType === 'bestia'
        ? 1.38
        : t.bodyType === 'espectral'
          ? 1.6
          : 2.18;
  const eyeZ = t.bodyType === 'bestia' ? 0.28 : t.bodyType === 'golem' ? 0.3 : 0.25;
  for (const x of [-0.1, 0.1]) {
    const eye = new Mesh(new SphereGeometry(0.06, 5, 4), eyeMat);
    eye.position.set(x, eyeY, eyeZ);
    g.add(eye);
  }

  if (t.hornStyle > 0) {
    const hornMat = mat(t.accentColor);
    for (const x of [-0.18, 0.18]) {
      const horn = new Mesh(new ConeGeometry(0.06, 0.35, 4), hornMat);
      horn.position.set(x, eyeY + 0.35, 0);
      g.add(horn);
    }
    if (t.hornStyle >= 2) {
      for (const x of [-0.28, 0.28]) {
        const horn2 = new Mesh(new ConeGeometry(0.04, 0.25, 4), hornMat);
        horn2.position.set(x, eyeY + 0.25, -0.05);
        g.add(horn2);
      }
    }
  }

  if (t.wingStyle > 0) {
    const wingMat = mat(t.secondaryColor);
    for (const side of [-1, 1]) {
      const wing = new Mesh(
        new BoxGeometry(0.08, 0.5 + t.wingStyle * 0.15, 0.4 + t.wingStyle * 0.1),
        wingMat
      );
      wing.position.set(side * 0.55, 1.5, -0.15);
      wing.rotation.z = side * 0.3;
      g.add(wing);
    }
  }

  if (t.rarity === 'legendario' || t.rarity === 'epico') {
    const ring = new Mesh(new TorusGeometry(0.6, 0.03, 6, 16), mat(t.accentColor));
    ring.position.y = t.bodyType === 'espectral' ? 1.5 : 2.5;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }

  const pet = new Mesh(new SphereGeometry(0.14, 5, 4), am);
  pet.position.set(-0.55, 0.27, 0.2);
  g.add(pet);

  return g;
}
