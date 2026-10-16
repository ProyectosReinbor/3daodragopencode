import { describe, expect, it } from 'vitest';
import {
  createEnemyAttack,
  stepEnemyAttack,
  cancelEnemyAttack,
  ENEMY_ATTACKS,
} from './enemy-combat';
const enemy = { x: 0, y: 0, z: 1.7 },
  player = { x: 0, y: 0, z: 0 };
describe('readable enemy attacks', () => {
  it('locks the telegraph position and lets the player leave the danger zone', () => {
    const state = createEnemyAttack();
    expect(stepEnemyAttack(state, 'wolf', 1000, enemy, player).hit).toBe(false);
    expect(state.phase).toBe('windup');
    expect(stepEnemyAttack(state, 'wolf', 1699, enemy, player).hit).toBe(false);
    expect(stepEnemyAttack(state, 'wolf', 1700, enemy, { x: 4, y: 0, z: 0 }).hit).toBe(false);
    expect(state.aim).toEqual(player);
  });
  it('hits only once, respects recovery and cancels attacks when paused', () => {
    const state = createEnemyAttack();
    stepEnemyAttack(state, 'golem', 1000, enemy, player);
    expect(stepEnemyAttack(state, 'golem', 2400, enemy, player).hit).toBe(true);
    expect(stepEnemyAttack(state, 'golem', 2401, enemy, player).hit).toBe(false);
    expect(state.phase).toBe('recovery');
    stepEnemyAttack(state, 'golem', 4200, enemy, player);
    expect(state.phase).toBe('windup');
    cancelEnemyAttack(state, 4300);
    expect(state.phase).toBe('idle');
    expect(stepEnemyAttack(state, 'golem', 4500, enemy, player).hit).toBe(false);
    expect(state.phase).toBe('idle');
    expect(ENEMY_ATTACKS.golem.windup).toBeGreaterThan(ENEMY_ATTACKS.wolf.windup);
  });
  it('does not hit a player on a different floor', () => {
    const state = createEnemyAttack();
    stepEnemyAttack(state, 'wolf', 0, enemy, player);
    expect(stepEnemyAttack(state, 'wolf', 700, enemy, { ...player, y: 4 }).hit).toBe(false);
  });
});
