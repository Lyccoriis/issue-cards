import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { create } from 'zustand';

import {
  DEFAULT_NOTIFY_PREFS,
  deleteAllNotifications,
  deleteNotifications,
  fromRow,
  kindOn,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from '@/lib/notifications';
import { stamp } from '@/lib/issues';
import { errorText, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIssueStore } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useTestStore } from '@/stores/useTestStore';
import { useUiStore } from '@/stores/useUiStore';
import type { AppNotification, NotifyPrefs } from '@/types';

interface NotificationStore {
  items: AppNotification[];
  loaded: boolean;

  load: () => Promise<void>;
  watch: (userId: string) => () => void;
  push: (item: Omit<AppNotification, 'id' | 'read' | 'createdAt' | 'local'>, id: string) => void;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  open: (item: AppNotification) => Promise<void>;
  openById: (id: string) => void;
  reset: () => void;
}

function prefs(): NotifyPrefs {
  return useAuthStore.getState().profile?.notifyPrefs ?? DEFAULT_NOTIFY_PREFS;
}

function myId(): string | null {
  return useAuthStore.getState().profile?.id ?? null;
}

export function visibleNotifications(items: AppNotification[], p: NotifyPrefs): AppNotification[] {
  return items.filter(item => kindOn(p, item.kind));
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function until(test: () => boolean, ms = 5000): Promise<boolean> {
  const stop = Date.now() + ms;
  while (Date.now() < stop) {
    if (test()) return true;
    await wait(120);
  }
  return test();
}

function announce(item: AppNotification): void {
  if (!kindOn(prefs(), item.kind)) return;
  if (document.hasFocus()) {
    toast(item.title, {
      description: item.body || undefined,
      duration: 6000,
      action: { label: 'Open', onClick: () => void useNotificationStore.getState().open(item) },
    });
    return;
  }
  if (prefs().desktop) window.api.notify.show({ id: item.id, title: item.title, body: item.body });
}

const FOCUS_RELOAD_MS = 5 * 60 * 1000;

let channel: RealtimeChannel | null = null;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  items: [],
  loaded: false,

  load: async () => {
    const id = myId();
    if (!id) return;
    try {
      const fresh = await listNotifications(id);
      set(s => ({ items: [...s.items.filter(i => i.local), ...fresh], loaded: true }));
    } catch (err) {
      console.warn('notifications: could not load', errorText(err));
      set({ loaded: true });
    }
  },

  watch: userId => {
    if (channel) void supabase().removeChannel(channel);
    channel = supabase()
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        payload => {
          const item = fromRow(payload.new);
          if (get().items.some(i => i.id === item.id)) return;
          set(s => ({ items: [item, ...s.items] }));
          announce(item);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        payload => {
          const next = fromRow(payload.new);
          set(s => ({ items: s.items.map(i => (i.id === next.id ? next : i)) }));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications' },
        payload => {
          const gone = (payload.old as { id?: string }).id;
          if (gone) set(s => ({ items: s.items.filter(i => i.id !== gone) }));
        },
      )
      .subscribe();

    let lastLoad = Date.now();
    const onFocus = () => {
      if (Date.now() - lastLoad < FOCUS_RELOAD_MS) return;
      lastLoad = Date.now();
      void get().load();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
      if (channel) void supabase().removeChannel(channel);
      channel = null;
    };
  },

  push: (item, id) => {
    const full: AppNotification = {
      ...item,
      id,
      read: false,
      createdAt: stamp(new Date().toISOString()),
      local: true,
    };
    if (get().items.some(i => i.id === id)) return;
    set(s => ({ items: [full, ...s.items] }));
    announce(full);
  },

  markRead: async ids => {
    const wanted = new Set(ids);
    set(s => ({ items: s.items.map(i => (wanted.has(i.id) ? { ...i, read: true } : i)) }));
    const remote = ids.filter(id => !id.startsWith('local:'));
    try {
      await markNotificationsRead(remote);
    } catch (err) {
      toast.error(errorText(err));
    }
  },

  markAllRead: async () => {
    const id = myId();
    set(s => ({ items: s.items.map(i => ({ ...i, read: true })) }));
    if (!id) return;
    try {
      await markAllNotificationsRead(id);
    } catch (err) {
      toast.error(errorText(err));
    }
  },

  remove: async id => {
    set(s => ({ items: s.items.filter(i => i.id !== id) }));
    if (id.startsWith('local:')) return;
    try {
      await deleteNotifications([id]);
    } catch (err) {
      toast.error(errorText(err));
    }
  },

  clearAll: async () => {
    const id = myId();
    set(s => ({ items: s.items.filter(i => i.local) }));
    if (!id) return;
    try {
      await deleteAllNotifications(id);
    } catch (err) {
      toast.error(errorText(err));
    }
  },

  open: async item => {
    void get().markRead([item.id]);
    useUiStore.getState().setTrayOpen(false);

    const auth = useAuthStore.getState();
    const layout = useLayoutStore.getState();
    const foreign =
      item.workspaceId &&
      item.workspaceId !== auth.activeWorkspaceId &&
      auth.workspaces.some(w => w.id === item.workspaceId);
    if (foreign) {
      await auth.setActiveWorkspace(item.workspaceId);
      await until(() => useAuthStore.getState().activeWorkspaceId === item.workspaceId);
    }

    if (item.linkKind === 'issue') {
      layout.setActivePanel('issue-cards');
      const found = await until(() => useIssueStore.getState().cards.some(c => c.id === item.linkRef));
      if (found) useIssueStore.getState().select(item.linkRef);
      else toast.error(`${item.linkRef} is gone`);
    } else if (item.linkKind === 'test') {
      layout.setActivePanel('testing');
      const found = await until(() => useTestStore.getState().features.some(f => f.key === item.linkRef));
      const feature = useTestStore.getState().features.find(f => f.key === item.linkRef);
      if (!found || !feature) {
        toast.error(`${item.linkRef} is gone`);
        return;
      }
      useTestStore.getState().select(feature.id);
      const step = feature.groups.flatMap(g => g.steps).find(s => s.code === item.linkSub);
      if (step) useTestStore.getState().focus(step.id);
    } else if (item.linkKind === 'profile') {
      useUiStore.getState().openUserProfile(item.linkRef);
    } else if (item.linkKind === 'settings') {
      layout.setActivePanel('settings');
    }
  },

  openById: id => {
    const item = get().items.find(i => i.id === id);
    if (item) void get().open(item);
  },

  reset: () => set({ items: [], loaded: false }),
}));
