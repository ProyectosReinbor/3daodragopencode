export const VILLAVICENCIO_URBAN: {
  buildings: {
    id: string;
    kind: string;
    height: number;
    measuredHeight: boolean;
    levels: number;
    points: number[][];
  }[];
  waterways: { id: string; width: number; points: number[][] }[];
  signals: { id: string; lat: number; lng: number }[];
};
