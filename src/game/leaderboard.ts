import type { ZoneId } from './profile';

export interface LeaderboardEntry {
  name: string;
  level: number;
  element: string;
  score: number;
  zone: ZoneId;
  date: string;
}

const LEADERBOARD_KEY = 'reinos-ancestrales-leaderboard';
const MAX_ENTRIES = 50;

const ZONE_WEIGHTS: Record<ZoneId, number> = {
  aldea: 1,
  bosque: 2,
  ruinas: 3,
  desierto: 4,
  cueva: 5,
};

function generateNPCEntries(): LeaderboardEntry[] {
  const names = [
    { name: 'Kael el Valiente', element: 'fuego', level: 15 },
    { name: 'Lira Sombrilla', element: 'sombra', level: 22 },
    { name: 'Theron Piedra', element: 'tierra', level: 18 },
    { name: 'Aria Cielos', element: 'aire', level: 20 },
    { name: 'Draven Noctis', element: 'sombra', level: 25 },
    { name: 'Seraphina Luz', element: 'luz', level: 19 },
    { name: 'Bjorn Acechante', element: 'tierra', level: 16 },
    { name: 'Elara Torrente', element: 'agua', level: 21 },
    { name: 'Ignis Ember', element: 'fuego', level: 17 },
    { name: 'Vex Nighthollow', element: 'sombra', level: 23 },
  ];
  const zones: ZoneId[] = ['aldea', 'bosque', 'ruinas', 'desierto', 'cueva'];

  return names.map((npc, i) => ({
    name: npc.name,
    level: npc.level,
    element: npc.element,
    score: Math.floor(500 + Math.random() * 1500 + i * 100),
    zone: zones[Math.floor(Math.random() * zones.length)],
    date: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString().split('T')[0],
  }));
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (raw) {
      const entries: LeaderboardEntry[] = JSON.parse(raw);
      if (entries.length > 0) return entries;
    }
  } catch {
    // corrupted
  }
  const entries = generateNPCEntries();
  saveLeaderboard(entries);
  return entries;
}

export function saveLeaderboard(entries: LeaderboardEntry[]) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

export function submitScore(
  entries: LeaderboardEntry[],
  playerName: string,
  playerLevel: number,
  playerElement: string,
  score: number,
  zone: ZoneId
): LeaderboardEntry[] {
  const entry: LeaderboardEntry = {
    name: playerName,
    level: playerLevel,
    element: playerElement,
    score,
    zone,
    date: new Date().toISOString().split('T')[0],
  };

  entries.push(entry);
  entries.sort((a, b) => b.score - a.score);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  saveLeaderboard(entries);
  return entries;
}

export function calculateScore(
  zone: ZoneId,
  enemiesKilled: number,
  bossesKilled: number,
  timeSeconds: number,
  playerLevel: number
): number {
  const zoneWeight = ZONE_WEIGHTS[zone] ?? 1;
  const killScore = enemiesKilled * 10 * zoneWeight;
  const bossScore = bossesKilled * 100 * zoneWeight;
  const levelBonus = playerLevel * 5;
  const timeBonus = Math.max(0, Math.floor((300 - timeSeconds) / 10) * 2);
  return killScore + bossScore + levelBonus + timeBonus;
}

export function getRank(entries: LeaderboardEntry[], playerName: string): number {
  const idx = entries.findIndex((e) => e.name === playerName);
  return idx >= 0 ? idx + 1 : entries.length + 1;
}
