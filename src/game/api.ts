import type { PlayerProfile } from './profile';

const AUTH_KEY = 'reinos-auth-token';
const PHONE_KEY = 'reinos-auth-phone';

let token: string | null = localStorage.getItem(AUTH_KEY);
let phone: string | null = localStorage.getItem(PHONE_KEY);

export function getToken(): string | null { return token; }
export function getPhone(): string | null { return phone; }
export function isLoggedIn(): boolean { return !!token; }

export function setAuth(t: string, p: string) {
  token = t; phone = p;
  localStorage.setItem(AUTH_KEY, t);
  localStorage.setItem(PHONE_KEY, p);
}

export function clearAuth() {
  token = null; phone = null;
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(PHONE_KEY);
}

async function req<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data as T;
}

export async function apiRegister(phoneStr: string, password: string): Promise<void> {
  const data = await req<{ token: string; phone: string }>('/register', { phone: phoneStr, password });
  setAuth(data.token, data.phone);
}

export async function apiLogin(phoneStr: string, password: string): Promise<void> {
  const data = await req<{ token: string; phone: string }>('/login', { phone: phoneStr, password });
  setAuth(data.token, data.phone);
}

export async function apiGetProfile(): Promise<PlayerProfile | null> {
  try {
    return await req<PlayerProfile>('/profile');
  } catch { return null; }
}

export async function apiSaveProfile(profile: PlayerProfile): Promise<boolean> {
  try { await req('/profile', profile); return true; }
  catch { return false; }
}
