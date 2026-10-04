import type { PlayerProfile } from './profile';
import type {
  StoreListResponse,
  StoreDetailResponse,
  PromotionsResponse,
  ProductsResponse,
} from './stores';
import type { RedeemResult, RewardHistoryEntry, PendingRewards } from './reward-manager';

const AUTH_KEY = 'reinos-auth-token';
const PHONE_KEY = 'reinos-auth-phone';

let token: string | null = localStorage.getItem(AUTH_KEY);
let phone: string | null = localStorage.getItem(PHONE_KEY);

export function getToken(): string | null {
  return token;
}
export function getPhone(): string | null {
  return phone;
}
export function isLoggedIn(): boolean {
  return !!token;
}

export function setAuth(t: string, p: string) {
  token = t;
  phone = p;
  localStorage.setItem(AUTH_KEY, t);
  localStorage.setItem(PHONE_KEY, p);
}

export function clearAuth() {
  token = null;
  phone = null;
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(PHONE_KEY);
}

async function req<T>(
  path: string,
  body?: unknown,
  retries = 1,
  skipAuthCheck = false,
  method: 'GET' | 'POST' | 'PUT' = body ? 'POST' : 'GET'
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`/api${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401 && !skipAuthCheck) {
        clearAuth();
        window.location.reload();
        throw new Error('Sesion expirada');
      }

      if (res.status === 429) {
        throw new Error('Servidor ocupado. Intenta de nuevo.');
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error del servidor');
      return data as T;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Error de conexion');
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function apiRegister(phoneStr: string, password: string): Promise<void> {
  const data = await req<{ token: string; phone: string }>(
    '/register',
    {
      phone: phoneStr,
      password,
    },
    1,
    true
  );
  setAuth(data.token, data.phone);
}

export async function apiLogin(phoneStr: string, password: string): Promise<void> {
  const data = await req<{ token: string; phone: string }>(
    '/login',
    { phone: phoneStr, password },
    1,
    true
  );
  setAuth(data.token, data.phone);
}

export async function apiGetProfile(): Promise<PlayerProfile | null> {
  return req<PlayerProfile>('/profile');
}

export async function apiSaveProfile(profile: PlayerProfile): Promise<boolean> {
  try {
    const result = await req<{ revision: number }>('/profile', profile, 0, false, 'PUT');
    profile.revision = result.revision;
    return true;
  } catch {
    return false;
  }
}

export function showNotification(
  message: string,
  type: 'success' | 'error' | 'warning' = 'warning'
) {
  const existing = document.querySelector('.notification-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `notification-toast notification-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    animation: fadeInOut 3s ease-in-out;
    background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#f39c12'};
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export async function getStores(): Promise<StoreListResponse> {
  return req<StoreListResponse>('/stores');
}

export async function getStore(id: string): Promise<StoreDetailResponse> {
  return req<StoreDetailResponse>(`/stores/${encodeURIComponent(id)}`);
}

export async function getPromotions(): Promise<PromotionsResponse> {
  return req<PromotionsResponse>('/promotions');
}

export async function getProducts(storeId?: string): Promise<ProductsResponse> {
  const qs = storeId ? `?store_id=${encodeURIComponent(storeId)}` : '';
  return req<ProductsResponse>(`/products${qs}`);
}

export async function redeemCode(code: string): Promise<RedeemResult> {
  return req<RedeemResult>('/redeem', { code });
}

export async function getRewardHistory(): Promise<RewardHistoryEntry[]> {
  const data = await req<{ history: RewardHistoryEntry[] }>('/rewards/history');
  return data.history;
}

export async function getPendingRewards(): Promise<PendingRewards> {
  return req<PendingRewards>('/rewards/pending');
}
