import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type Change = RealtimePostgresChangesPayload<Record<string, unknown>>;

export function changed(payload: Change, key: string): string | null {
  const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Record<string, unknown> | undefined;
  const value = row?.[key];
  return typeof value === 'string' ? value : null;
}

export function readCache<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

const cacheTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function writeCache(key: string, items: unknown[]): void {
  const timer = cacheTimers.get(key);
  if (timer) clearTimeout(timer);
  cacheTimers.set(
    key,
    setTimeout(() => {
      cacheTimers.delete(key);
      try {
        localStorage.setItem(key, JSON.stringify(items));
      } catch {
        localStorage.removeItem(key);
      }
    }, 3000),
  );
}

export function idsKey(list: { id: string }[]): string {
  return list
    .map(x => x.id)
    .sort()
    .join(',');
}

export async function inChunks<T>(ids: string[], size: number, fetch: (part: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await fetch(ids.slice(i, i + size))));
  return out;
}

export function batcher(run: (ids: string[]) => void | Promise<void>, delay = 1000) {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    add(id: string) {
      pending.add(id);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const ids = [...pending];
        pending.clear();
        void run(ids);
      }, delay);
    },
    clear() {
      pending.clear();
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
