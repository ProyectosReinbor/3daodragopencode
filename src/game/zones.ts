import type { ZoneId, TradeOffer } from './profile';
import type { World } from './world';
import type { Group } from 'three';
import type { ActiveBoss } from './bosses';

export interface ZonePortal {
  position: { x: number; z: number };
  targetZone: ZoneId;
  label: string;
}
export interface Npc {
  mesh: Group;
  name: string;
  dialogue: string;
  tradeOffers?: TradeOffer[];
}
export interface CraftingStation {
  mesh: Group;
  name: string;
  recipe: string;
}
export interface ZoneWorld extends World {
  boss: ActiveBoss | null;
  npcs: Npc[];
  stations: CraftingStation[];
  portals: ZonePortal[];
  groundColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  groundSize: number;
}

export function zoneConfig(zone: ZoneId) {
  const configs: Record<
    ZoneId,
    {
      groundColor: number;
      fogColor: number;
      fogNear: number;
      fogFar: number;
      groundSize: number;
      playerStart: { x: number; z: number };
    }
  > = {
    aldea: {
      groundColor: 0x476b45,
      fogColor: 0x9ebfce,
      fogNear: 18,
      fogFar: 54,
      groundSize: 90,
      playerStart: { x: 0, z: 0 },
    },
    bosque: {
      groundColor: 0x3a5c38,
      fogColor: 0x7a9a8a,
      fogNear: 14,
      fogFar: 42,
      groundSize: 80,
      playerStart: { x: 0, z: 8 },
    },
    ruinas: {
      groundColor: 0x4a3f52,
      fogColor: 0x6b5a7a,
      fogNear: 12,
      fogFar: 36,
      groundSize: 70,
      playerStart: { x: 0, z: 6 },
    },
    desierto: {
      groundColor: 0xc2a64e,
      fogColor: 0xe8d4a0,
      fogNear: 20,
      fogFar: 60,
      groundSize: 100,
      playerStart: { x: 0, z: 0 },
    },
    cueva: {
      groundColor: 0x2a2a35,
      fogColor: 0x1a1a25,
      fogNear: 8,
      fogFar: 28,
      groundSize: 60,
      playerStart: { x: 0, z: 5 },
    },
  };
  return configs[zone];
}

export function isNearPortal(
  px: number,
  pz: number,
  portals: ZonePortal[]
): ZonePortal | undefined {
  return portals.find(
    (p) => Math.abs(px - p.position.x) < 2.5 && Math.abs(pz - p.position.z) < 2.5
  );
}

export function isNearNpc(px: number, pz: number, npcs: Npc[]): Npc | undefined {
  return npcs.find(
    (npc) => Math.abs(px - npc.mesh.position.x) < 2 && Math.abs(pz - npc.mesh.position.z) < 2
  );
}

export function isNearStation(
  px: number,
  pz: number,
  stations: CraftingStation[]
): CraftingStation | undefined {
  return stations.find(
    (s) => Math.abs(px - s.mesh.position.x) < 2 && Math.abs(pz - s.mesh.position.z) < 2
  );
}
