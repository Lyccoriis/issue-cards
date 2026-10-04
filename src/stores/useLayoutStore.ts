import { create } from 'zustand';
import type { IdentityPrefs, LayoutState, PanelId, SidebarState } from '@/types';

const STORE_KEY = 'issue-cards:layout';

export const DEFAULT_LAYOUT: LayoutState = {
  activePanel: 'issue-cards',
  navSidebar: { mode: 'retracted', width: 240 },
  lastSelectedIssueId: null,
  issueColumnWidths: {},
  issueView: 'table',
  issueSheetWidth: 560,
  identity: { click: 'profile', menu: true, underline: true, shape: 'circle' },
};

interface LayoutStore extends LayoutState {
  setActivePanel: (id: PanelId) => void;
  setNavSidebar: (patch: Partial<SidebarState>) => void;
  setLastSelectedIssue: (id: string | null) => void;
  setIssueColumnWidth: (column: string, width: number) => void;
  setIssueView: (view: LayoutState['issueView']) => void;
  setIssueSheetWidth: (width: number) => void;
  setIdentity: (patch: Partial<IdentityPrefs>) => void;
}

function load(): LayoutState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const saved = { ...DEFAULT_LAYOUT, ...(JSON.parse(raw) as Partial<LayoutState>) };
    saved.identity = { ...DEFAULT_LAYOUT.identity, ...(saved.identity ?? {}) };
    if ((saved.navSidebar.mode as string) === 'locked-retracted') {
      saved.navSidebar = { ...saved.navSidebar, mode: 'retracted' };
    }
    return saved;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(state: LayoutState): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const snapshot: LayoutState = {
      activePanel: state.activePanel,
      navSidebar: state.navSidebar,
      lastSelectedIssueId: state.lastSelectedIssueId,
      issueColumnWidths: state.issueColumnWidths,
      issueView: state.issueView,
      issueSheetWidth: state.issueSheetWidth,
      identity: state.identity,
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(snapshot));
  }, 300);
}

export const useLayoutStore = create<LayoutStore>((set, get) => {
  const save = () => scheduleSave(get());

  return {
    ...load(),

    setActivePanel: id => {
      if (get().activePanel === id) return;
      set({ activePanel: id });
      save();
    },

    setNavSidebar: patch => {
      set(s => ({ navSidebar: { ...s.navSidebar, ...patch } }));
      save();
    },

    setLastSelectedIssue: id => {
      set({ lastSelectedIssueId: id });
      save();
    },

    setIssueColumnWidth: (column, width) => {
      set(s => ({ issueColumnWidths: { ...s.issueColumnWidths, [column]: width } }));
      save();
    },

    setIssueView: view => {
      set({ issueView: view });
      save();
    },

    setIssueSheetWidth: width => {
      set({ issueSheetWidth: Math.round(width) });
      save();
    },

    setIdentity: patch => {
      set(s => ({ identity: { ...s.identity, ...patch } }));
      save();
    },
  };
});
