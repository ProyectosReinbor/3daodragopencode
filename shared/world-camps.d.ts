import type { WorldProgress } from './world-items.js';
export interface WorldCamp {id:string; name:string; x:number; z:number}
export const WORLD_CAMPS: WorldCamp[];
export function activeCamp(world:WorldProgress):WorldCamp|null;
export function activateCamp(world:WorldProgress,id:string,position:{x:number;z:number}):WorldCamp;
