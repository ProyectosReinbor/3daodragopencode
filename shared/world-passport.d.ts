import type { WorldProgress } from './world-items.js';
export const PASSPORT_REWARD: {coins:number;xp:number};
export const PASSPORT_VENUES: typeof import('./city-life.js').CITY_VENUES;
export function canVisitVenue(id:string,position:{x:number;z:number}):boolean;
export function passportCount(world:WorldProgress):number;
export function visitVenue(world:WorldProgress,id:string,position:{x:number;z:number}):typeof PASSPORT_REWARD|null;
