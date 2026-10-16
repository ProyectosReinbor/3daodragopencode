import { describe, expect, it } from 'vitest';
import {
  adventureObjective,
  startAdventure,
  advanceAdventure,
  ADVENTURE_GUIDE,
} from './world-adventure.js';
import { initialWorldProgress } from './world-items.js';
import { craftWorldItem } from './world-crafting.js';

describe('first adventure state machine', () => {
  it('requires ordered real progress and returns a reward only once', () => {
    const world = initialWorldProgress();
    expect(() => startAdventure(world, { x: 999, z: 999 })).toThrow('Acércate');
    expect(world.adventure).toBeUndefined();
    startAdventure(world, ADVENTURE_GUIDE);
    expect(() => startAdventure(world, ADVENTURE_GUIDE)).toThrow('ya comenzó');
    expect(() => advanceAdventure(world, 'pet', 0, ADVENTURE_GUIDE)).toThrow('objetivo');
    world.gathered = 6;
    expect(() => advanceAdventure(world, 'pet', 1, ADVENTURE_GUIDE)).toThrow('paso');
    advanceAdventure(world, 'pet', 0, ADVENTURE_GUIDE);
    world.kills = 99;
    expect(adventureObjective(world, 'pet').ready).toBe(false);
    world.parkKills = 3;
    advanceAdventure(world, 'pet', 1, ADVENTURE_GUIDE);
    expect(() => advanceAdventure(world, 'pet', 2, ADVENTURE_GUIDE)).toThrow('objetivo');
    world.materials = { mineral: 4, madera: 2 };
    craftWorldItem(world, 'hoja');
    advanceAdventure(world, 'pet', 2, ADVENTURE_GUIDE);
    world.equipped.other = { weapon: 'explorer_blade' };
    expect(adventureObjective(world, 'pet').ready).toBe(false);
    world.equipped.pet = { weapon: 'explorer_blade' };
    advanceAdventure(world, 'pet', 3, ADVENTURE_GUIDE);
    expect(() => advanceAdventure(world, 'pet', 4, { x: 999, z: 999 })).toThrow('Acércate');
    expect(world.adventure?.completed).toBe(false);
    const reward = advanceAdventure(world, 'pet', 4, ADVENTURE_GUIDE);
    expect(reward).toEqual({ coins: 75, xp: 100, potions: 2, mana: 2 });
    expect(adventureObjective(world, 'pet').stage).toBe(5);
    expect(() => advanceAdventure(world, 'pet', 4, ADVENTURE_GUIDE)).toThrow('paso');
  });
  it('resumes from persisted baselines and accepts an existing crafted weapon', () => {
    const world = initialWorldProgress();
    world.gathered = 100;
    world.parkKills = 20;
    world.items.push('explorer_blade');
    startAdventure(world, ADVENTURE_GUIDE);
    const resumed = JSON.parse(JSON.stringify(world));
    expect(adventureObjective(resumed, 'pet').current).toBe(0);
    resumed.gathered = 106;
    advanceAdventure(resumed, 'pet', 0, ADVENTURE_GUIDE);
    expect(adventureObjective(resumed, 'pet').current).toBe(0);
    resumed.parkKills = 23;
    advanceAdventure(resumed, 'pet', 1, ADVENTURE_GUIDE);
    expect(adventureObjective(resumed, 'pet').ready).toBe(true);
  });
});
