export interface MovementPoint {
  x: number;
  z: number;
}
export interface MovementBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
/** Small swept steps prevent dash tunnelling; each blocked step can slide along a wall. */
export function moveWithCollisions(
  start: MovementPoint,
  delta: MovementPoint,
  bounds: MovementBounds,
  blocked: (x: number, z: number) => boolean
): MovementPoint {
  let x = start.x,
    z = start.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / 0.2));
  for (let i = 0; i < steps; i++) {
    let nx = Math.max(bounds.minX, Math.min(bounds.maxX, x + delta.x / steps));
    let nz = Math.max(bounds.minZ, Math.min(bounds.maxZ, z + delta.z / steps));
    if (blocked(nx, nz) && !blocked(x, z)) {
      if (!blocked(nx, z)) nz = z;
      else if (!blocked(x, nz)) nx = x;
      else {
        nx = x;
        nz = z;
      }
    }
    x = nx;
    z = nz;
  }
  return { x, z };
}
