import { CITY_WORLD } from './city-world.js';
const roadside = (id, name, landmarkId) => {
  const landmark = CITY_WORLD.landmarks.find((place) => place.id === landmarkId);
  if (!landmark) return null;
  let best = null, distance = Infinity;
  for (const road of CITY_WORLD.roads) {
    if (!['primary', 'secondary', 'tertiary', 'trunk', 'residential'].includes(road.highway)) continue;
    for (const [x,z] of road.points) {
      const d = Math.hypot(x-landmark.x,z-landmark.z);
      if (d < distance) { best = {id,name,x,z}; distance = d; }
    }
  }
  return best;
};
// Fictional return beacons on mapped streets, not entrances to real establishments.
export const WORLD_CAMPS = [
  {id:'camp-central',name:'Baliza del Parque Central',x:10,z:10},
  roadside('camp-viva','Baliza del sector Viva','viva'),
  roadside('camp-primavera','Baliza del sector Primavera','primavera'),
  roadside('camp-unillanos','Baliza del sector Unillanos','unillanos'),
].filter(Boolean);
export function activeCamp(world) {
  return WORLD_CAMPS.find((camp) => camp.id === world.campId) || null;
}
export function activateCamp(world, id, position) {
  const camp = WORLD_CAMPS.find((value) => value.id === id);
  if (!camp || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z) || Math.hypot(position.x-camp.x,position.z-camp.z)>6)
    throw Error('Acércate a la baliza para activar este punto de regreso.');
  world.campId = camp.id;
  return camp;
}
