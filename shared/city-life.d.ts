export interface UrbanBuilding {
  generated?: boolean;
  id: string;
  kind: string;
  height: number;
  measuredHeight: boolean;
  levels: number;
  points: number[][];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  x: number;
  z: number;
  entrance: { x: number; z: number };
}
export const CITY_BUILDINGS: UrbanBuilding[];
export const CITY_VENUES: {
  id: string;
  buildingId: string;
  name: string;
  kind: string;
  floors: number;
  x: number;
  z: number;
  npcName: string;
  quest: string;
}[];
export const CITY_PARKS: { id: string; name: string; points: number[][]; x: number; z: number }[];
export const CITY_CITIZENS: { id: string; name: string; x: number; z: number; quest: string }[];
export function buildingFloors(b: UrbanBuilding): number;
export function buildingHeight(b: UrbanBuilding): number;
