import { describe, it, expect } from 'vitest';
import { Box3 } from 'three';
import {
  buildNftModel,
  mulberry32,
  phoneHash,
  generateNftFromPhone,
  totalStats,
  xpForLevel,
  rarityLabel,
  rarityColor,
  elementLabel,
  elementColor,
  statLabel,
  statIcon,
} from './nft';

describe('mulberry32', () => {
  it('returns deterministic sequence from same seed', () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('returns values between 0 and 1', () => {
    const rng = mulberry32(99999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = mulberry32(111);
    const rng2 = mulberry32(222);
    const vals1 = Array.from({ length: 10 }, () => rng1());
    const vals2 = Array.from({ length: 10 }, () => rng2());
    expect(vals1).not.toEqual(vals2);
  });
});

describe('phoneHash', () => {
  it('returns a positive 32-bit unsigned integer', () => {
    const h = phoneHash('1234567890');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it('is deterministic', () => {
    expect(phoneHash('1234567890')).toBe(phoneHash('1234567890'));
  });

  it('produces different hashes for different inputs', () => {
    expect(phoneHash('1234567890')).not.toBe(phoneHash('0987654321'));
  });
});

describe('generateNftFromPhone', () => {
  it('generates deterministic NFT from phone', () => {
    const nft1 = generateNftFromPhone('1234567890');
    const nft2 = generateNftFromPhone('1234567890');
    expect(nft1.id).toBe(nft2.id);
    expect(nft1.name).toBe(nft2.name);
    expect(nft1.traits.element).toBe(nft2.traits.element);
    expect(nft1.traits.rarity).toBe(nft2.traits.rarity);
  });

  it('sets phoneId correctly', () => {
    const nft = generateNftFromPhone('5551234567');
    expect(nft.phoneId).toBe('5551234567');
  });

  it('starts at level 1 with 0 xp', () => {
    const nft = generateNftFromPhone('1234567890');
    expect(nft.level).toBe(1);
    expect(nft.xp).toBe(0);
  });

  it('has valid element', () => {
    const nft = generateNftFromPhone('1234567890');
    expect(['fuego', 'agua', 'tierra', 'aire', 'sombra', 'luz']).toContain(nft.traits.element);
  });

  it('has valid rarity', () => {
    const nft = generateNftFromPhone('1234567890');
    expect(['comun', 'raro', 'epico', 'legendario']).toContain(nft.traits.rarity);
  });

  it('has valid bodyType', () => {
    const nft = generateNftFromPhone('1234567890');
    expect(['humanoid', 'bestia', 'espectral', 'golem']).toContain(nft.traits.bodyType);
  });

  it('has positive base stats', () => {
    const nft = generateNftFromPhone('1234567890');
    expect(nft.baseStats.atk).toBeGreaterThan(0);
    expect(nft.baseStats.def).toBeGreaterThan(0);
    expect(nft.baseStats.spd).toBeGreaterThan(0);
    expect(nft.baseStats.hp).toBeGreaterThan(0);
    expect(nft.baseStats.ability).toBeGreaterThan(0);
  });

  it('generates different NFTs for different phones', () => {
    const nft1 = generateNftFromPhone('1111111111');
    const nft2 = generateNftFromPhone('2222222222');
    const sameId = nft1.id === nft2.id;
    const sameName = nft1.name === nft2.name;
    const sameElement = nft1.traits.element === nft2.traits.element;
    expect(sameId && sameName && sameElement).toBe(false);
  });
});

describe('totalStats', () => {
  it('adds level bonuses to base stats', () => {
    const nft = generateNftFromPhone('1234567890');
    nft.level = 5;
    const stats = totalStats(nft);
    expect(stats.atk).toBe(nft.baseStats.atk + 4);
    expect(stats.def).toBe(nft.baseStats.def + 4);
    expect(stats.spd).toBe(nft.baseStats.spd + 4);
    expect(stats.hp).toBe(nft.baseStats.hp + 4);
    expect(stats.ability).toBe(nft.baseStats.ability + 4);
  });

  it('includes upgrades', () => {
    const nft = generateNftFromPhone('1234567890');
    nft.upgrades = [
      { source: 'game', label: 'test', stat: 'atk', amount: 5, timestamp: Date.now() },
    ];
    const stats = totalStats(nft);
    expect(stats.atk).toBe(nft.baseStats.atk + 5);
  });
});

describe('xpForLevel', () => {
  it('returns increasing values', () => {
    const xp1 = xpForLevel(1);
    const xp2 = xpForLevel(5);
    const xp3 = xpForLevel(10);
    expect(xp2).toBeGreaterThan(xp1);
    expect(xp3).toBeGreaterThan(xp2);
  });

  it('calculates correctly for level 1', () => {
    expect(xpForLevel(1)).toBe(27);
  });
});

describe('label and color helpers', () => {
  it('rarityLabel returns correct labels', () => {
    expect(rarityLabel('comun')).toBe('Comun');
    expect(rarityLabel('raro')).toBe('Raro');
    expect(rarityLabel('epico')).toBe('Epico');
    expect(rarityLabel('legendario')).toBe('Legendario');
  });

  it('rarityColor returns hex strings', () => {
    expect(rarityColor('comun')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('elementLabel returns Spanish labels', () => {
    expect(elementLabel('fuego')).toBe('Fuego');
    expect(elementLabel('agua')).toBe('Agua');
  });

  it('elementColor returns hex strings', () => {
    expect(elementColor('fuego')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('statLabel returns Spanish labels', () => {
    expect(statLabel('atk')).toBe('Ataque');
    expect(statLabel('def')).toBe('Defensa');
  });

  it('statIcon returns emoji icons', () => {
    expect(statIcon('atk')).toBe('⚔');
    expect(statIcon('def')).toBe('🛡');
  });
});


describe('custom Pet anatomy', () => {
  it('renders the chosen limb count on every body and reflects limb length', () => {
    const pet = generateNftFromPhone('55512345');
    for (const bodyType of ['bestia', 'golem', 'humanoid', 'espectral'] as const) {
      for (const limbCount of [0, 2, 4, 6, 8]) {
        const model = buildNftModel({ ...pet, traits: { ...pet.traits, rarity: 'comun', bodyType, headShape: 'diamond', limbCount, limbLength: 0.5 } });
        expect(model.children.filter(child => child.name === 'custom-limb')).toHaveLength(limbCount);
      }
    }
    const short = buildNftModel({ ...pet, traits: { ...pet.traits, rarity: 'comun', headShape: 'round', limbCount: 4, limbLength: 0.5 } });
    const long = buildNftModel({ ...pet, traits: { ...pet.traits, rarity: 'comun', headShape: 'round', limbCount: 4, limbLength: 1.8 } });
    expect(new Box3().setFromObject(long).max.y).toBeGreaterThan(new Box3().setFromObject(short).max.y);
  });
});
