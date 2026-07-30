import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProfile, currentQuestDef, advanceQuest, QUESTS, TRADES } from './profile';
import { generateCharacterFromPhone } from './characters';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal('localStorage', localStorageMock);
});

describe('createProfile', () => {
  it('creates profile with default values', () => {
    const character = generateCharacterFromPhone('1234567890');
    const profile = createProfile(character);

    expect(profile.characters).toBeDefined();
    expect(profile.characters!.characters.length).toBe(1);
    expect(profile.characters!.characters[0].id).toBe(character.id);
    expect(profile.characters!.selectedId).toBe(character.id);
    expect(profile.inventory).toEqual({
      trigo: 0,
      mineral: 0,
      esencia: 0,
      madera: 0,
      hierba: 0,
    });
    expect(profile.crafted).toEqual({
      racion: 0,
      espada: 0,
      pocion: 0,
      escudo: 0,
      unguento: 0,
      armadura: 0,
      amuleto: 0,
      pocion_fuerza: 0,
      pocion_velocidad: 0,
      antidoto: 0,
      gran_pocion: 0,
      elixir: 0,
    });
    expect(profile.redeemedRewards).toEqual([]);
    expect(profile.quest).toEqual({ resources: 0, creatures: 0, completed: false });
    expect(profile.attributePoints).toBe(0);
    expect(profile.currentZone).toBe('aldea');
    expect(profile.unlockedZones).toEqual(['aldea']);
    expect(profile.loot).toEqual([]);
  });

  it('creates profile with initial quests', () => {
    const character = generateCharacterFromPhone('1234567890');
    const profile = createProfile(character);

    expect(profile.quests.length).toBeGreaterThan(0);
    expect(profile.quests[0].id).toBe('bosque_lobo');
    expect(profile.quests[0].completed).toBe(false);
  });
});

describe('currentQuestDef', () => {
  it('returns first quest for new profile', () => {
    const character = generateCharacterFromPhone('1234567890');
    const profile = createProfile(character);
    const quest = currentQuestDef(profile);

    expect(quest).toBeDefined();
    expect(quest?.id).toBe('bosque_lobo');
  });

  it('returns first quest when all quests completed', () => {
    const character = generateCharacterFromPhone('1234567890');
    const profile = createProfile(character);
    profile.quests.forEach((q) => {
      q.completed = true;
    });

    const quest = currentQuestDef(profile);
    expect(quest).toBeDefined();
    expect(quest?.id).toBe('bosque_lobo');
  });
});

describe('advanceQuest', () => {
  it('marks current quest as completed', () => {
    const character = generateCharacterFromPhone('1234567890');
    const profile = createProfile(character);

    advanceQuest(profile);
    expect(profile.quests[0].completed).toBe(true);
  });

  it('adds next quest to list', () => {
    const character = generateCharacterFromPhone('1234567890');
    const profile = createProfile(character);

    const next = advanceQuest(profile);
    expect(next).toBeDefined();
    expect(profile.quests.length).toBe(6);
  });

  it('returns undefined when no more quests', () => {
    const character = generateCharacterFromPhone('1234567890');
    const profile = createProfile(character);
    profile.quests.forEach((q) => {
      q.completed = true;
    });

    const next = advanceQuest(profile);
    expect(next).toBeUndefined();
  });
});

describe('QUESTS', () => {
  it('has 7 quests', () => {
    expect(QUESTS.length).toBe(7);
  });

  it('each quest has required fields', () => {
    QUESTS.forEach((q) => {
      expect(q.id).toBeDefined();
      expect(q.title).toBeDefined();
      expect(q.zone).toBeDefined();
      expect(q.requiredResources).toBeGreaterThanOrEqual(0);
      expect(q.requiredCreatures).toBeGreaterThanOrEqual(0);
      expect(q.rewardExp).toBeGreaterThan(0);
    });
  });
});

describe('TRADES', () => {
  it('has trade offers', () => {
    expect(TRADES.length).toBeGreaterThan(0);
  });

  it('each trade has valid structure', () => {
    TRADES.forEach((t) => {
      expect(t.give).toBeDefined();
      expect(t.giveAmount).toBeGreaterThan(0);
      expect(t.receive).toBeDefined();
      expect(t.receiveAmount).toBeGreaterThan(0);
    });
  });
});
