import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';

import {
  commentOnIssue,
  createIssue,
  detachFromIssue,
  deleteComment,
  deleteIssue,
  listIssues,
  rejectIssue,
  setIssueStatus,
  stamp,
  updateIssue,
  updateRejection,
} from '@/lib/issues';
import {
  notifyCardComment,
  notifyCardEdited,
  notifyCardFiled,
  notifyCardStatus,
  notifyRejection,
} from '@/lib/notifyEvents';
import { errorText, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { ensureTags } from '@/stores/useTagStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type {
  IssueCard,
  IssueCardPatch,
  IssuePriority,
  IssueStatus,
  NewIssueCard,
  NewRejection,
  Rejection,
  SetStatusOpts,
} from '@/types';

export type SortKey = 'id' | 'priority' | 'status' | 'type' | 'title' | 'timeOpened';

export type OrderKey = 'recent' | 'relevant' | 'oldest' | 'column';

export const ORDERS: { key: Exclude<OrderKey, 'column'>; label: string; hint: string }[] = [
  { key: 'recent', label: 'Recent', hint: 'Whatever was touched last, newest first' },
  { key: 'relevant', label: 'Relevant', hint: 'Open, urgent, overdue and rejected cards first' },
  { key: 'oldest', label: 'Oldest', hint: 'Longest standing card first' },
];

export const STATUSES: IssueStatus[] = ['open', 'fixed', 'resolved', 'wontfix'];

export type StatusFilter = IssueStatus | 'rejected';
export const STATUS_FILTERS: StatusFilter[] = ['open', 'fixed', 'rejected', 'resolved', 'wontfix'];

export function hasRejection(card: IssueCard): boolean {
  return rejectionCount(card) > 0;
}
export const PRIORITIES: IssuePriority[] = ['high', 'medium', 'low'];

export const STALE_DAYS = 21;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_RANK: Record<string, number> = { open: 0, fixed: 1, resolved: 2, wontfix: 3 };

export const SHEET_AUTHOR = 'from-bug-sheet';

interface Filters {
  status: StatusFilter[];
  priority: IssuePriority[];
  type: string[];
  tag: string[];
  codebase: string[];
  version: string[];
  author: string[];
}

const NO_FILTERS: Filters = {
  status: [],
  priority: [],
  type: [],
  tag: [],
  codebase: [],
  version: [],
  author: [],
};

const VIEW_KEY = 'issue-cards:view';

interface SavedView {
  filters: Filters;
  order: OrderKey;
  sortKey: SortKey;
  sortDir: 1 | -1;
  query: string;
}

const ORDER_KEYS: OrderKey[] = ['recent', 'relevant', 'oldest', 'column'];

const DEFAULT_VIEW: SavedView = {
  filters: NO_FILTERS,
  order: 'relevant',
  sortKey: 'id',
  sortDir: 1,
  query: '',
};

function loadView(): SavedView {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return DEFAULT_VIEW;
    const saved = JSON.parse(raw) as Partial<SavedView>;
    return {
      filters: { ...NO_FILTERS, ...(saved.filters ?? {}) },
      order: ORDER_KEYS.includes(saved.order as OrderKey) ? (saved.order as OrderKey) : DEFAULT_VIEW.order,
      sortKey: saved.sortKey ?? DEFAULT_VIEW.sortKey,
      sortDir: saved.sortDir === -1 ? -1 : 1,
      query: typeof saved.query === 'string' ? saved.query : '',
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

let viewTimer: ReturnType<typeof setTimeout> | null = null;

function saveView(view: SavedView): void {
  if (viewTimer) clearTimeout(viewTimer);
  viewTimer = setTimeout(() => {
    viewTimer = null;
    localStorage.setItem(VIEW_KEY, JSON.stringify(view));
  }, 300);
}

interface IssueStore {
  cards: IssueCard[];
  loading: boolean;
  loaded: boolean;
  error: string | null;

  query: string;
  filters: Filters;
  order: OrderKey;
  sortKey: SortKey;
  sortDir: 1 | -1;
  selectedId: string | null;
  checkedIds: string[];

  load: () => Promise<void>;
  watch: () => void;
  unwatch: () => void;
  select: (id: string | null) => void;
  toggleChecked: (id: string) => void;
  setChecked: (ids: string[]) => void;
  clearChecked: () => void;
  setQuery: (query: string) => void;
  setFilter: <K extends keyof Filters>(key: K, values: Filters[K]) => void;
  toggleTag: (tag: string) => void;
  toggleMeta: (key: 'codebase' | 'version', value: string) => void;
  toggleAuthor: (userId: string) => void;
  clearFilters: () => void;
  setOrder: (order: OrderKey) => void;
  setSort: (key: SortKey) => void;

  create: (input: NewIssueCard) => Promise<IssueCard | null>;
  update: (id: string, patch: IssueCardPatch) => Promise<IssueCard | null>;
  setStatus: (id: string, status: IssueStatus, opts?: SetStatusOpts) => Promise<IssueCard | null>;
  reject: (id: string, input: NewRejection, author?: string) => Promise<string | null>;
  editRejection: (id: string, rejectionId: string, patch: Partial<NewRejection>) => Promise<void>;
  comment: (id: string, text: string, author?: string) => Promise<IssueCard | null>;
  uncomment: (id: string, commentId: string) => Promise<IssueCard | null>;
  detach: (id: string, attachmentId: string) => Promise<IssueCard | null>;
  remove: (id: string) => Promise<void>;
}

function workspaceId(): string | null {
  return useAuthStore.getState().activeWorkspaceId;
}

function rowIdFor(id: string): string | null {
  return useIssueStore.getState().cards.find(c => c.id === id)?.rowId ?? null;
}

function swap(set: SetState, card: IssueCard): void {
  set(s => ({ cards: s.cards.map(c => (c.rowId === card.rowId ? card : c)) }));
}

function authorName(): string {
  const profile = useAuthStore.getState().profile;
  return profile?.displayName || profile?.email || 'Unknown';
}

type SetState = (fn: (s: IssueStore) => Partial<IssueStore>) => void;

const tickets = new Map<string, number>();
const inflight = new Map<string, number>();

async function write(
  set: SetState,
  rowId: string,
  local: (card: IssueCard) => IssueCard,
  remote: () => Promise<IssueCard>,
): Promise<IssueCard | null> {
  const before = useIssueStore.getState().cards.find(c => c.rowId === rowId);
  if (!before) return null;

  const ticket = (tickets.get(rowId) ?? 0) + 1;
  tickets.set(rowId, ticket);
  inflight.set(rowId, (inflight.get(rowId) ?? 0) + 1);
  set(s => ({ cards: s.cards.map(c => (c.rowId === rowId ? local(c) : c)) }));

  try {
    const card = await remote();
    if (tickets.get(rowId) === ticket) swap(set, card);
    return card;
  } catch (err) {
    if (tickets.get(rowId) === ticket) swap(set, before);
    throw err;
  } finally {
    const left = (inflight.get(rowId) ?? 1) - 1;
    if (left > 0) inflight.set(rowId, left);
    else inflight.delete(rowId);
  }
}

function now(): string {
  return stamp(new Date().toISOString());
}

let channel: RealtimeChannel | null = null;
let watching: string | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

export const useIssueStore = create<IssueStore>((set, get) => {
  const startView = loadView();
  const keepView = () => {
    const { filters, order, sortKey, sortDir, query } = get();
    saveView({ filters, order, sortKey, sortDir, query });
  };

  return {
    cards: [],
    loading: false,
    loaded: false,
    error: null,

    query: startView.query,
    filters: startView.filters,
    order: startView.order,
    sortKey: startView.sortKey,
    sortDir: startView.sortDir,
    selectedId: null,
    checkedIds: [],

    load: async () => {
      const ws = workspaceId();
      if (!ws) {
        set({ cards: [], loading: false, loaded: true });
        return;
      }
      set(s =>
        s.cards.length && s.cards[0].workspaceId !== ws
          ? { loading: true, cards: [], checkedIds: [], selectedId: null }
          : { loading: true },
      );
      try {
        const fresh = await listIssues(ws);
        if (workspaceId() !== ws) return;
        const alive = new Set(fresh.map(c => c.id));
        set(s => ({
          cards: inflight.size
            ? fresh.map(c => (inflight.has(c.rowId) ? (s.cards.find(o => o.rowId === c.rowId) ?? c) : c))
            : fresh,
          loading: false,
          loaded: true,
          error: null,
          checkedIds: s.checkedIds.filter(c => alive.has(c)),
        }));
      } catch (err) {
        set({ cards: [], loading: false, loaded: true, error: errorText(err) });
      }
    },

    watch: () => {
      const ws = workspaceId();
      if (!ws || watching === ws) return;
      get().unwatch();
      watching = ws;
      const bump = () => {
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          reloadTimer = null;
          void get().load();
        }, 400);
      };

      channel = supabase()
        .channel(`issues:${ws}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'issues', filter: `workspace_id=eq.${ws}` }, bump)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_comments' }, bump)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_attachments' }, bump)
        .subscribe();
    },

    unwatch: () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = null;
      if (channel) void supabase().removeChannel(channel);
      channel = null;
      watching = null;
    },

    select: id => {
      set({ selectedId: id });
      useLayoutStore.getState().setLastSelectedIssue(id);
    },

    toggleChecked: id =>
      set(s => ({
        checkedIds: s.checkedIds.includes(id)
          ? s.checkedIds.filter(c => c !== id)
          : [...s.checkedIds, id],
      })),

    setChecked: ids => set({ checkedIds: ids }),
    clearChecked: () => set({ checkedIds: [] }),
    setQuery: query => {
      set({ query });
      keepView();
    },

    setFilter: (key, values) => {
      set(s => ({ filters: { ...s.filters, [key]: values } }));
      keepView();
    },

    toggleTag: tag => {
      set(s => {
        const on = s.filters.tag.some(t => t.toLowerCase() === tag.toLowerCase());
        return {
          filters: {
            ...s.filters,
            tag: on
              ? s.filters.tag.filter(t => t.toLowerCase() !== tag.toLowerCase())
              : [...s.filters.tag, tag],
          },
        };
      });
      keepView();
    },

    toggleMeta: (key, value) => {
      set(s => {
        const on = s.filters[key].some(v => v.toLowerCase() === value.toLowerCase());
        return {
          filters: {
            ...s.filters,
            [key]: on
              ? s.filters[key].filter(v => v.toLowerCase() !== value.toLowerCase())
              : [...s.filters[key], value],
          },
        };
      });
      keepView();
    },

    toggleAuthor: userId => {
      set(s => ({
        filters: {
          ...s.filters,
          author: s.filters.author.includes(userId)
            ? s.filters.author.filter(id => id !== userId)
            : [...s.filters.author, userId],
        },
      }));
      keepView();
    },

    clearFilters: () => {
      set({ filters: NO_FILTERS, query: '' });
      keepView();
    },

    setOrder: order => {
      set({ order });
      keepView();
    },

    setSort: key => {
      set(s =>
        s.order === 'column' && s.sortKey === key
          ? { sortDir: (s.sortDir * -1) as 1 | -1 }
          : { order: 'column' as OrderKey, sortKey: key, sortDir: 1 },
      );
      keepView();
    },

    create: async input => {
      const ws = workspaceId();
      if (!ws) return null;
      const card = await createIssue(ws, input);
      if (input.tags?.length) await ensureTags(input.tags);
      set(state => ({ cards: [...state.cards, card] }));
      notifyCardFiled(card);
      return card;
    },

    update: async (cardId, patch) => {
      const before = get().cards.find(c => c.id === cardId);
      const rowId = before?.rowId;
      if (!before || !rowId) return null;
      const card = await write(
        set,
        rowId,
        c => ({ ...c, ...patch, updatedAt: now() }),
        () => updateIssue(rowId, patch),
      );
      notifyCardEdited(before, patch);
      if (patch.tags?.length) void ensureTags(patch.tags).catch(() => undefined);
      return card;
    },

    setStatus: async (cardId, status, opts) => {
      const known = get().cards.find(c => c.id === cardId);
      if (!known) return null;
      const author = opts?.author ?? authorName();
      const closing = status === 'resolved' || status === 'wontfix';
      const done = await write(
        set,
        known.rowId,
        c => ({
          ...c,
          status,
          updatedAt: now(),
          ...(status === 'fixed'
            ? { fixedBy: author, timeFixed: now(), testProcedure: opts?.testProcedure?.trim() || c.testProcedure }
            : {}),
          ...(closing ? { closedBy: author, timeClosed: now() } : { timeClosed: '' }),
        }),
        () => setIssueStatus(known.rowId, status, { ...opts, author }, known),
      );
      notifyCardStatus(known, status, opts?.testProcedure);
      return done;
    },

    reject: async (cardId, input, author) => {
      const known = get().cards.find(c => c.id === cardId);
      if (!known) return null;
      let rejectionId: string | null = null;
      await write(
        set,
        known.rowId,
        c => ({ ...c, status: 'open', timeFixed: '', updatedAt: now() }),
        async () => {
          const result = await rejectIssue(known.rowId, input, author ?? authorName(), known);
          rejectionId = result.rejectionId;
          return result.card;
        },
      );
      notifyRejection(known, input);
      return rejectionId;
    },

    editRejection: async (cardId, rejectionId, patch) => {
      const rowId = rowIdFor(cardId);
      if (!rowId) return;
      await write(
        set,
        rowId,
        c => ({
          ...c,
          rejectionList: c.rejectionList.map(r =>
            r.id === rejectionId
              ? {
                  ...r,
                  ...(patch.severity !== undefined ? { severity: patch.severity } : {}),
                  ...(patch.reason !== undefined ? { reason: patch.reason.trim() } : {}),
                  ...(patch.tested !== undefined ? { tested: patch.tested.trim() } : {}),
                }
              : r,
          ),
        }),
        () => updateRejection(rejectionId, rowId, patch),
      );
    },

    comment: async (cardId, text, author) => {
      const known = get().cards.find(c => c.id === cardId);
      const rowId = known?.rowId;
      if (!known || !rowId) return null;
      const name = author ?? authorName();
      const body = text.trim();
      const done = await write(
        set,
        rowId,
        c =>
          body
            ? {
                ...c,
                comments: [
                  ...c.comments,
                  {
                    id: `local:${Date.now()}`,
                    time: now(),
                    author: name,
                    authorId: useAuthStore.getState().session?.user.id ?? null,
                    text: body,
                  },
                ],
              }
            : c,
        () => commentOnIssue(rowId, text, name),
      );
      if (body) notifyCardComment(known, body);
      return done;
    },

    uncomment: async (cardId, commentId) => {
      const rowId = rowIdFor(cardId);
      if (!rowId) return null;
      return write(
        set,
        rowId,
        c => ({ ...c, comments: c.comments.filter(x => x.id !== commentId) }),
        () => deleteComment(commentId, rowId),
      );
    },

    detach: async (cardId, attachmentId) => {
      const rowId = rowIdFor(cardId);
      if (!rowId) return null;
      return write(
        set,
        rowId,
        c => ({ ...c, attachments: c.attachments.filter(a => a.id !== attachmentId) }),
        () => detachFromIssue(attachmentId, rowId),
      );
    },

    remove: async cardId => {
      const state = get();
      const index = state.cards.findIndex(c => c.id === cardId);
      if (index < 0) return;
      const card = state.cards[index];
      set(s => ({
        cards: s.cards.filter(c => c.rowId !== card.rowId),
        checkedIds: s.checkedIds.filter(id => id !== cardId),
        selectedId: s.selectedId === cardId ? null : s.selectedId,
      }));
      try {
        await deleteIssue(card.rowId);
      } catch (err) {
        set(s => {
          if (s.cards.some(c => c.rowId === card.rowId)) return {};
          const cards = [...s.cards];
          cards.splice(Math.min(index, cards.length), 0, card);
          return { cards };
        });
        throw err;
      }
    },
  };
});

export function matchesQuery(card: IssueCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    card.id,
    card.title,
    card.type,
    card.subtype,
    card.location,
    card.codebase,
    card.version,
    card.description,
    card.evidence,
    card.recommendation,
    card.testProcedure,
    card.tags.join(' '),
    card.comments.map(c => c.text).join(' '),
  ]
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every(term => hay.includes(term));
}

export type ListView = Pick<
  IssueStore,
  'cards' | 'filters' | 'query' | 'order' | 'sortKey' | 'sortDir'
>;

export function visibleCards(state: ListView): IssueCard[] {
  const { cards, filters, query, order, sortKey, sortDir } = state;

  const kept = cards.filter(c => {
    if (filters.status.length) {
      const ok = filters.status.some(f => (f === 'rejected' ? hasRejection(c) : f === c.status));
      if (!ok) return false;
    }
    if (filters.priority.length && !filters.priority.includes(c.priority)) return false;
    if (filters.type.length && !filters.type.includes(c.type || 'Other')) return false;
    if (filters.codebase.length && !filters.codebase.some(v => v.toLowerCase() === c.codebase.toLowerCase())) {
      return false;
    }
    if (filters.version.length && !filters.version.some(v => v.toLowerCase() === c.version.toLowerCase())) {
      return false;
    }
    if (filters.author.length) {
      const who = isFromSheet(c) ? SHEET_AUTHOR : (c.createdBy ?? 'nobody');
      if (!filters.author.includes(who)) return false;
    }
    if (filters.tag.length) {
      const own = c.tags.map(t => t.toLowerCase());
      if (!filters.tag.some(t => own.includes(t.toLowerCase()))) return false;
    }
    return matchesQuery(c, query);
  });

  if (order === 'recent') {
    return kept.sort((a, b) => touchedAt(b).localeCompare(touchedAt(a)) || b.id.localeCompare(a.id));
  }
  if (order === 'oldest') {
    return kept.sort((a, b) => a.timeOpened.localeCompare(b.timeOpened) || a.id.localeCompare(b.id));
  }
  if (order === 'relevant') {
    return kept.sort(
      (a, b) => relevance(b) - relevance(a) || touchedAt(b).localeCompare(touchedAt(a)),
    );
  }

  return kept.sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'priority') cmp = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    else if (sortKey === 'status') cmp = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    else cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''));
    return (cmp || a.id.localeCompare(b.id)) * sortDir;
  });
}

export function touchedAt(card: IssueCard): string {
  const times = [
    card.timeOpened,
    card.timeFixed,
    card.timeClosed,
    card.updatedAt,
    ...card.comments.map(c => c.time),
    ...card.attachments.map(a => a.createdAt),
  ].filter(Boolean);
  return times.length ? times.reduce((a, b) => (a > b ? a : b)) : '';
}

const RELEVANCE_STATUS: Record<IssueStatus, number> = {
  open: 60,
  fixed: 35,
  resolved: 0,
  wontfix: -20,
};

const RELEVANCE_PRIORITY: Record<IssuePriority, number> = { high: 30, medium: 15, low: 5 };

export function relevance(card: IssueCard): number {
  let score = RELEVANCE_STATUS[card.status] + RELEVANCE_PRIORITY[card.priority];

  score += Math.min(rejectionCount(card), 3) * 12;
  score += Math.min(card.comments.length, 5) * 2;

  const left = dueInDays(card);
  if (left !== null && card.status !== 'resolved' && card.status !== 'wontfix') {
    if (left < 0) score += 25;
    else if (left <= 7) score += 15;
  }

  const days = ageDays(card);
  if (card.status === 'open' && days !== null && days >= STALE_DAYS) score += 10;

  const touched = touchedAt(card);
  if (touched) {
    const since = (Date.now() - Date.parse(touched.replace(' ', 'T'))) / 86_400_000;
    if (!Number.isNaN(since) && since <= 3) score += 12;
  }

  return score;
}

export function dueInDays(card: IssueCard): number | null {
  if (!card.dueDate) return null;
  const due = Date.parse(`${card.dueDate}T23:59:59`);
  if (Number.isNaN(due)) return null;
  return (due - Date.now()) / 86_400_000;
}

export function rejectionCount(card: IssueCard): number {
  return card.status === 'resolved' || card.status === 'wontfix' ? 0 : card.rejectionList.length;
}

export function lastRejection(card: IssueCard): Rejection | null {
  return card.rejectionList.length ? card.rejectionList[card.rejectionList.length - 1] : null;
}

export function isFromSheet(card: IssueCard): boolean {
  return Boolean(card.sheetRef.trim());
}

export function ageDays(card: IssueCard): number | null {
  if (!card.timeOpened) return null;
  const opened = Date.parse(card.timeOpened.replace(' ', 'T'));
  if (Number.isNaN(opened)) return null;
  return (Date.now() - opened) / 86_400_000;
}

export function formatAge(days: number): string {
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 60) return `${Math.round(days)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}
