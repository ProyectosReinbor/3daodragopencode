import { describe, expect, it } from 'vitest';
import { initialWorldProgress } from '../../shared/world-items.js';
import { venueWait, venueWaitLabel, activityVisible } from './venue-activities';
describe('venue activity availability', () => {
  it('does not unlock early and handles old profiles', () => {
    const world = initialWorldProgress();
    expect(venueWait(world, 'venue-0', 1000)).toBe(0);
    world.venueGameCooldowns = { 'venue-0': 2001 };
    expect(venueWait(world, 'venue-0', 1000)).toBe(2);
    expect(venueWait(world, 'venue-0', 2000)).toBe(1);
    expect(venueWait(world, 'venue-0', 2001)).toBe(0);
    world.venueGameCooldowns['venue-0'] = NaN;
    expect(venueWait(world, 'venue-0', 2001)).toBe(0);
  });
  it('formats useful timers and filters visited places independently of rewards', () => {
    expect(venueWaitLabel(0)).toBe('Premio disponible');
    expect(venueWaitLabel(65)).toBe('Premio en 1 min 5 s');
    expect(venueWaitLabel(3660)).toBe('Premio en 1 h 1 min');
    expect(activityVisible('available', true, 0)).toBe(true);
    expect(activityVisible('available', false, 1)).toBe(false);
    expect(activityVisible('unvisited', true, 0)).toBe(false);
    expect(activityVisible('unvisited', false, 999)).toBe(true);
  });
});
