import type { LootResource } from './profile';

export type DailyQuestType = 'kill' | 'collect' | 'craft' | 'explore';

export interface DailyQuestDef {
  id: string;
  type: DailyQuestType;
  title: string;
  description: string;
  target: string;
  required: number;
  rewardXp: number;
  rewardResource?: LootResource;
  rewardAmount?: number;
}

export interface DailyQuestState {
  id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface DailyQuestData {
  date: string;
  quests: DailyQuestDef[];
  states: DailyQuestState[];
  loginStreak: number;
  lastLoginDate: string;
  totalClaimed: number;
}

const DAILY_STORAGE_KEY = 'reinos-ancestrales-daily';

const QUEST_TEMPLATES: {
  type: DailyQuestType;
  title: string;
  desc: string;
  target: string;
  required: [number, number];
  xp: [number, number];
  reward?: { resource: LootResource; amount: [number, number] };
}[] = [
  {
    type: 'kill',
    title: 'Cazador del dia',
    desc: 'Derrota criaturas en cualquier zona.',
    target: 'creatures',
    required: [3, 8],
    xp: [20, 50],
    reward: { resource: 'esencia', amount: [2, 5] },
  },
  {
    type: 'kill',
    title: ' exterminio',
    desc: 'Elimina lobos en el bosque.',
    target: 'wolf',
    required: [2, 5],
    xp: [25, 45],
    reward: { resource: 'hierba', amount: [2, 4] },
  },
  {
    type: 'collect',
    title: 'Recolector incansable',
    desc: 'Recolecta recursos de cualquier tipo.',
    target: 'resources',
    required: [5, 12],
    xp: [15, 35],
    reward: { resource: 'trigo', amount: [3, 6] },
  },
  {
    type: 'collect',
    title: 'Minero experto',
    desc: 'Recolecta mineral del mundo.',
    target: 'mineral',
    required: [3, 6],
    xp: [20, 40],
    reward: { resource: 'mineral', amount: [2, 5] },
  },
  {
    type: 'collect',
    title: 'Buscador de esencias',
    desc: 'Recolecta esenciasmagicas.',
    target: 'esencia',
    required: [2, 5],
    xp: [25, 50],
    reward: { resource: 'esencia', amount: [2, 4] },
  },
  {
    type: 'craft',
    title: 'Artesano del dia',
    desc: 'Fabrica cualquier objeto.',
    target: 'craft',
    required: [2, 5],
    xp: [30, 60],
    reward: { resource: 'madera', amount: [2, 4] },
  },
  {
    type: 'explore',
    title: 'Explorador',
    desc: 'Visita diferentes zonas.',
    target: 'zones',
    required: [2, 4],
    xp: [20, 45],
    reward: { resource: 'esencia', amount: [1, 3] },
  },
];

function getDateStr(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getTodayStr(): string {
  return getDateStr(new Date());
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateDailyQuests(dateStr: string): DailyQuestDef[] {
  const seed = dateStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  const shuffled = [...QUEST_TEMPLATES].sort(() => rng() - 0.5);
  const selected = shuffled.slice(0, 3);

  return selected.map((tpl, i) => {
    const required = tpl.required[0] + Math.floor(rng() * (tpl.required[1] - tpl.required[0] + 1));
    const xp = tpl.xp[0] + Math.floor(rng() * (tpl.xp[1] - tpl.xp[0] + 1));
    const rewardAmount = tpl.reward
      ? tpl.reward.amount[0] + Math.floor(rng() * (tpl.reward.amount[1] - tpl.reward.amount[0] + 1))
      : undefined;

    return {
      id: `daily_${dateStr}_${i}`,
      type: tpl.type,
      title: tpl.title,
      description: `${tpl.desc} (${required}x)`,
      target: tpl.target,
      required,
      rewardXp: xp,
      rewardResource: tpl.reward?.resource,
      rewardAmount,
    };
  });
}

export function loadDailyQuests(): DailyQuestData {
  const today = getTodayStr();
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (raw) {
      const data: DailyQuestData = JSON.parse(raw);
      if (data.date === today) return data;
    }
  } catch {
    // corrupted, regenerate
  }

  const quests = generateDailyQuests(today);
  return {
    date: today,
    quests,
    states: quests.map((q) => ({ id: q.id, progress: 0, completed: false, claimed: false })),
    loginStreak: 1,
    lastLoginDate: today,
    totalClaimed: 0,
  };
}

export function saveDailyQuests(data: DailyQuestData) {
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data));
}

export function updateLoginStreak(data: DailyQuestData): DailyQuestData {
  const today = getTodayStr();
  if (data.lastLoginDate === today) return data;

  const yesterday = getDateStr(new Date(Date.now() - 86400000));
  if (data.lastLoginDate === yesterday) {
    data.loginStreak = Math.min(data.loginStreak + 1, 7);
  } else {
    data.loginStreak = 1;
  }
  data.lastLoginDate = today;
  return data;
}

export function getStreakBonus(streak: number): { xpBonus: number; resourceBonus: number } {
  return {
    xpBonus: streak * 5,
    resourceBonus: Math.floor(streak / 2),
  };
}

export function trackDailyKill(data: DailyQuestData, enemyKind: string) {
  for (let i = 0; i < data.quests.length; i++) {
    const quest = data.quests[i];
    const state = data.states[i];
    if (state.completed || state.claimed) continue;
    if (quest.type !== 'kill') continue;

    if (quest.target === 'creatures' || quest.target === enemyKind) {
      state.progress = Math.min(state.progress + 1, quest.required);
      if (state.progress >= quest.required) state.completed = true;
    }
  }
}

export function trackDailyCollect(data: DailyQuestData, resourceKind: string, amount: number) {
  for (let i = 0; i < data.quests.length; i++) {
    const quest = data.quests[i];
    const state = data.states[i];
    if (state.completed || state.claimed) continue;
    if (quest.type !== 'collect') continue;

    if (quest.target === 'resources' || quest.target === resourceKind) {
      state.progress = Math.min(state.progress + amount, quest.required);
      if (state.progress >= quest.required) state.completed = true;
    }
  }
}

export function trackDailyCraft(data: DailyQuestData, amount: number): void {
  for (let i = 0; i < data.quests.length; i++) {
    const quest = data.quests[i];
    const state = data.states[i];
    if (state.completed || state.claimed) continue;
    if (quest.type !== 'craft') continue;

    state.progress = Math.min(state.progress + amount, quest.required);
    if (state.progress >= quest.required) state.completed = true;
  }
}

export function trackDailyExplore(data: DailyQuestData, visitedZones: number): void {
  for (let i = 0; i < data.quests.length; i++) {
    const quest = data.quests[i];
    const state = data.states[i];
    if (state.completed || state.claimed) continue;
    if (quest.type !== 'explore') continue;

    state.progress = Math.min(visitedZones, quest.required);
    if (state.progress >= quest.required) state.completed = true;
  }
}

export function claimDailyQuest(
  data: DailyQuestData,
  questIndex: number
): { xp: number; resource?: LootResource; amount?: number; streakBonus: number } | null {
  const quest = data.quests[questIndex];
  const state = data.states[questIndex];
  if (!quest || !state || !state.completed || state.claimed) return null;

  state.claimed = true;
  data.totalClaimed++;

  const streak = getStreakBonus(data.loginStreak);
  const xp = quest.rewardXp + streak.xpBonus;
  const amount = quest.rewardAmount ? quest.rewardAmount + streak.resourceBonus : undefined;

  return {
    xp,
    resource: quest.rewardResource,
    amount,
    streakBonus: streak.xpBonus,
  };
}

export function getDailyQuestStatus(data: DailyQuestData): {
  total: number;
  completed: number;
  claimed: number;
} {
  return {
    total: data.states.length,
    completed: data.states.filter((s) => s.completed).length,
    claimed: data.states.filter((s) => s.claimed).length,
  };
}
