import { VILLAVICENCIO_OSM } from './villavicencio-osm.js';
const metresPerDegree = (Math.PI * 6371008.8) / 180;
export function geographicWorldPosition(lat, lng) {
  return {
    x:
      (lng - VILLAVICENCIO_OSM.origin.lng) *
      metresPerDegree *
      Math.cos((VILLAVICENCIO_OSM.origin.lat * Math.PI) / 180),
    z: (VILLAVICENCIO_OSM.origin.lat - lat) * metresPerDegree,
  };
}
