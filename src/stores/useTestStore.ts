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
  featureIdOfResult,
  featureStatus,
  fileTestIssue,
  listFeatures,
  listFeaturesById,
  listNotes,
  listNotesFor,
  needsTester,
  requestRetest,
  saveFeature,
  setFeatureArchived,
  syncFeatures,
} from '@/lib/tests';
import { notifyAnswer, notifyFeatureSaved, notifyRetest, notifyTestNote } from '@/lib/notifyEvents';
import { batcher, changed, readCache, writeCache, type Change } from '@/lib/liveRefresh';
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

  load: (force?: boolean) => Promise<void>;
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

function cacheKey(ws: string): string {
  return `issue-cards:cache:v2:tests:${ws}`;
}

function featureWithResult(features: TestFeature[], resultId: string): TestFeature | undefined {
  return features.find(f => f.results.some(r => r.id === resultId));
}

export const useTestStore = create<TestStore>((set, get) => {
  async function refetchFeatures(ids: string[]): Promise<void> {
    const ws = workspaceId();
    if (!ws || !ids.length) return;
    try {
      const fetched = await listFeaturesById(ids);
      if (workspaceId() !== ws) return;
      const got = new Map(fetched.map(f => [f.id, f]));
      set(s => {
        const kept = s.features.flatMap(f => {
          if (!ids.includes(f.id)) return [f];
          const next = got.get(f.id);
          return next ? [next] : [];
        });
        const known = new Set(s.features.map(f => f.id));
        const features = [
          ...kept,
          ...fetched.filter(f => !known.has(f.id) && f.workspaceId === ws),
        ].sort((a, b) => a.seq - b.seq);
        return {
          features,
          selectedId: features.some(f => f.id === s.selectedId) ? s.selectedId : null,
        };
      });
    } catch {
      return;
    }
  }

  async function refetchNotes(featureIds: string[]): Promise<void> {
    if (!workspaceId() || !featureIds.length) return;
    try {
      const fetched = await listNotesFor(featureIds);
      set(s => ({ notes: [...s.notes.filter(n => !featureIds.includes(n.featureId)), ...fetched] }));
    } catch {
      return;
    }
  }

  const featureRefresher = batcher(refetchFeatures);
  const noteRefresher = batcher(refetchNotes);

  const onFeature = (payload: Change) => {
    const id = changed(payload, 'id');
    if (!id) return;
    if (payload.eventType === 'UPDATE') {
      const feature = get().features.find(f => f.id === id);
      if (feature && changed(payload, 'updated_at') === feature.revision) return;
    }
    featureRefresher.add(id);
  };

  const onChild = (
    has: (feature: TestFeature, id: string) => boolean,
    current?: (feature: TestFeature, payload: Change) => boolean,
  ) => (payload: Change) => {
    const features = get().features;
    const featureId = changed(payload, 'feature_id');
    if (featureId) {
      const feature = features.find(f => f.id === featureId);
      if (feature && current?.(feature, payload)) return;
      const mine = changed(payload, 'workspace_id') === workspaceId();
      if (mine || feature) featureRefresher.add(featureId);
      return;
    }
    const id = changed(payload, 'id');
    const owner = id ? features.find(f => has(f, id)) : null;
    if (owner) featureRefresher.add(owner.id);
  };

  const onAttachment = (payload: Change) => {
    const resultId = changed(payload, 'result_id');
    const features = get().features;
    if (!resultId) {
      const id = changed(payload, 'id');
      const owner = id ? features.find(f => f.results.some(r => r.attachments.some(a => a.id === id))) : null;
      if (owner) featureRefresher.add(owner.id);
      return;
    }
    const owner = featureWithResult(features, resultId);
    if (owner) {
      const own = changed(payload, 'id');
      const result = owner.results.find(r => r.id === resultId);
      if (!(payload.eventType === 'INSERT' && own && result?.attachments.some(a => a.id === own))) {
        featureRefresher.add(owner.id);
      }
      return;
    }
    if (changed(payload, 'workspace_id') !== workspaceId()) return;
    void featureIdOfResult(resultId).then(id => {
      if (id) featureRefresher.add(id);
    });
  };

  const onNote = (payload: Change) => {
    const featureId = changed(payload, 'feature_id');
    if (featureId) {
      const own = changed(payload, 'id');
      const have = payload.eventType === 'INSERT' && own && get().notes.some(n => n.id === own);
      if (!have && changed(payload, 'workspace_id') === workspaceId()) noteRefresher.add(featureId);
      return;
    }
    const id = changed(payload, 'id');
    const note = id ? get().notes.find(n => n.id === id) : null;
    if (note) noteRefresher.add(note.featureId);
  };

  async function afterResult(resultId: string): Promise<void> {
    const owner = featureWithResult(get().features, resultId);
    if (owner) await refetchFeatures([owner.id]);
    else await get().load();
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

    load: async (force = false) => {
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
      const current = get().features;
      const known = force
        ? []
        : current.length && current[0].workspaceId === ws
          ? current
          : (readCache<TestFeature>(cacheKey(ws)) ?? []);
      try {
        if (known.length && known !== current) set({ features: known, loaded: true });
        const [fresh, notes] = await Promise.all([
          known.length ? syncFeatures(ws, known) : listFeatures(ws),
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
        set(s => ({
          features: known.length ? s.features : [],
          notes: known.length ? s.notes : [],
          loading: false,
          loaded: true,
          error: errorText(err),
        }));
      }
    },

    watch: () => {
      const ws = workspaceId();
      if (!ws || watching === ws) return;
      get().unwatch();
      watching = ws;
      let joined = false;

      channel = supabase()
        .channel(`tests:${ws}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_features', filter: `workspace_id=eq.${ws}` }, onFeature)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_groups' }, onChild((f, id) => f.groups.some(g => g.id === id)))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_steps' }, onChild((f, id) => f.groups.some(g => g.steps.some(s => s.id === id))))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_results' }, onChild(
          (f, id) => f.results.some(r => r.id === id),
          (f, p) => {
            const id = changed(p, 'id');
            return f.results.some(r => r.id === id && r.revision === changed(p, 'updated_at'));
          },
        ))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_attachments' }, onAttachment)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'test_notes' }, onNote)
        .subscribe(status => {
          if (status !== 'SUBSCRIBED') return;
          if (joined) void get().load();
          joined = true;
        });
    },

    unwatch: () => {
      featureRefresher.clear();
      noteRefresher.clear();
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
      const id = await saveFeature(ws, featureId, input, me().name);
      await refetchFeatures([id]);
      set({ selectedId: id });
      const saved = get().features.find(f => f.id === id);
      if (saved) notifyFeatureSaved(saved.key, input, before);
      return id;
    },

    remove: async featureId => {
      await deleteFeature(featureId);
      await refetchFeatures([featureId]);
    },

    archive: async (featureId, archived) => {
      await setFeatureArchived(featureId, archived);
      await refetchFeatures([featureId]);
    },

    retest: async featureId => {
      const round = await requestRetest(featureId);
      await refetchFeatures([featureId]);
      const feature = get().features.find(f => f.id === featureId);
      if (feature) notifyRetest(feature, round);
      return round;
    },

    answer: async (stepId, input) => {
      const resultId = await answerStep(stepId, input, me().name);
      const owner = get().features.find(f => f.groups.some(g => g.steps.some(s => s.id === stepId)));
      if (owner) await refetchFeatures([owner.id]);
      else await get().load();
      for (const feature of get().features) {
        const step = feature.groups.flatMap(g => g.steps).find(s => s.id === stepId);
        if (step) notifyAnswer(feature, step.code, input, resultId);
      }
      return resultId;
    },
    clear: async resultId => {
      const owner = featureWithResult(get().features, resultId);
      await clearAnswer(resultId);
      if (owner) await refetchFeatures([owner.id]);
      else await get().load();
    },
    fileIssue: async resultId => {
      const rowId = await fileTestIssue(resultId);
      await useIssueStore.getState().refresh([rowId]);
      return rowId;
    },
    attach: async (resultId, input) => {
      await attachToResult(resultId, input);
      await afterResult(resultId);
    },
    detach: async attachmentId => {
      const owner = get().features.find(f => f.results.some(r => r.attachments.some(a => a.id === attachmentId)));
      await detachFromResult(attachmentId);
      if (owner) await refetchFeatures([owner.id]);
      else await get().load();
    },

    note: async (featureId, text) => {
      const ws = workspaceId();
      if (!ws) throw new Error('Open a workspace first');
      const earlier = get().notes.filter(n => n.featureId === featureId);
      await addNote(ws, featureId, text, me().name);
      await refetchNotes([featureId]);
      const feature = get().features.find(f => f.id === featureId);
      if (feature) notifyTestNote(feature, text.trim(), earlier);
    },
    unnote: async noteId => {
      const owner = get().notes.find(n => n.id === noteId);
      await deleteNote(noteId);
      if (owner) await refetchNotes([owner.featureId]);
      else await get().load();
    },
  };
});

useTestStore.subscribe((state, before) => {
  if (state.features === before.features || !state.loaded || !state.features.length) return;
  writeCache(cacheKey(state.features[0].workspaceId), state.features);
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
