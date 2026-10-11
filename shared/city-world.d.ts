export interface CityPoint {
  x: number;
  z: number;
}
export interface CityBiome extends CityPoint {
  id: string;
  name: string;
  radius: number;
  color: number;
  zone: 'bosque' | 'desierto' | 'ruinas' | 'cueva';
}
export interface CityResource extends CityPoint {
  id: string;
  name: string;
  material: string;
  amount: number;
  pickup?: boolean;
}
export const CITY_ENCOUNTERS: (CityPoint & { id: string; kind: string })[];
export const CITY_WORLD: {
  name: string;
  size: number;
  origin: { lat: number; lng: number };
  cartography: string;
  attribution: string;
  sourceUrl: string;
  importedAt: string;
  geographicBounds: { south: number; west: number; north: number; east: number };
  landmarks: (CityPoint & {
    id: string;
    osmId: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
  })[];
  roads: { id: string; name: string; highway: string; width: number; points: number[][] }[];
  biomes: CityBiome[];
  nodes: CityResource[];
  forge: CityPoint;
  spawn: CityPoint;
};
export function biomeAt(x: number, z: number): CityBiome;
export function geographicWorldPosition(lat: number, lng: number): CityPoint;
export function businessWorldPosition(store: {
  city_id?: string | null;
  lat: number | null;
  lng: number | null;
}): CityPoint | null;
