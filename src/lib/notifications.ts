import { sessionUser, stamp } from '@/lib/issues';
import { supabase } from '@/lib/supabase';
import type {
  AppNotification,
  NotificationKind,
  NotificationLinkKind,
  NotifyPrefs,
} from '@/types';
import { NOTIFICATION_KINDS } from '@/types';

interface NotificationRow {
  id: string;
  workspace_id: string;
  user_id: string;
  actor_id: string | null;
  actor_name: string;
  kind: string;
  title: string;
  body: string;
  link_kind: string;
  link_ref: string;
  link_sub: string;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}

export const KIND_META: Record<NotificationKind, { label: string; hint: string }> = {
  mention: { label: 'Mentions', hint: 'Someone writes @ and your name, anywhere there is text' },
  card_comment: { label: 'Comments on your cards', hint: 'A card you filed, fixed or commented on gets a new comment' },
  card_new: { label: 'New cards', hint: 'Someone files a card in the workspace' },
  card_fixed: { label: 'Fixes to test', hint: 'A card you filed is marked fixed and waits on you' },
  card_rejected: { label: 'Fixes sent back', hint: 'A fix you made is rejected with a reason' },
  card_closed: { label: 'Cards closed', hint: 'A card you filed or fixed is resolved or marked wontfix' },
  card_due: { label: 'Due dates', hint: 'A card you filed is due within two days, or past due' },
  test_new: { label: 'New tests', hint: 'A feature is published and needs testers' },
  test_failed: { label: 'Failed steps', hint: 'A tester marks a step on your feature as broken' },
  test_passed: { label: 'Features passed', hint: 'Every step on your feature passes' },
  test_retest: { label: 'Retests', hint: 'A feature you tested is opened for another round' },
  test_note: { label: 'Notes on features', hint: 'A feature you made or wrote on gets a new note' },
  member_joined: { label: 'People joining', hint: 'Someone joins the workspace with the invite code' },
  role_changed: { label: 'Your role', hint: 'Your role in a workspace changes' },
  update: { label: 'App updates', hint: 'A newer version of the app is out' },
};

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = { desktop: true, kinds: {} };

export function toNotifyPrefs(raw: unknown): NotifyPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_NOTIFY_PREFS;
  const source = raw as { desktop?: unknown; kinds?: unknown };
  const kinds: NotifyPrefs['kinds'] = {};
  if (source.kinds && typeof source.kinds === 'object') {
    for (const kind of NOTIFICATION_KINDS) {
      const value = (source.kinds as Record<string, unknown>)[kind];
      if (typeof value === 'boolean') kinds[kind] = value;
    }
  }
  return { desktop: source.desktop !== false, kinds };
}

export function kindOn(prefs: NotifyPrefs, kind: NotificationKind): boolean {
  return prefs.kinds[kind] !== false;
}

function toNotification(row: NotificationRow): AppNotification {
  const kind = (NOTIFICATION_KINDS as readonly string[]).includes(row.kind)
    ? (row.kind as NotificationKind)
    : 'mention';
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    kind,
    title: row.title,
    body: row.body,
    linkKind: (row.link_kind || '') as NotificationLinkKind,
    linkRef: row.link_ref,
    linkSub: row.link_sub,
    read: row.read_at !== null,
    createdAt: stamp(row.created_at),
    local: false,
  };
}

export function fromRow(row: unknown): AppNotification {
  return toNotification(row as NotificationRow);
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);
  return ((data ?? []) as NotificationRow[]).map(toNotification);
}

export interface NewNotification {
  workspaceId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  linkKind?: NotificationLinkKind;
  linkRef?: string;
  linkSub?: string;
  dedupeKey?: string;
}

export async function sendNotifications(items: NewNotification[], actorName: string): Promise<void> {
  if (items.length === 0) return;
  const user = await sessionUser();
  if (!user) return;

  const rows = items.map(item => ({
    workspace_id: item.workspaceId,
    user_id: item.userId,
    actor_id: user.id,
    actor_name: actorName,
    kind: item.kind,
    title: item.title,
    body: item.body ?? '',
    link_kind: item.linkKind ?? '',
    link_ref: item.linkRef ?? '',
    link_sub: item.linkSub ?? '',
    dedupe_key: item.dedupeKey ?? null,
  }));

  const plain = rows.filter(row => row.dedupe_key === null);
  const keyed = rows.filter(row => row.dedupe_key !== null);

  if (plain.length > 0) {
    const { error } = await supabase().from('notifications').insert(plain);
    if (error) console.warn('notifications: could not send', error.message);
  }
  for (const row of keyed) {
    const { error } = await supabase().from('notifications').insert(row);
    if (error && error.code !== '23505') console.warn('notifications: could not send', error.message);
  }
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw new Error(error.message);
}

export async function deleteNotifications(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase().from('notifications').delete().in('id', ids);
  if (error) throw new Error(error.message);
}

export async function deleteAllNotifications(userId: string): Promise<void> {
  const { error } = await supabase().from('notifications').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}
