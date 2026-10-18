export interface CombatTarget {
  alive: boolean;
  mesh: { visible: boolean; position: { x: number; y: number; z: number } };
}
export function nearbyCombatTargets<T extends CombatTarget>(
  targets: T[],
  player: { x: number; y: number; z: number },
  range: number,
  blocked?: (x: number, z: number) => boolean
): T[] {
  const distance = (target: T) =>
    Math.hypot(
      target.mesh.position.x - player.x,
      target.mesh.position.y - player.y,
      target.mesh.position.z - player.z
    );
  return targets
    .filter((target) => {
      if (
        !target.alive ||
        !target.mesh.visible ||
        Math.abs(target.mesh.position.y - player.y) >= 1.8 ||
        distance(target) >= range
      )
        return false;
      if (blocked) {
        const end = target.mesh.position,
          steps = Math.ceil(Math.hypot(end.x - player.x, end.z - player.z) / 0.5);
        for (let i = 1; i < steps; i++)
          if (
            blocked(
              player.x + ((end.x - player.x) * i) / steps,
              player.z + ((end.z - player.z) * i) / steps
            )
          )
            return false;
      }
      return true;
    })
    .sort((a, b) => distance(a) - distance(b));
}
export function nextCombatTarget<T>(targets: T[], selected: T | undefined): T | undefined {
  if (!targets.length) return undefined;
  return targets[(targets.indexOf(selected as T) + 1) % targets.length];
}
