export interface RedeemResult {
  success: boolean;
  reward: {
    type: string;
    id: string;
    name: string;
    label: string;
    quantity: number;
    duplicated: boolean;
  };
  product: {
    id: string;
    name: string;
  };
}

export interface RewardHistoryEntry {
  id: number;
  user_phone: string;
  invoice_code: string;
  reward_type: string;
  reward_id: string;
  reward_name: string;
  quantity: number;
  created_at: number;
  campaign_id?: string;
}

export interface PendingRewards {
  pending: number;
  recent: RewardHistoryEntry[];
}

export async function redeemCode(code: string): Promise<RedeemResult> {
  const token = localStorage.getItem('reinos-auth-token');
  const res = await fetch('/api/redeem', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al canjear código');
  return data;
}

export async function getRewardHistory(): Promise<RewardHistoryEntry[]> {
  const token = localStorage.getItem('reinos-auth-token');
  const res = await fetch('/api/rewards/history', {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error('Error al obtener historial');
  const data = await res.json();
  return data.history || [];
}

export async function getPendingRewards(): Promise<PendingRewards> {
  const token = localStorage.getItem('reinos-auth-token');
  const res = await fetch('/api/rewards/pending', {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error('Error al obtener recompensas pendientes');
  return res.json();
}

export function isCharacterReward(type: string): boolean {
  return type === 'character';
}

export function isItemReward(type: string): boolean {
  return type === 'item' || type === 'consumable';
}

export function isCurrencyReward(type: string): boolean {
  return type === 'currency' || type === 'crystals';
}
