export const ENEMY_LEASH = 30;
export const BASIC_RANGE = 3.6;
export const POWER_RANGE = 9;
export function validAttackPosition(position, target, spawn, slot) {
  const valid = p => p && ['x','y','z'].every(key => Number.isFinite(p[key])) && Math.abs(p.x)<=20000 && Math.abs(p.z)<=20000;
  if (!valid(position) || !valid(target) || !spawn) return false;
  if (Math.abs(position.y-target.y)>1.5) return false;
  if (Math.hypot(target.x-spawn.x,target.z-spawn.z)>ENEMY_LEASH + 0.1 || Math.abs(target.y)>0.5) return false;
  return Math.hypot(position.x-target.x,position.y-target.y,position.z-target.z)<=(slot===-1?BASIC_RANGE:POWER_RANGE)+0.25;
}
