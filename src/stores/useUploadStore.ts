import { useMemo } from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';

import { fromResult, plainLink } from '@/lib/attach';
import { attachToIssue, type NewAttachment } from '@/lib/issues';
import { errorText } from '@/lib/supabase';
import { attachToResult } from '@/lib/tests';
import { useIssueStore } from '@/stores/useIssueStore';
import { useTestStore } from '@/stores/useTestStore';
import type { UploadJob } from '@/types';


export function cardTarget(rowId: string): string {
  return `card:${rowId}`;
}

export function rejectionTarget(rowId: string, rejectionId: string): string {
  return `rejection:${rowId}:${rejectionId}`;
}

export function draftTarget(token: string): string {
  return `draft:${token}`;
}

export function testFailTarget(resultId: string): string {
  return `testfail:${resultId}`;
}

interface UploadStore {
  jobs: UploadJob[];
  staged: Record<string, NewAttachment[]>;

  listen: () => () => void;

  addFile: (target: string, filePath: string) => Promise<void>;
  addBytes: (target: string, data: ArrayBuffer, name: string) => Promise<void>;
  addLink: (target: string, url: string) => Promise<void>;

  cancel: (id: string) => void;
  retry: (id: string) => void;
  dismiss: (id: string) => void;

  stage: (target: string, item: NewAttachment) => void;
  unstage: (target: string, index: number) => void;
  clearStaged: (target: string) => void;
  drainStaged: (target: string) => NewAttachment[];
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  jobs: [],
  staged: {},

  listen: () => {
    void window.api.upload.jobs().then(jobs => set({ jobs }));
    return window.api.upload.onJob(job => {
      set(s => {
        const at = s.jobs.findIndex(j => j.id === job.id);
        if (at < 0) return { jobs: [...s.jobs, job] };
        const jobs = [...s.jobs];
        jobs[at] = job;
        return { jobs };
      });
      if (job.state === 'done' && job.result) void land(job, get, set);
    });
  },

  addFile: async (target, filePath) => {
    await window.api.upload.file(filePath, target);
  },

  addBytes: async (target, data, name) => {
    await window.api.upload.bytes(data, name, target);
  },

  addLink: async (target, url) => {
    const clean = url.trim();
    const kept = plainLink(clean);
    if (!kept) {
      await window.api.upload.rehost(clean, target);
      return;
    }
    await file(target, kept, get);
  },

  cancel: id => {
    window.api.upload.cancel(id);
  },

  retry: id => {
    void window.api.upload.retry(id);
  },

  dismiss: id => {
    window.api.upload.forget(id);
    set(s => ({ jobs: s.jobs.filter(j => j.id !== id) }));
  },

  stage: (target, item) =>
    set(s => ({ staged: { ...s.staged, [target]: [...(s.staged[target] ?? []), item] } })),

  unstage: (target, index) =>
    set(s => ({
      staged: { ...s.staged, [target]: (s.staged[target] ?? []).filter((_, i) => i !== index) },
    })),

  clearStaged: target =>
    set(s => {
      const staged = { ...s.staged };
      delete staged[target];
      return { staged };
    }),

  drainStaged: target => {
    const items = get().staged[target] ?? [];
    get().clearStaged(target);
    return items;
  },
}));

type Set = (fn: (s: UploadStore) => Partial<UploadStore>) => void;
type Get = () => UploadStore;

async function land(job: UploadJob, get: Get, set: Set): Promise<void> {
  await file(job.target, fromResult(job.result!), get);
  window.api.upload.forget(job.id);
  set(s => ({ jobs: s.jobs.filter(j => j.id !== job.id) }));
}

async function file(target: string, item: NewAttachment, get: Get): Promise<void> {
  const [kind, rowId, rejectionId] = target.split(':');

  if (kind === 'draft') {
    get().stage(target, item);
    return;
  }

  if (kind === 'testfail') {
    try {
      await attachToResult(rowId, item);
      await useTestStore.getState().load();
    } catch (err) {
      toast.error(`${item.name} uploaded but could not be filed, ${errorText(err)}`);
    }
    return;
  }

  try {
    const card = await attachToIssue(rowId, item, kind === 'rejection' ? rejectionId : null);
    useIssueStore.setState(s => ({
      cards: s.cards.map(c => (c.rowId === card.rowId ? card : c)),
    }));
  } catch (err) {
    toast.error(`${item.name} uploaded but could not be filed, ${errorText(err)}`);
  }
}

export function useJobsFor(target: string): UploadJob[] {
  const jobs = useUploadStore(s => s.jobs);
  return useMemo(() => jobs.filter(j => j.target === target), [jobs, target]);
}

export function useStagedFor(target: string): NewAttachment[] {
  return useUploadStore(s => s.staged[target]) ?? EMPTY;
}

const EMPTY: NewAttachment[] = [];
