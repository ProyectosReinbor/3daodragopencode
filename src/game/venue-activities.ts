import type { WorldProgress } from '../../shared/world-items.js';
export function venueWait(world: WorldProgress, id: string, now: number): number {
  const until = world.venueGameCooldowns?.[id];
  return typeof until === 'number' && Number.isFinite(until)
    ? Math.max(0, Math.ceil((until - now) / 1000))
    : 0;
}
export function venueWaitLabel(seconds: number): string {
  if (seconds <= 0) return 'Premio disponible';
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    rest = seconds % 60;
  return 'Premio en ' + (hours ? `${hours} h ${minutes} min` : `${minutes} min ${rest} s`);
}
export function activityVisible(filter: string, visited: boolean, wait: number): boolean {
  return filter === 'available' ? wait === 0 : filter === 'unvisited' ? !visited : true;
}
