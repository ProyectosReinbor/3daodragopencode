import { describe, expect, it } from 'vitest';
import { initialWorldProgress } from '../../shared/world-items.js';
import { nearestQuestPlace, questStatus } from './quest-journal';

describe('quest journal', () => {
  it('distinguishes eligible quests from accepted, ready and claimed rewards', () => {
    const world = initialWorldProgress();
    world.gathered = 6;
    expect(questStatus(world, 'supplies')).toBe('available');
    world.acceptedQuests = ['supplies', 'patrol'];
    expect(questStatus(world, 'supplies')).toBe('ready');
    expect(questStatus(world, 'patrol')).toBe('active');
    world.claimedQuests = ['supplies'];
    expect(questStatus(world, 'supplies')).toBe('completed');
  });
  it('chooses the nearest appropriate objective without changing source order', () => {
    const nodes = [
      { id: 'far', name: 'Lejos', x: 80, z: 0 },
      { id: 'near', name: 'Cerca', x: 3, z: 4 },
    ];
    const parks = [{ id: 'park', name: 'Parque', x: 20, z: 0 }];
    const forge = { id: 'camp-forge', name: 'Forja', x: 2, z: 0 };
    const at = { x: 0, z: 0 };
    expect(nearestQuestPlace('gathered', at, nodes, parks, forge)?.id).toBe('near');
    expect(nodes[0].id).toBe('far');
    expect(nearestQuestPlace('parkKills', at, nodes, parks, forge)?.id).toBe('park');
    expect(nearestQuestPlace('kills', at, nodes, parks, forge)?.id).toBe('park');
    expect(nearestQuestPlace('crafted', at, nodes, parks, forge)?.id).toBe('camp-forge');
    expect(nearestQuestPlace('unknown', at, nodes, parks, forge)).toBeNull();
    expect(nearestQuestPlace('gathered', at, [], parks, forge)).toBeNull();
  });
});
