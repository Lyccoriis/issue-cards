import { create } from 'zustand';

import { listReads, markRead, stamp } from '@/lib/issues';
import { touchedAt, useIssueStore } from '@/stores/useIssueStore';
import type { IssueCard } from '@/types';

interface SeenStore {
  seen: Record<string, string>;
  loaded: boolean;
  load: (workspaceId: string) => Promise<void>;
  clear: () => void;
  markSeen: (cardIds: string[]) => Promise<void>;
}

export const useSeenStore = create<SeenStore>((set, get) => ({
  seen: {},
  loaded: false,

  load: async workspaceId => {
    try {
      const seen = await listReads(workspaceId);
      set({ seen, loaded: true });
    } catch {
      set({ seen: {}, loaded: true });
    }
  },

  clear: () => set({ seen: {}, loaded: false }),

  markSeen: async cardIds => {
    const cards = useIssueStore.getState().cards;
    const now = stamp(new Date().toISOString());

    const rows: Record<string, string> = {};
    for (const id of cardIds) {
      const card = cards.find(c => c.id === id);
      if (!card) continue;
      const at = touchedAt(card) || now;
      if (get().seen[card.rowId] !== at) rows[card.rowId] = at;
    }

    const rowIds = Object.keys(rows);
    if (rowIds.length === 0) return;

    set({ seen: { ...get().seen, ...rows } });

    const byStamp = new Map<string, string[]>();
    for (const rowId of rowIds) {
      const at = rows[rowId];
      byStamp.set(at, [...(byStamp.get(at) ?? []), rowId]);
    }
    await Promise.all([...byStamp].map(([at, ids]) => markRead(ids, at)));
  },
}));

export function useIsNew(card: IssueCard): boolean {
  const seen = useSeenStore(s => s.seen[card.rowId]);
  const loaded = useSeenStore(s => s.loaded);
  if (!loaded) return false;
  const at = touchedAt(card);
  if (!at) return false;
  return seen === undefined || at > seen;
}
