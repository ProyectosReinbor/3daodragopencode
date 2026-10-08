import { describe, it, expect, beforeEach } from 'vitest';
import { CharacterManager, createStarterCharacter } from './characters';
import type { PlayerProfile } from './profile';
import { createAchievements } from './achievements';
import { mountHub, updateHubCharacter } from './hub-ui';
import { mountCharacters } from './characters-ui';
import { mountInventory } from './inventory-ui';

function makeProfile(characters: CharacterManager): PlayerProfile {
  return {
    version: 2,
    characters: characters.getCollection(),
    selectedCharacter: characters.getActive().id,
    inventory: { trigo: 5, mineral: 2, esencia: 0, madera: 1, hierba: 0 },
    crafted: {
      racion: 3,
      pocion: 1,
      unguento: 0,
      pocion_fuerza: 0,
      pocion_velocidad: 0,
      antidoto: 0,
      gran_pocion: 0,
      elixir: 0,
      espada: 0,
      escudo: 0,
      armadura: 0,
      amuleto: 0,
    },
    redeemedRewards: [],
    quest: { resources: 0, creatures: 0, completed: false },
    quests: [],
    attributePoints: 0,
    currentZone: 'aldea',
    unlockedZones: ['aldea'],
    loot: [],
    achievements: createAchievements(),
    dailyQuests: {
      date: '',
      quests: [],
      states: [],
      loginStreak: 1,
      lastLoginDate: '',
      totalClaimed: 0,
    },
  } as unknown as PlayerProfile;
}

describe('Hub UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="hub-char-name"></div>
      <div id="hub-char-level"></div>
      <div id="hub-char-rarity"></div>
      <div id="hub-char-element"></div>
      <div id="hub-char-stats"></div>
      <div id="hub-char-preview"></div>
      <div id="hub-news"></div>
      <button id="hub-characters"></button>
      <button id="hub-inventory"></button>
      <button id="hub-stores"></button>
      <button id="hub-start"></button>
      <div id="stores-message" class="hidden"></div>
    `;
  });

  it('renders character info in hub', () => {
    const starter = createStarterCharacter();
    const col = { characters: [starter], selectedId: starter.id };
    const cm = new CharacterManager(col);
    const profile = makeProfile(cm);
    mountHub(profile, cm, {
      onCharacters: () => {},
      onInventory: () => {},
      onStores: () => {},
      onStartGame: () => {},
      onRedeem: () => {},
    });
    expect(document.getElementById('hub-char-name')?.textContent).toBe(starter.name);
    expect(document.getElementById('hub-char-level')?.textContent).toBe('Nivel 1');
  });

  it('updateHubCharacter refreshes display', () => {
    const c = createStarterCharacter();
    c.name = 'Test Hero';
    updateHubCharacter(c);
    expect(document.getElementById('hub-char-name')?.textContent).toBe('Test Hero');
  });

  it('news section renders static cards', () => {
    const starter = createStarterCharacter();
    const col = { characters: [starter], selectedId: starter.id };
    const cm = new CharacterManager(col);
    const profile = makeProfile(cm);
    mountHub(profile, cm, {
      onCharacters: () => {},
      onInventory: () => {},
      onStores: () => {},
      onStartGame: () => {},
      onRedeem: () => {},
    });
    const news = document.getElementById('hub-news');
    expect(news?.children.length).toBe(3);
    expect(news?.textContent).toContain('Negocios de tu ciudad');
  });
});

describe('Characters UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="characters-list"></div>
      <button id="characters-back"></button>
    `;
  });

  it('renders character collection', () => {
    const starter = createStarterCharacter();
    const col = { characters: [starter], selectedId: starter.id };
    const cm = new CharacterManager(col);
    const profile = makeProfile(cm);
    mountCharacters(profile, cm, {
      onBack: () => {},
      onSelected: () => {},
    });
    const list = document.getElementById('characters-list');
    expect(list?.textContent).toContain(starter.name);
    expect(list?.textContent).toContain('ACTIVO');
  });

  it('shows select button for non-active characters', () => {
    const starter = createStarterCharacter();
    const c2 = { ...starter, id: 'RA-OTHER', name: 'Other' };
    const col = { characters: [starter, c2], selectedId: starter.id };
    const cm = new CharacterManager(col);
    const profile = makeProfile(cm);
    mountCharacters(profile, cm, {
      onBack: () => {},
      onSelected: () => {},
    });
    const list = document.getElementById('characters-list');
    expect(list?.innerHTML).toContain('Seleccionar');
  });
});

describe('Inventory UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="inventory-categories"></div>
      <button id="inventory-back"></button>
    `;
  });

  it('renders inventory categories', () => {
    const starter = createStarterCharacter();
    const col = { characters: [starter], selectedId: starter.id };
    const cm = new CharacterManager(col);
    const profile = makeProfile(cm);
    mountInventory(profile, { onBack: () => {} });
    const container = document.getElementById('inventory-categories');
    expect(container?.textContent).toContain('Armas');
    expect(container?.textContent).toContain('Armaduras');
    expect(container?.textContent).toContain('Consumibles');
    expect(container?.textContent).toContain('Materiales');
    expect(container?.textContent).toContain('Próximamente');
  });

  it('shows materials with counts', () => {
    const starter = createStarterCharacter();
    const col = { characters: [starter], selectedId: starter.id };
    const cm = new CharacterManager(col);
    const profile = makeProfile(cm);
    mountInventory(profile, { onBack: () => {} });
    const container = document.getElementById('inventory-categories');
    expect(container?.textContent).toContain('Trigo');
    expect(container?.textContent).toContain('5');
    expect(container?.textContent).toContain('Mineral');
    expect(container?.textContent).toContain('2');
  });

  it('shows consumables with counts', () => {
    const starter = createStarterCharacter();
    const col = { characters: [starter], selectedId: starter.id };
    const cm = new CharacterManager(col);
    const profile = makeProfile(cm);
    mountInventory(profile, { onBack: () => {} });
    const container = document.getElementById('inventory-categories');
    expect(container?.textContent).toContain('Ración');
    expect(container?.textContent).toContain('3');
  });
});
