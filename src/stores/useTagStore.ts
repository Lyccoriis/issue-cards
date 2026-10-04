import { create } from 'zustand';

import { dedupe, fallbackColor, findTag, normalizeTag, sameTag } from '@/lib/tags';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIssueStore } from '@/stores/useIssueStore';
import type { IssueTag, TagColor } from '@/types';

interface TagStore {
  tags: IssueTag[];
  load: () => Promise<void>;
}

export const useTagStore = create<TagStore>(set => ({
  tags: [],

  load: async () => {
    const ws = useAuthStore.getState().activeWorkspaceId;
    if (!ws) {
      set({ tags: [] });
      return;
    }
    const { data, error } = await supabase()
      .from('issue_tags')
      .select('id, name, color')
      .eq('workspace_id', ws)
      .order('name');
    if (error) return;
    set({ tags: (data ?? []) as IssueTag[] });
  },
}));

export function useTags(): IssueTag[] {
  return useTagStore(s => s.tags);
}

export async function ensureTags(names: string[]): Promise<void> {
  const ws = useAuthStore.getState().activeWorkspaceId;
  if (!ws || names.length === 0) return;

  const known = currentTags();
  const missing = dedupe(names.map(normalizeTag).filter(Boolean)).filter(name => !findTag(known, name));
  if (missing.length === 0) return;

  const { error } = await supabase()
    .from('issue_tags')
    .insert(missing.map(name => ({ workspace_id: ws, name, color: fallbackColor(name) })));

  if (error && error.code !== '23505') throw new Error(error.message);
  await useTagStore.getState().load();
}

export async function adoptTag(name: string): Promise<IssueTag | null> {
  await ensureTags([name]);
  return findTag(currentTags(), name);
}

export function currentTags(): IssueTag[] {
  return useTagStore.getState().tags;
}

export async function createTag(name: string, color: TagColor): Promise<IssueTag | null> {
  const clean = normalizeTag(name);
  if (!clean) return null;

  const ws = useAuthStore.getState().activeWorkspaceId;
  if (!ws) return null;
  if (findTag(currentTags(), clean)) throw new Error(`A tag named ${clean} already exists`);

  const { data, error } = await supabase()
    .from('issue_tags')
    .insert({ workspace_id: ws, name: clean, color })
    .select('id, name, color')
    .single();
  if (error) throw new Error(error.message);

  await useTagStore.getState().load();
  return data as IssueTag;
}

export async function updateTag(id: string, patch: { name?: string; color?: TagColor }): Promise<void> {
  const tags = currentTags();
  const current = tags.find(tag => tag.id === id);
  if (!current) return;

  const name = patch.name === undefined ? current.name : normalizeTag(patch.name);
  if (!name) return;

  const clash = findTag(tags, name);
  if (clash && clash.id !== id) throw new Error(`A tag named ${name} already exists`);

  const { error } = await supabase()
    .from('issue_tags')
    .update({ name, color: patch.color ?? current.color })
    .eq('id', id);
  if (error) throw new Error(error.message);

  await useTagStore.getState().load();
  if (sameTag(name, current.name)) return;
  await renameOnCards(current.name, name);
}

export async function deleteTag(id: string, stripFromCards = true): Promise<void> {
  const current = currentTags().find(tag => tag.id === id);
  if (!current) return;

  const { error } = await supabase().from('issue_tags').delete().eq('id', id);
  if (error) throw new Error(error.message);

  await useTagStore.getState().load();
  if (stripFromCards) await renameOnCards(current.name, null);

  const issues = useIssueStore.getState();
  issues.setFilter(
    'tag',
    issues.filters.tag.filter(name => !sameTag(name, current.name)),
  );
}

async function renameOnCards(from: string, to: string | null): Promise<void> {
  const issues = useIssueStore.getState();
  const hit = issues.cards.filter(card => card.tags.some(tag => sameTag(tag, from)));

  await Promise.all(
    hit.map(card =>
      issues.update(card.id, {
        tags: to
          ? card.tags.map(tag => (sameTag(tag, from) ? to : tag))
          : card.tags.filter(tag => !sameTag(tag, from)),
      }),
    ),
  );
}

export async function setCardTag(cardId: string, name: string, on: boolean): Promise<void> {
  const issues = useIssueStore.getState();
  const card = issues.cards.find(c => c.id === cardId);
  if (!card) return;

  const next = on
    ? [...card.tags.filter(tag => !sameTag(tag, name)), name]
    : card.tags.filter(tag => !sameTag(tag, name));
  await issues.update(card.id, { tags: next });
}
