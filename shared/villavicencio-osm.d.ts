export const VILLAVICENCIO_OSM: {
  source: string;
  attribution: string;
  license: string;
  sourceUrl: string;
  importedAt: string;
  bounds: { south: number; west: number; north: number; east: number };
  origin: { lat: number; lng: number };
  roads: {
    id: string;
    name: string;
    highway: string;
    bridge: boolean;
    layer: number;
    points: number[][];
  }[];
  places: { id: string; name: string; type: string; lat: number; lng: number }[];
};
