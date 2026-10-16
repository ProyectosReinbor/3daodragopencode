export interface CombatPoint {
  x: number;
  y: number;
  z: number;
}
export interface EnemyAttackState {
  phase: 'idle' | 'windup' | 'recovery';
  startedAt: number;
  strikeAt: number;
  readyAt: number;
  aim: CombatPoint;
}
export const ENEMY_ATTACKS = {
  wolf: { windup: 700, recovery: 1100, radius: 1.45 },
  skeleton: { windup: 950, recovery: 1300, radius: 1.7 },
  spirit: { windup: 1100, recovery: 1450, radius: 2 },
  golem: { windup: 1400, recovery: 1800, radius: 2.5 },
};
export function createEnemyAttack(): EnemyAttackState {
  return { phase: 'idle', startedAt: 0, strikeAt: 0, readyAt: 0, aim: { x: 0, y: 0, z: 0 } };
}
export function cancelEnemyAttack(state: EnemyAttackState, now: number) {
  state.phase = 'idle';
  state.readyAt = now + 400;
}
export function stepEnemyAttack(
  state: EnemyAttackState,
  kind: keyof typeof ENEMY_ATTACKS,
  now: number,
  enemy: CombatPoint,
  player: CombatPoint
) {
  const spec = ENEMY_ATTACKS[kind];
  if (state.phase === 'windup') {
    if (now >= state.strikeAt) {
      state.phase = 'recovery';
      state.readyAt = now + spec.recovery;
      return {
        hit:
          Math.hypot(player.x - state.aim.x, player.z - state.aim.z) <= spec.radius &&
          Math.abs(player.y - state.aim.y) < 1.8,
        progress: 1,
        radius: spec.radius,
      };
    }
    return {
      hit: false,
      progress: Math.max(0, (now - state.startedAt) / spec.windup),
      radius: spec.radius,
    };
  }
  if (state.phase === 'recovery' && now >= state.readyAt) state.phase = 'idle';
  if (
    state.phase === 'idle' &&
    now >= state.readyAt &&
    Math.hypot(enemy.x - player.x, enemy.z - player.z) < 2.2 &&
    Math.abs(enemy.y - player.y) < 1.8
  ) {
    state.phase = 'windup';
    state.startedAt = now;
    state.strikeAt = now + spec.windup;
    state.aim = { x: player.x, y: player.y, z: player.z };
  }
  return { hit: false, progress: 0, radius: spec.radius };
}
