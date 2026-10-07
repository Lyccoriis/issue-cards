import { create } from 'zustand';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';

import { toNotifyPrefs } from '@/lib/notifications';
import { notifyJoined, notifyRole } from '@/lib/notifyEvents';
import { permissionsFor, toRole, type Permissions } from '@/lib/permissions';
import { errorText, isConfigured, supabase } from '@/lib/supabase';
import type {
  AvatarBorder,
  MemberRole,
  ThemeChoice,
  UserProfile,
  Workspace,
  WorkspaceMember,
} from '@/types';

export const SETTINGS_DEFAULTS = {
  theme: 'oled' as ThemeChoice,
  accent: 'blue',
  density: 'normal' as 'normal' | 'compact',
  radius: '0.5rem',
  monoUi: false,
};

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  initials: string;
  accent: string;
  theme: string;
  density: string;
  radius: string;
  mono_ui: boolean;
  avatar_url?: string | null;
  bio?: string | null;
  banner_url?: string | null;
  avatar_border?: string | null;
  keys: Record<string, string> | null;
  active_workspace: string | null;
  notify_prefs?: unknown;
}

interface MemberRow {
  user_id: string;
  role: string;
  joined_at: string;
}

const ROLE_RANK: Record<MemberRole, number> = {
  owner: 0,
  admin: 1,
  editor: 2,
  viewer: 3,
  reader: 4,
};

const BORDERS: AvatarBorder[] = ['none', 'glow', 'ring'];

function toBorder(value: string | null | undefined): AvatarBorder {
  return BORDERS.includes(value as AvatarBorder) ? (value as AvatarBorder) : 'none';
}

function toProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    initials: row.initials,
    accent: row.accent || SETTINGS_DEFAULTS.accent,
    theme: (row.theme || SETTINGS_DEFAULTS.theme) as ThemeChoice,
    density: (row.density || SETTINGS_DEFAULTS.density) as 'normal' | 'compact',
    radius: row.radius || SETTINGS_DEFAULTS.radius,
    monoUi: row.mono_ui,
    avatarUrl: row.avatar_url ?? '',
    bio: row.bio ?? '',
    bannerUrl: row.banner_url ?? '',
    avatarBorder: toBorder(row.avatar_border),
    keys: row.keys ?? {},
    activeWorkspace: row.active_workspace,
    notifyPrefs: toNotifyPrefs(row.notify_prefs),
  };
}

export type ProfilePatch = Partial<Omit<UserProfile, 'id' | 'email'>>;

const COLUMN: Record<keyof ProfilePatch, string> = {
  displayName: 'display_name',
  initials: 'initials',
  accent: 'accent',
  theme: 'theme',
  density: 'density',
  radius: 'radius',
  monoUi: 'mono_ui',
  avatarUrl: 'avatar_url',
  bio: 'bio',
  bannerUrl: 'banner_url',
  avatarBorder: 'avatar_border',
  keys: 'keys',
  activeWorkspace: 'active_workspace',
  notifyPrefs: 'notify_prefs',
};

interface AuthStore {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  profile: UserProfile | null;
  workspaces: Workspace[];
  members: WorkspaceMember[];
  activeWorkspaceId: string | null;
  error: string | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsEmail: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;

  loadWorkspaces: () => Promise<void>;
  loadMembers: () => Promise<void>;
  watchPeople: () => void;
  unwatchPeople: () => void;
  setActiveWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  joinWorkspace: (code: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  recolorWorkspace: (id: string, color: string) => Promise<void>;
  setCurrentVersion: (id: string, version: string) => Promise<void>;
  regenerateInviteCode: (id: string) => Promise<void>;
  leaveWorkspace: (id: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  setMemberRole: (userId: string, role: MemberRole) => Promise<void>;
}

let peopleChannel: RealtimeChannel | null = null;
let watchingPeople: string | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  ready: false,
  configured: isConfigured(),
  session: null,
  profile: null,
  workspaces: [],
  members: [],
  activeWorkspaceId: null,
  error: null,

  init: async () => {
    if (!isConfigured()) {
      set({ ready: true, configured: false });
      return;
    }
    set({ configured: true });

    const { data } = await supabase().auth.getSession();
    set({ session: data.session });

    supabase().auth.onAuthStateChange((_event, session) => {
      const had = get().session?.user.id;
      set({ session });
      if (!session) {
        set({ profile: null, workspaces: [], members: [], activeWorkspaceId: null });
      } else if (session.user.id !== had) {
        void get().refreshProfile();
      }
    });

    if (data.session) await get().refreshProfile();
    set({ ready: true });
  },

  signIn: async (email, password) => {
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    await get().refreshProfile();
  },

  signUp: async (email, password, displayName) => {
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) throw new Error(error.message);
    if (!data.session) return { needsEmail: true };
    await get().refreshProfile();
    return { needsEmail: false };
  },

  resetPassword: async email => {
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim());
    if (error) throw new Error(error.message);
  },

  signOut: async () => {
    await supabase().auth.signOut();
    set({ session: null, profile: null, workspaces: [], members: [], activeWorkspaceId: null });
  },

  refreshProfile: async () => {
    const userId =
      get().session?.user.id ?? (await supabase().auth.getSession()).data.session?.user.id;
    if (!userId) return;
    try {
      const { data, error } = await supabase().from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      const profile = toProfile(data as ProfileRow);
      set({ profile, error: null });
      await get().loadWorkspaces();
    } catch (err) {
      set({ error: errorText(err) });
    }
  },

  updateProfile: async patch => {
    const profile = get().profile;
    if (!profile) return;
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) row[COLUMN[key as keyof ProfilePatch]] = value;
    }
    set({ profile: { ...profile, ...patch } });
    const { error } = await supabase().from('profiles').update(row).eq('id', profile.id);
    if (error) {
      set({ profile });
      throw new Error(error.message);
    }
  },

  loadWorkspaces: async () => {
    const userId = get().session?.user.id ?? get().profile?.id;
    if (!userId) return;
    const { data, error } = await supabase()
      .from('workspace_members')
      .select('role, workspaces(*, workspace_members(role))')
      .eq('user_id', userId);
    if (error) {
      set({ error: error.message });
      return;
    }

    const rows = (data ?? []) as unknown as {
      role: string;
      workspaces: {
        id: string;
        name: string;
        invite_code: string;
        owner_id: string;
        color: string | null;
        current_version: string | null;
        versions: string[] | null;
        workspace_members: { role: string }[] | null;
      } | null;
    }[];

    const workspaces: Workspace[] = rows
      .filter(r => r.workspaces)
      .map(r => ({
        id: r.workspaces!.id,
        name: r.workspaces!.name,
        inviteCode: r.workspaces!.invite_code,
        ownerId: r.workspaces!.owner_id,
        color: r.workspaces!.color || 'blue',
        currentVersion: r.workspaces!.current_version ?? '',
        versions: r.workspaces!.versions ?? [],
        role: toRole(r.role),
        memberCount: (r.workspaces!.workspace_members ?? []).filter(m => m.role !== 'reader').length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const wanted = get().profile?.activeWorkspace;
    const active = workspaces.some(w => w.id === wanted) ? wanted! : (workspaces[0]?.id ?? null);
    set({ workspaces, activeWorkspaceId: active });
    if (active) await get().loadMembers();
  },

  loadMembers: async () => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) {
      set({ members: [] });
      return;
    }
    const { data, error } = await supabase()
      .from('workspace_members')
      .select('user_id, role, joined_at')
      .eq('workspace_id', workspaceId);
    if (error) {
      set({ error: error.message });
      return;
    }

    const rows = (data ?? []).filter(row => row.role !== 'reader') as MemberRow[];
    const ids = rows.map(row => row.user_id);

    const people = new Map<string, ProfileRow>();
    if (ids.length) {
      const found = await supabase().from('profiles').select('*').in('id', ids);
      for (const row of (found.data ?? []) as ProfileRow[]) people.set(row.id, row);
    }

    const members: WorkspaceMember[] = rows
      .map(row => {
        const person = people.get(row.user_id);
        return {
          userId: row.user_id,
          role: toRole(row.role),
          email: person?.email ?? '',
          displayName: person?.display_name || person?.email || 'Unknown',
          initials: person?.initials || '?',
          accent: person?.accent || 'blue',
          avatarUrl: person?.avatar_url ?? '',
          bio: person?.bio ?? '',
          bannerUrl: person?.banner_url ?? '',
          avatarBorder: toBorder(person?.avatar_border),
          joinedAt: row.joined_at ?? '',
        };
      })
      .sort(
        (a, b) =>
          ROLE_RANK[a.role] - ROLE_RANK[b.role] ||
          a.joinedAt.localeCompare(b.joinedAt) ||
          a.displayName.localeCompare(b.displayName),
      );
    set({ members });
  },

  watchPeople: () => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId || watchingPeople === workspaceId) return;
    get().unwatchPeople();
    watchingPeople = workspaceId;
    peopleChannel = supabase()
      .channel(`people:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void get().loadMembers();
        void get().refreshProfile();
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` },
        () => {
          void get().loadMembers();
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => {
        void get().loadWorkspaces();
      })
      .subscribe();
  },

  unwatchPeople: () => {
    if (peopleChannel) void supabase().removeChannel(peopleChannel);
    peopleChannel = null;
    watchingPeople = null;
  },

  setActiveWorkspace: async id => {
    if (get().activeWorkspaceId === id) return;
    set({ activeWorkspaceId: id });
    await Promise.all([get().updateProfile({ activeWorkspace: id }), get().loadMembers()]);
  },

  createWorkspace: async name => {
    if (!get().profile?.id) return;
    const { data, error } = await supabase().rpc('create_workspace', { name: name.trim() });
    if (error) throw new Error(error.message);

    await get().loadWorkspaces();
    if (typeof data === 'string') await get().setActiveWorkspace(data);
  },

  joinWorkspace: async code => {
    const { data, error } = await supabase().rpc('join_workspace', { code: code.trim().toLowerCase() });
    if (error) throw new Error(error.message);
    await get().loadWorkspaces();
    if (typeof data === 'string') await get().setActiveWorkspace(data);
    notifyJoined();
  },

  renameWorkspace: async (id, name) => {
    const { error } = await supabase().from('workspaces').update({ name: name.trim() }).eq('id', id);
    if (error) throw new Error(error.message);
    await get().loadWorkspaces();
  },

  recolorWorkspace: async (id, color) => {
    set(s => ({ workspaces: s.workspaces.map(w => (w.id === id ? { ...w, color } : w)) }));
    const { error } = await supabase().from('workspaces').update({ color }).eq('id', id);
    if (error) {
      await get().loadWorkspaces();
      throw new Error(error.message);
    }
  },

  setCurrentVersion: async (id, version) => {
    const { error } = await supabase()
      .from('workspaces')
      .update({ current_version: version.trim() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    await get().loadWorkspaces();
  },

  regenerateInviteCode: async id => {
    const { error } = await supabase().rpc('regenerate_invite_code', { ws: id });
    if (error) throw new Error(error.message);
    await get().loadWorkspaces();
  },

  leaveWorkspace: async id => {
    const userId = get().profile?.id;
    if (!userId) return;
    const { error } = await supabase()
      .from('workspace_members')
      .delete()
      .eq('workspace_id', id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    set({ activeWorkspaceId: null });
    await get().loadWorkspaces();
    const next = get().workspaces[0]?.id;
    if (next) await get().setActiveWorkspace(next);
  },

  setMemberRole: async (userId, role) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) return;
    const { error } = await supabase().rpc('set_member_role', {
      ws: workspaceId,
      member: userId,
      next_role: role,
    });
    if (error) throw new Error(error.message);
    await get().loadMembers();
    notifyRole(userId, role);
  },

  removeMember: async userId => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) return;
    const { error } = await supabase()
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    await get().loadMembers();
  },
}));

export function activeWorkspace(): Workspace | null {
  const { workspaces, activeWorkspaceId } = useAuthStore.getState();
  return workspaces.find(w => w.id === activeWorkspaceId) ?? null;
}

export function usePermissions(): Permissions {
  const role = useAuthStore(s => s.workspaces.find(w => w.id === s.activeWorkspaceId)?.role);
  return permissionsFor(role);
}
