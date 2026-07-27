import type { NftCharacter } from './nft';
import { type PlayerAchievement, createAchievements } from './achievements';

export type Inventory = Record<'trigo' | 'mineral' | 'esencia' | 'madera' | 'hierba', number>;
export type CraftedItems = Record<
  | 'racion'
  | 'espada'
  | 'pocion'
  | 'escudo'
  | 'unguento'
  | 'armadura'
  | 'amuleto'
  | 'pocion_fuerza'
  | 'pocion_velocidad'
  | 'antidoto'
  | 'gran_pocion'
  | 'elixir',
  number
>;
export type LootResource = 'trigo' | 'mineral' | 'esencia' | 'madera' | 'hierba';
export interface LootEntry {
  resource: LootResource;
  amount: number;
}
export type QuestId =
  | 'bosque_lobo'
  | 'bosque_cazador'
  | 'bosque_espiritu'
  | 'ruinas_guardian'
  | 'ruinas_antiguo'
  | 'ruinas_golem'
  | 'ruinas_poder_final';
export interface QuestProgress {
  resources: number;
  creatures: number;
  completed: boolean;
}
export interface QuestState {
  id: QuestId;
  completed: boolean;
}
export type ZoneId = 'aldea' | 'bosque' | 'ruinas' | 'desierto' | 'cueva';
export interface TradeOffer {
  give: keyof Inventory;
  giveAmount: number;
  receive: keyof Inventory;
  receiveAmount: number;
  label: string;
}

export interface PlayerProfile {
  nft: NftCharacter;
  inventory: Inventory;
  crafted: CraftedItems;
  redeemedRewards: string[];
  quest: QuestProgress;
  quests: QuestState[];
  attributePoints: number;
  currentZone: ZoneId;
  unlockedZones: ZoneId[];
  loot: LootEntry[];
  achievements: PlayerAchievement[];
}

const STORAGE_KEY = 'reinos-ancestrales-v3';
const defaultInventory = (): Inventory => ({
  trigo: 0,
  mineral: 0,
  esencia: 0,
  madera: 0,
  hierba: 0,
});
const defaultCrafted = (): CraftedItems => ({
  racion: 0,
  espada: 0,
  pocion: 0,
  escudo: 0,
  unguento: 0,
  armadura: 0,
  amuleto: 0,
  pocion_fuerza: 0,
  pocion_velocidad: 0,
  antidoto: 0,
  gran_pocion: 0,
  elixir: 0,
});

const defaultQuests = (): QuestState[] => [
  { id: 'bosque_lobo', completed: false },
  { id: 'bosque_cazador', completed: false },
  { id: 'bosque_espiritu', completed: false },
  { id: 'ruinas_guardian', completed: false },
  { id: 'ruinas_antiguo', completed: false },
];

export function createProfile(nft: NftCharacter): PlayerProfile {
  return {
    nft,
    inventory: defaultInventory(),
    crafted: defaultCrafted(),
    redeemedRewards: [],
    quest: { resources: 0, creatures: 0, completed: false },
    quests: defaultQuests(),
    attributePoints: 0,
    currentZone: 'aldea',
    unlockedZones: ['aldea'],
    loot: [],
    achievements: createAchievements(),
  };
}

export function saveProfile(profile: PlayerProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export interface QuestDef {
  id: QuestId;
  title: string;
  description: string;
  zone: ZoneId;
  requiredResources: number;
  requiredCreatures: number;
  rewardExp: number;
  rewardResource?: keyof Inventory;
  rewardAmount?: number;
  nextQuest?: QuestId;
  unlockZone?: ZoneId;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'bosque_lobo',
    title: 'El lobo del bosque',
    description: 'Explora el claro y encuentra al lobo ancestral.',
    zone: 'aldea',
    requiredResources: 3,
    requiredCreatures: 2,
    rewardExp: 20,
    rewardResource: 'esencia',
    rewardAmount: 2,
    nextQuest: 'bosque_cazador',
    unlockZone: 'bosque',
  },
  {
    id: 'bosque_cazador',
    title: 'El cazador nocturno',
    description: 'Derrota 3 lobos y recoge 4 hierbas del bosque.',
    zone: 'bosque',
    requiredResources: 4,
    requiredCreatures: 3,
    rewardExp: 35,
    rewardResource: 'madera',
    rewardAmount: 3,
    nextQuest: 'bosque_espiritu',
  },
  {
    id: 'bosque_espiritu',
    title: 'El espiritu ancestral',
    description: 'Encuentra al espiritu del bosque y derrotalo.',
    zone: 'bosque',
    requiredResources: 2,
    requiredCreatures: 1,
    rewardExp: 50,
    nextQuest: 'ruinas_guardian',
  },
  {
    id: 'ruinas_guardian',
    title: 'Guardian de las ruinas',
    description: 'Entra a las ruinas y derrota al guardian.',
    zone: 'bosque',
    requiredResources: 0,
    requiredCreatures: 1,
    rewardExp: 40,
    rewardResource: 'esencia',
    rewardAmount: 3,
    nextQuest: 'ruinas_antiguo',
  },
  {
    id: 'ruinas_antiguo',
    title: 'El poder antiguo',
    description: 'Derrota al antiguo guardian y reclama el poder.',
    zone: 'bosque',
    requiredResources: 0,
    requiredCreatures: 2,
    rewardExp: 80,
    rewardResource: 'esencia',
    rewardAmount: 5,
    nextQuest: 'ruinas_golem',
    unlockZone: 'ruinas',
  },
  {
    id: 'ruinas_golem',
    title: 'El guardian de piedra',
    description: 'Entra a las ruinas y derrota al golem que las custodia.',
    zone: 'ruinas',
    requiredResources: 0,
    requiredCreatures: 2,
    rewardExp: 60,
    rewardResource: 'mineral',
    rewardAmount: 4,
    nextQuest: 'ruinas_poder_final',
  },
  {
    id: 'ruinas_poder_final',
    title: 'El poder final',
    description: 'Derrota al golem anciano y reclama el poder final de las ruinas.',
    zone: 'ruinas',
    requiredResources: 0,
    requiredCreatures: 1,
    rewardExp: 100,
    rewardResource: 'esencia',
    rewardAmount: 8,
  },
];

export const TRADES: TradeOffer[] = [
  {
    give: 'trigo',
    giveAmount: 3,
    receive: 'madera',
    receiveAmount: 1,
    label: 'Vender trigo por madera',
  },
  {
    give: 'mineral',
    giveAmount: 2,
    receive: 'esencia',
    receiveAmount: 1,
    label: 'Vender mineral por esencia',
  },
  {
    give: 'madera',
    giveAmount: 2,
    receive: 'trigo',
    receiveAmount: 3,
    label: 'Vender madera por trigo',
  },
  {
    give: 'hierba',
    giveAmount: 2,
    receive: 'esencia',
    receiveAmount: 1,
    label: 'Vender hierba por esencia',
  },
];

export function currentQuestDef(profile: PlayerProfile): QuestDef | undefined {
  const active = profile.quests.find((q) => !q.completed);
  if (!active) return QUESTS[0];
  return QUESTS.find((q) => q.id === active.id);
}

export function advanceQuest(profile: PlayerProfile): QuestDef | undefined {
  const active = profile.quests.find((q) => !q.completed);
  if (!active) return undefined;
  active.completed = true;
  const next = QUESTS.find((q) => q.id === active.id)?.nextQuest;
  if (next) profile.quests.push({ id: next, completed: false });
  return QUESTS.find((q) => q.id === next);
}
