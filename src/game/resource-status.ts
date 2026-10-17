import type { CityPoint, CityResource } from '../../shared/city-world.js';
export function resourceWait(id: string, cooldowns: Record<string, number>, now: number): number {
  const until = cooldowns[id];
  return Number.isFinite(until) ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}
export function nearbyResource(
  position: CityPoint,
  nodes: CityResource[],
  radius: number
): CityResource | null {
  return nodes.reduce<CityResource | null>((best, node) => {
    const distance = Math.hypot(node.x - position.x, node.z - position.z);
    return distance < radius &&
      (!best || distance < Math.hypot(best.x - position.x, best.z - position.z))
      ? node
      : best;
  }, null);
}
