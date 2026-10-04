import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { NewAttachment } from '@/lib/issues';
import {
  addNote,
  answerStep,
  attachToResult,
  clearAnswer,
  deleteFeature,
  deleteNote,
  detachFromResult,
  featureStatus,
  fileTestIssue,
  listFeatures,
  listNotes,
  needsTester,
  requestRetest,
  saveFeature,
  setFeatureArchived,
} from '@/lib/tests';
import { notifyAnswer, notifyFeatureSaved, notifyRetest, notifyTestNote } from '@/lib/notifyEvents';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIssueStore } from '@/stores/useIssueStore';
import type {
  FeatureStatus,
  NewTestFeature,
  TestAnswerInput,
  TestFeature,
  TestNote,
} from '@/types';

export type TestStatusFilter = FeatureStatus | 'mine' | 'archived';
export const TEST_STATUS_FILTERS: TestStatusFilter[] = [
  'mine',
  'untested',
  'testing',
  'passed',
  'failing',
  'archived',
];

export const TEST_STATUS_LABEL: Record<TestStatusFilter, string> = {
  mine: 'to test',
  untested: 'not tested',
  testing: 'in progress',
  passed: 'passed',
  failing: 'failed',
  archived: 'archived',
};

export interface TestFilters {
  status: TestStatusFilter[];
  version: string[];
  person: string[];
}

export const EMPTY_TEST_FILTERS: TestFilters = { status: [], version: [], person: [] };

export type TestSortKey = 'key' | 'title' | 'status' | 'version' | 'updated';

interface TestStore {
  features: TestFeature[];
  notes: TestNote[];
  loading: boolean;
  loaded: boolean;
  error: string | null;

  query: string;
  filters: TestFilters;
  sortKey: TestSortKey;
  sortDir: 1 | -1;
  selectedId: string | null;
  focusStepId: string | null;
  focus: (stepId: string | null) => void;

  load: () => Promise<void>;
  watch: () => void;
  unwatch: () => void;
  setQuery: (query: string) => void;
  setFilter: <K extends keyof TestFilters>(key: K, value: TestFilters[K]) => void;
  togglePerson: (userId: string) => void;
  clearFilters: () => void;
  setSort: (key: TestSortKey) => void;
  select: (id: string | null) => void;

  save: (featureId: string | null, input: NewTestFeature) => Promise<string>;
  remove: (featureId: string) => Promise<void>;
  archive: (featureId: string, archived: boolean) => Promise<void>;
  retest: (featureId: string) => Promise<number>;

  answer: (stepId: string, input: TestAnswerInput) => Promise<string>;
  clear: (resultId: string) => Promise<void>;
  fileIssue: (resultId: string) => Promise<string>;
  attach: (resultId: string, input: NewAttachment) => Promise<void>;
  detach: (attachmentId: string) => Promise<void>;

  note: (featureId: string, text: string) => Promise<void>;
  unnote: (noteId: string) => Promise<void>;
}

function workspaceId(): string | null {
  return useAuthStore.getState().activeWorkspaceId;
}

function me(): { id: string | null; name: string } {
  const profile = useAuthStore.getState().profile;
  return { id: profile?.id ?? null, name: profile?.displayName || profile?.email || 'Unknown' };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

let channel: RealtimeChannel | null = null;
let watching: string | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

export const useTestStore = create<TestStore>((set, get) => {
  async function after<T>(work: Promise<T>): Promise<T> {
    const value = await work;
    await get().load();
    return value;
  }

  return {
    features: [],
    notes: [],
    loading: false,
    loaded: false,
    error: null,

    query: '',
    filters: EMPTY_TEST_FILTERS,
    sortKey: 'key',
    sortDir: -1,
    selectedId: null,
    focusStepId: null,
    focus: stepId => set({ focusStepId: stepId }),

    load: async () => {
      const ws = workspaceId();
      if (!ws) {
        set({ features: [], notes: [], loading: false, loaded: true });
        return;
      }
      set(s =>
        s.features.length && s.features[0].workspaceId !== ws
          ? { loading: true, features: [], notes: [], selectedId: null }
          : { loading: true },
      );
      try {
        const [fresh, notes] = await Promise.all([
          listFeatures(ws),
          listNotes(ws).catch(() => get().notes),
        ]);
        if (workspaceId() !== ws) return;
        set(s => ({
          features: fresh,
          notes,
          loading: false,
          loaded: true,
          error: null,
          selectedId: fresh.some(f => f.id === s.selectedId) ? s.selectedId : null,
        }));
      } catch (err) {
        set({ features: [], notes: [], loading: false, loaded: true, error: errorText(err) });
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
        .channel(`tests:${ws}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_features', filter: `workspace_id=eq.${ws}` }, bump)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_groups' }, bump)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_steps' }, bump)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_results' }, bump)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_attachments' }, bump)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_notes' }, bump)
        .subscribe();
    },

    unwatch: () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = null;
      if (channel) void supabase().removeChannel(channel);
      channel = null;
      watching = null;
    },

    setQuery: query => set({ query }),
    setFilter: (key, value) => set(s => ({ filters: { ...s.filters, [key]: value } })),
    togglePerson: userId =>
      set(s => ({
        filters: {
          ...s.filters,
          person: s.filters.person.includes(userId)
            ? s.filters.person.filter(p => p !== userId)
            : [...s.filters.person, userId],
        },
      })),
    clearFilters: () => set({ filters: EMPTY_TEST_FILTERS, query: '' }),
    setSort: key =>
      set(s => ({ sortKey: key, sortDir: s.sortKey === key ? (s.sortDir === 1 ? -1 : 1) : 1 })),
    select: id => set({ selectedId: id }),

    save: async (featureId, input) => {
      const ws = workspaceId();
      if (!ws) throw new Error('Open a workspace first');
      const before = featureId ? (get().features.find(f => f.id === featureId) ?? null) : null;
      const id = await after(saveFeature(ws, featureId, input, me().name));
      set({ selectedId: id });
      const saved = get().features.find(f => f.id === id);
      if (saved) notifyFeatureSaved(saved.key, input, before);
      return id;
    },

    remove: async featureId => {
      await after(deleteFeature(featureId));
    },

    archive: async (featureId, archived) => {
      await after(setFeatureArchived(featureId, archived));
    },

    retest: async featureId => {
      const round = await after(requestRetest(featureId));
      const feature = get().features.find(f => f.id === featureId);
      if (feature) notifyRetest(feature, round);
      return round;
    },

    answer: async (stepId, input) => {
      const resultId = await after(answerStep(stepId, input, me().name));
      for (const feature of get().features) {
        const step = feature.groups.flatMap(g => g.steps).find(s => s.id === stepId);
        if (step) notifyAnswer(feature, step.code, input, resultId);
      }
      return resultId;
    },
    clear: async resultId => {
      await after(clearAnswer(resultId));
    },
    fileIssue: async resultId => {
      const rowId = await fileTestIssue(resultId);
      await useIssueStore.getState().load();
      return rowId;
    },
    attach: async (resultId, input) => {
      await after(attachToResult(resultId, input));
    },
    detach: async attachmentId => {
      await after(detachFromResult(attachmentId));
    },

    note: async (featureId, text) => {
      const ws = workspaceId();
      if (!ws) throw new Error('Open a workspace first');
      const earlier = get().notes.filter(n => n.featureId === featureId);
      await after(addNote(ws, featureId, text, me().name));
      const feature = get().features.find(f => f.id === featureId);
      if (feature) notifyTestNote(feature, text.trim(), earlier);
    },
    unnote: async noteId => {
      await after(deleteNote(noteId));
    },
  };
});

const STATUS_RANK: Record<FeatureStatus, number> = { failing: 0, testing: 1, untested: 2, passed: 3 };

function matchesStatus(feature: TestFeature, filter: TestStatusFilter, myId: string | null): boolean {
  if (filter === 'archived') return feature.archived;
  if (feature.archived) return false;
  if (filter === 'mine') return myId !== null && needsTester(feature, myId);
  return featureStatus(feature) === filter;
}

function matchesQuery(feature: TestFeature, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = [
    feature.key,
    feature.title,
    feature.version,
    feature.done,
    ...feature.groups.flatMap(g => [g.title, g.setup, ...g.steps.flatMap(s => [s.code, s.how, s.expected])]),
  ];
  return text.some(part => part.toLowerCase().includes(q));
}

type View = Pick<TestStore, 'features' | 'filters' | 'query' | 'sortKey' | 'sortDir'>;

export function visibleFeatures(view: View): TestFeature[] {
  const myId = me().id;
  const { features, filters, query, sortKey, sortDir } = view;

  const shown = features.filter(f => {
    if (filters.status.length === 0 ? f.archived : !filters.status.some(s => matchesStatus(f, s, myId))) {
      return false;
    }
    if (filters.version.length && !filters.version.includes(f.version)) return false;
    if (filters.person.length && !(f.createdBy && filters.person.includes(f.createdBy))) return false;
    return matchesQuery(f, query);
  });

  return shown.sort((a, b) => {
    let diff = 0;
    if (sortKey === 'key') diff = a.seq - b.seq;
    else if (sortKey === 'title') diff = a.title.localeCompare(b.title);
    else if (sortKey === 'version') diff = a.version.localeCompare(b.version, undefined, { numeric: true });
    else if (sortKey === 'updated') diff = a.updatedAt.localeCompare(b.updatedAt);
    else diff = STATUS_RANK[featureStatus(a)] - STATUS_RANK[featureStatus(b)];
    return diff * sortDir || a.seq - b.seq;
  });
}

export function waitingOnMe(features: TestFeature[]): number {
  const myId = me().id;
  return myId ? features.filter(f => needsTester(f, myId)).length : 0;
}
