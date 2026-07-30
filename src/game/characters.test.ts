import { describe, it, expect } from 'vitest';
import {
  CharacterManager,
  createStarterCharacter,
  generateCharacterFromPhone,
  createEmptyCollection,
  ensureStarterCharacter,
  totalStats,
} from './characters';

describe('createStarterCharacter', () => {
  it('creates a random slime with correct properties', () => {
    const c = createStarterCharacter();
    expect(c.name).toMatch(/^Slime /);
    expect(c.isStarter).toBe(true);
    expect(c.source).toBe('starter');
    expect(c.level).toBe(1);
    expect(c.xp).toBe(0);
    expect(c.traits.bodyType).toBe('golem');
    expect(c.traits.rarity).toBe('comun');
    expect(c.baseStats.atk).toBeGreaterThanOrEqual(2);
    expect(c.baseStats.def).toBeGreaterThanOrEqual(2);
    expect(c.baseStats.spd).toBeGreaterThanOrEqual(2);
    expect(c.baseStats.hp).toBeGreaterThanOrEqual(2);
    expect(c.baseStats.ability).toBeGreaterThanOrEqual(2);
    expect(
      c.baseStats.atk + c.baseStats.def + c.baseStats.spd + c.baseStats.hp + c.baseStats.ability
    ).toBe(28);
  });

  it('Slime has random element and comun rarity', () => {
    const c = createStarterCharacter();
    expect(['fuego', 'agua', 'tierra', 'aire', 'sombra', 'luz']).toContain(c.traits.element);
    expect(c.traits.rarity).toBe('comun');
    expect(c.traits.bodyType).toBe('golem');
  });
});

describe('generateCharacterFromPhone', () => {
  it('generates deterministic character from phone', () => {
    const c1 = generateCharacterFromPhone('1234567890');
    const c2 = generateCharacterFromPhone('1234567890');
    expect(c1.id).toBe(c2.id);
    expect(c1.name).toBe(c2.name);
    expect(c1.traits.element).toBe(c2.traits.element);
    expect(c1.traits.rarity).toBe(c2.traits.rarity);
  });

  it('starts at level 1 with 0 xp', () => {
    const c = generateCharacterFromPhone('1234567890');
    expect(c.level).toBe(1);
    expect(c.xp).toBe(0);
  });

  it('has valid element', () => {
    const c = generateCharacterFromPhone('1234567890');
    expect(['fuego', 'agua', 'tierra', 'aire', 'sombra', 'luz']).toContain(c.traits.element);
  });

  it('has valid rarity', () => {
    const c = generateCharacterFromPhone('1234567890');
    expect(['comun', 'raro', 'epico', 'legendario']).toContain(c.traits.rarity);
  });

  it('has positive base stats', () => {
    const c = generateCharacterFromPhone('1234567890');
    expect(c.baseStats.atk).toBeGreaterThan(0);
    expect(c.baseStats.def).toBeGreaterThan(0);
    expect(c.baseStats.spd).toBeGreaterThan(0);
    expect(c.baseStats.hp).toBeGreaterThan(0);
    expect(c.baseStats.ability).toBeGreaterThan(0);
  });

  it('generates different characters for different phones', () => {
    const c1 = generateCharacterFromPhone('1111111111');
    const c2 = generateCharacterFromPhone('2222222222');
    const sameId = c1.id === c2.id;
    const sameName = c1.name === c2.name;
    const sameElement = c1.traits.element === c2.traits.element;
    expect(sameId && sameName && sameElement).toBe(false);
  });

  it('is not a starter character', () => {
    const c = generateCharacterFromPhone('1234567890');
    expect(c.isStarter).toBe(false);
    expect(c.source).toBe('generated');
  });
});

describe('createEmptyCollection', () => {
  it('creates empty collection', () => {
    const col = createEmptyCollection();
    expect(col.characters).toEqual([]);
    expect(col.selectedId).toBe('');
  });
});

describe('ensureStarterCharacter', () => {
  it('adds starter character when collection is empty', () => {
    const col = createEmptyCollection();
    const result = ensureStarterCharacter(col);
    expect(result.characters.length).toBe(1);
    expect(result.characters[0].isStarter).toBe(true);
    expect(result.characters[0].traits.bodyType).toBe('golem');
    expect(result.selectedId).toBe(result.characters[0].id);
  });

  it('does not add starter when collection has characters', () => {
    const col = createEmptyCollection();
    const c = generateCharacterFromPhone('1234567890');
    col.characters.push(c);
    col.selectedId = c.id;
    const result = ensureStarterCharacter(col);
    expect(result.characters.length).toBe(1);
    expect(result.characters[0].isStarter).toBe(false);
  });
});

describe('CharacterManager', () => {
  it('getActive returns starter when collection is empty', () => {
    const col = createEmptyCollection();
    const manager = new CharacterManager(col);
    const active = manager.getActive();
    expect(active.isStarter).toBe(true);
    expect(active.traits.bodyType).toBe('golem');
    expect(col.characters.length).toBe(1);
  });

  it('getActive returns selected character', () => {
    const c = generateCharacterFromPhone('1234567890');
    const col = createEmptyCollection();
    col.characters.push(c);
    col.selectedId = c.id;
    const manager = new CharacterManager(col);
    expect(manager.getActive().id).toBe(c.id);
  });

  it('getAll returns all characters', () => {
    const c1 = generateCharacterFromPhone('1111111111');
    const c2 = generateCharacterFromPhone('2222222222');
    const col = createEmptyCollection();
    col.characters.push(c1, c2);
    col.selectedId = c1.id;
    const manager = new CharacterManager(col);
    expect(manager.getAll()).toHaveLength(2);
  });

  it('getById finds character by id', () => {
    const c = generateCharacterFromPhone('1234567890');
    const col = createEmptyCollection();
    col.characters.push(c);
    col.selectedId = c.id;
    const manager = new CharacterManager(col);
    expect(manager.getById(c.id)).toBeDefined();
    expect(manager.getById('nonexistent')).toBeUndefined();
  });

  it('selectCharacter changes active character', () => {
    const c1 = generateCharacterFromPhone('1111111111');
    const c2 = generateCharacterFromPhone('2222222222');
    const col = createEmptyCollection();
    col.characters.push(c1, c2);
    col.selectedId = c1.id;
    const manager = new CharacterManager(col);
    expect(manager.selectCharacter(c2.id)).toBe(true);
    expect(manager.getActive().id).toBe(c2.id);
  });

  it('selectCharacter returns false for non-existent id', () => {
    const col = createEmptyCollection();
    const manager = new CharacterManager(col);
    expect(manager.selectCharacter('nonexistent')).toBe(false);
  });

  it('addCharacter adds to collection', () => {
    const col = createEmptyCollection();
    const manager = new CharacterManager(col);
    const c = generateCharacterFromPhone('1234567890');
    manager.addCharacter(c);
    expect(manager.count()).toBe(1);
  });

  it('unlockCharacter does not duplicate', () => {
    const col = createEmptyCollection();
    const manager = new CharacterManager(col);
    const c = generateCharacterFromPhone('1234567890');
    manager.addCharacter(c);
    manager.unlockCharacter(c);
    expect(manager.count()).toBe(1);
  });

  it('hasCharacter checks existence', () => {
    const c = generateCharacterFromPhone('1234567890');
    const col = createEmptyCollection();
    col.characters.push(c);
    col.selectedId = c.id;
    const manager = new CharacterManager(col);
    expect(manager.hasCharacter(c.id)).toBe(true);
    expect(manager.hasCharacter('fake')).toBe(false);
  });

  it('addExperience adds xp to active character', () => {
    const c = generateCharacterFromPhone('1234567890');
    const col = createEmptyCollection();
    col.characters.push(c);
    col.selectedId = c.id;
    const manager = new CharacterManager(col);
    manager.addExperience(50);
    expect(manager.getActive().xp).toBe(50);
  });

  it('count returns number of characters', () => {
    const col = createEmptyCollection();
    const manager = new CharacterManager(col);
    expect(manager.count()).toBe(0);
    manager.addCharacter(generateCharacterFromPhone('1111111111'));
    expect(manager.count()).toBe(1);
  });
});

describe('totalStats', () => {
  it('returns correct stats for starter', () => {
    const c = createStarterCharacter();
    const stats = totalStats(c);
    expect(stats.atk).toBe(c.baseStats.atk);
    expect(stats.def).toBe(c.baseStats.def);
    expect(stats.spd).toBe(c.baseStats.spd);
    expect(stats.hp).toBe(c.baseStats.hp);
    expect(stats.ability).toBe(c.baseStats.ability);
  });

  it('includes level bonuses', () => {
    const c = createStarterCharacter();
    const baseAtk = c.baseStats.atk;
    c.level = 5;
    const stats = totalStats(c);
    expect(stats.atk).toBe(baseAtk + 4); // base + (level-1)
    expect(stats.def).toBe(c.baseStats.def + 4);
  });
});
