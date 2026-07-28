import type { LootResource } from './profile';

export interface BattlePassTier {
  level: number;
  requiredXp: number;
  rewardType: 'xp' | 'resource' | 'crafted';
  rewardId: string;
  rewardAmount: number;
  label: string;
}

export interface BattlePassState {
  currentLevel: number;
  currentXp: number;
  claimedTiers: number[];
  seasonStart: string;
}

const BATTLEPASS_KEY = 'reinos-ancestrales-battlepass';
const MAX_TIERS = 30;

function generateTiers(): BattlePassTier[] {
  const tiers: BattlePassTier[] = [];
  const resourceOptions: LootResource[] = ['trigo', 'mineral', 'esencia', 'madera', 'hierba'];
  const craftedOptions = [
    'pocion',
    'espada',
    'escudo',
    'armadura',
    'amuleto',
    'gran_pocion',
    'elixir',
  ];

  for (let i = 1; i <= MAX_TIERS; i++) {
    const xpRequired = 50 + i * 25;
    let rewardType: BattlePassTier['rewardType'];
    let rewardId: string;
    let rewardAmount: number;
    let label: string;

    if (i % 10 === 0) {
      rewardType = 'crafted';
      rewardId = craftedOptions[Math.floor(i / 10 - 1)] ?? 'elixir';
      rewardAmount = 3;
      label = `3x ${rewardId.replace('_', ' ')}`;
    } else if (i % 5 === 0) {
      rewardType = 'resource';
      rewardId = resourceOptions[Math.floor(i / 5 - 1) % resourceOptions.length];
      rewardAmount = 8;
      label = `8x ${rewardId}`;
    } else if (i % 3 === 0) {
      rewardType = 'resource';
      rewardId = resourceOptions[i % resourceOptions.length];
      rewardAmount = 3;
      label = `3x ${rewardId}`;
    } else {
      rewardType = 'xp';
      rewardId = 'xp';
      rewardAmount = 25 + i * 5;
      label = `+${rewardAmount} EXP`;
    }

    tiers.push({
      level: i,
      requiredXp: xpRequired,
      rewardType,
      rewardId,
      rewardAmount,
      label,
    });
  }
  return tiers;
}

export function loadBattlePass(): BattlePassState {
  try {
    const raw = localStorage.getItem(BATTLEPASS_KEY);
    if (raw) {
      const state: BattlePassState = JSON.parse(raw);
      if (state.seasonStart) return state;
    }
  } catch {
    // corrupted
  }
  return {
    currentLevel: 1,
    currentXp: 0,
    claimedTiers: [],
    seasonStart: new Date().toISOString().split('T')[0],
  };
}

export function saveBattlePass(state: BattlePassState) {
  localStorage.setItem(BATTLEPASS_KEY, JSON.stringify(state));
}

export function addBattlePassXp(
  state: BattlePassState,
  amount: number
): { leveledUp: boolean; newLevel: number } {
  let leveledUp = false;
  state.currentXp += amount;

  const tiers = generateTiers();
  const currentTier = tiers.find((t) => t.level === state.currentLevel);
  if (!currentTier) return { leveledUp, newLevel: state.currentLevel };

  while (state.currentXp >= currentTier.requiredXp && state.currentLevel < MAX_TIERS) {
    state.currentXp -= currentTier.requiredXp;
    state.currentLevel++;
    leveledUp = true;
  }

  return { leveledUp, newLevel: state.currentLevel };
}

export function claimBattlePassTier(
  state: BattlePassState,
  tierLevel: number
): { rewardType: string; rewardId: string; rewardAmount: number } | null {
  const tiers = generateTiers();
  const tier = tiers.find((t) => t.level === tierLevel);
  if (!tier) return null;
  if (state.currentLevel < tierLevel) return null;
  if (state.claimedTiers.includes(tierLevel)) return null;

  state.claimedTiers.push(tierLevel);
  saveBattlePass(state);

  return {
    rewardType: tier.rewardType,
    rewardId: tier.rewardId,
    rewardAmount: tier.rewardAmount,
  };
}

export function getBattlePassTiers(): BattlePassTier[] {
  return generateTiers();
}

export function getBattlePassProgress(state: BattlePassState): {
  tier: number;
  current: number;
  required: number;
  pct: number;
} {
  const tiers = generateTiers();
  const currentTier = tiers.find((t) => t.level === state.currentLevel);
  if (!currentTier) return { tier: state.currentLevel, current: 0, required: 1, pct: 100 };
  return {
    tier: state.currentLevel,
    current: state.currentXp,
    required: currentTier.requiredXp,
    pct: Math.round((state.currentXp / currentTier.requiredXp) * 100),
  };
}
