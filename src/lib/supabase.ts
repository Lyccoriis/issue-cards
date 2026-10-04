import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  DEFAULT_IMGUR_CLIENT_ID,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
} from '@/lib/connectionDefaults';

const STORE_KEY = 'issue-cards:connection';

export interface Connection {
  url: string;
  anonKey: string;
}

function fromEnv(): Connection | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';
  return url && anonKey ? { url, anonKey } : null;
}

function fromStore(): Connection | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Connection>;
    if (!parsed.url || !parsed.anonKey) return null;
    return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
  } catch {
    return null;
  }
}

export function connection(): Connection {
  return (
    fromStore() ?? fromEnv() ?? { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY }
  );
}

export function isConfigured(): boolean {
  const { url, anonKey } = connection();
  return Boolean(url && anonKey);
}

export function saveConnection(next: Connection): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
}

export function clearConnection(): void {
  localStorage.removeItem(STORE_KEY);
}

const REMEMBER_KEY = 'issue-cards:remember';

export function rememberSession(): boolean {
  return localStorage.getItem(REMEMBER_KEY) !== '0';
}

export function setRememberSession(on: boolean): void {
  if (on) localStorage.removeItem(REMEMBER_KEY);
  else localStorage.setItem(REMEMBER_KEY, '0');
}

const authStorage = {
  getItem: (key: string) => (rememberSession() ? localStorage : sessionStorage).getItem(key),
  setItem: (key: string, value: string) => {
    const on = rememberSession();
    (on ? localStorage : sessionStorage).setItem(key, value);
    (on ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

let client: SupabaseClient | null = null;
let clientUrl = '';

export function supabase(): SupabaseClient {
  const { url, anonKey } = connection();
  if (!url || !anonKey) throw new Error('Supabase is not configured, add the project URL and anon key in Settings');
  if (!client || clientUrl !== url) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storage: authStorage },
    });
    clientUrl = url;
  }
  return client;
}

export function errorText(err: unknown): string {
  if (!err) return 'Something went wrong';
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

const IMGUR_KEY = 'issue-cards:imgur';

export function imgurClientId(): string {
  return localStorage.getItem(IMGUR_KEY)?.trim() || DEFAULT_IMGUR_CLIENT_ID;
}

export function saveImgurClientId(value: string): void {
  const clean = value.trim();
  if (clean) localStorage.setItem(IMGUR_KEY, clean);
  else localStorage.removeItem(IMGUR_KEY);
  window.api.upload.setImgurKey(clean);
}
