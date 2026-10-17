import { describe, it, expect } from 'vitest';
import { rewardEntry, appendReward } from './reward-journal';
describe('session rewards', () => {
  it('formats actual rewards and level increases without inventing drops', () => {
    const entry = rewardEntry(
      'attack',
      { coins: 12, xp: 15, potions: 0, mana: 1, item: 'fang', material: 'madera', amount: 1 },
      1,
      2
    )!;
    expect(entry.lines).toEqual([
      '+12 monedas',
      '+15 XP',
      '+1 elixires de maná',
      'Colmillo del lobo',
      '+1 Madera',
    ]);
    expect(entry.level).toBe(2);
    expect(rewardEntry('craft', { item: 'fang', alreadyCrafted: true }, 2, 2)).toBeNull();
  });
  it('ignores empty, invalid and non-reward actions', () => {
    expect(
      rewardEntry(
        'attack',
        { coins: NaN, xp: -1, item: 'constructor', material: 'fake', amount: 2 },
        2,
        2
      )
    ).toBeNull();
    expect(rewardEntry('buy', { item: 'fang' }, 1, 2)).toBeNull();
    expect(rewardEntry('attack', null, 1, 1)).toBeNull();
  });
  it('keeps the newest twenty entries without mutating the previous list', () => {
    const old = Array.from({ length: 20 }, (_, i) => ({
      source: String(i),
      lines: [],
      level: null,
    }));
    const next = appendReward(old, { source: 'new', lines: ['+1 XP'], level: null });
    expect(next).toHaveLength(20);
    expect(next[0].source).toBe('new');
    expect(next[19].source).toBe('18');
    expect(old[0].source).toBe('0');
  });
});
