import { create } from 'zustand';

import { connection } from '@/lib/supabase';
import type { UpdateState } from '@/types';

const EMPTY: UpdateState = {
  stage: 'idle',
  version: '',
  currentVersion: '',
  notes: '',
  percent: 0,
  message: '',
  supported: false,
};

interface UpdateStore {
  state: UpdateState;
  start: () => () => void;
  check: (announce?: boolean) => Promise<void>;
  download: () => Promise<void>;
  install: () => void;
}

let announceNext = false;
let downloadedFor = '';
let notify: ((state: UpdateState) => void) | null = null;

export function onUpdateAnnounce(fn: (state: UpdateState) => void): void {
  notify = fn;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  state: EMPTY,

  start: () => {
    void window.api.update.state().then(state => set({ state }));

    const stop = window.api.update.onState(state => {
      set({ state });
      if (state.stage === 'available' && state.supported && downloadedFor !== state.version) {
        downloadedFor = state.version;
        void get().download();
      }
      if (announceNext && (state.stage === 'available' || state.stage === 'none' || state.stage === 'error')) {
        announceNext = false;
        notify?.(state);
      }
    });

    void get().check(false);
    return stop;
  },

  check: async announce => {
    announceNext = Boolean(announce);
    const state = await window.api.update.check();
    set({ state });
    if (announceNext && state.stage !== 'checking') {
      announceNext = false;
      notify?.(state);
    }
  },

  download: async () => {
    const state = await window.api.update.download();
    set({ state });
  },

  install: () => window.api.update.install(),
}));
