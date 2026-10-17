import { CITY_VENUES, CITY_BUILDINGS } from './city-life.js';
export const PASSPORT_REWARD = { coins:50, xp:75 };
export const PASSPORT_VENUES = CITY_VENUES;
export function canVisitVenue(id, position) {
  const venue = PASSPORT_VENUES.find((value)=>value.id===id);
  if (!venue || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  const building = CITY_BUILDINGS.find((value)=>value.id===venue.buildingId);
  return Math.hypot(position.x-venue.x,position.z-venue.z)<=8 || !!building && Math.hypot(position.x-building.x,position.z-building.z)<=8;
}
export function passportCount(world) {
  return PASSPORT_VENUES.filter((venue)=>world.visitedVenues?.includes(venue.id)).length;
}
export function visitVenue(world,id,position) {
  if (!canVisitVenue(id,position)) throw Error('Acércate a la entrada o entra al local para registrar la visita.');
  world.visitedVenues ||= [];
  if (!world.visitedVenues.includes(id)) world.visitedVenues.push(id);
  if (passportCount(world)===PASSPORT_VENUES.length && !world.passportRewarded) {
    world.passportRewarded=true;
    return {...PASSPORT_REWARD};
  }
  return null;
}
