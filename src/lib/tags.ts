import type { CSSProperties } from 'react';

import type { IssueCard, IssueTag, TagColor } from '@/types';
import { TAG_COLORS } from '@/types';

function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function fallbackColor(name: string): TagColor {
  return TAG_COLORS[hash(name.toLowerCase()) % 5];
}

export function tagVar(color: TagColor): string {
  return `var(--${color})`;
}

export function findTag(tags: IssueTag[], name: string): IssueTag | null {
  const key = name.toLowerCase();
  return tags.find(tag => tag.name.toLowerCase() === key) ?? null;
}

let colorCache: { tags: IssueTag[]; map: Map<string, TagColor> } | null = null;

function colorMap(tags: IssueTag[]): Map<string, TagColor> {
  if (colorCache && colorCache.tags === tags) return colorCache.map;
  const map = new Map<string, TagColor>();
  for (const tag of tags) map.set(tag.name.toLowerCase(), tag.color);
  colorCache = { tags, map };
  return map;
}

export function colorOf(tags: IssueTag[], name: string): TagColor {
  return colorMap(tags).get(name.toLowerCase()) ?? fallbackColor(name);
}

export function tagStyle(color: TagColor, active = false): CSSProperties {
  const value = tagVar(color);
  return {
    color: value,
    background: `color-mix(in oklab, ${value} ${active ? 26 : 12}%, transparent)`,
    borderColor: `color-mix(in oklab, ${value} ${active ? 65 : 34}%, transparent)`,
  };
}

export function normalizeTag(raw: string): string {
  return raw.replace(/[,[\]]/g, '').trim().replace(/\s+/g, '-');
}

export function parseTags(raw: string): string[] {
  return dedupe(raw.split(',').map(normalizeTag).filter(Boolean));
}

export function dedupe(names: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(name);
  }
  return kept;
}

export const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const byName = (a: { name: string }, b: { name: string }) =>
  collator.compare(a.name, b.name);

export function cardHasTag(card: IssueCard, name: string): boolean {
  return card.tags.some(tag => sameTag(tag, name));
}

export function countUses(cards: IssueCard[], name: string): number {
  return cards.filter(card => cardHasTag(card, name)).length;
}

export interface TagRow {
  name: string;
  color: TagColor;
  count: number;
  loose: boolean;
}

function buildTagRows(tags: IssueTag[], cards: IssueCard[]): TagRow[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const name of dedupe(card.tags)) {
      const key = name.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const rows: TagRow[] = tags.map(tag => ({
    name: tag.name,
    color: tag.color,
    count: counts.get(tag.name.toLowerCase()) ?? 0,
    loose: false,
  }));

  const known = new Set(tags.map(tag => tag.name.toLowerCase()));
  const spelling = new Map<string, string>();
  for (const card of cards) {
    for (const name of card.tags) {
      const key = name.toLowerCase();
      if (known.has(key) || spelling.has(key)) continue;
      spelling.set(key, name);
    }
  }

  for (const [key, name] of spelling) {
    rows.push({ name, color: fallbackColor(name), count: counts.get(key) ?? 0, loose: true });
  }

  return rows.sort(byName);
}

let tagCache: { tags: IssueTag[]; cards: IssueCard[]; rows: TagRow[] } | null = null;

export function tagRows(tags: IssueTag[], cards: IssueCard[]): TagRow[] {
  if (tagCache && tagCache.tags === tags && tagCache.cards === cards) return tagCache.rows;
  const rows = buildTagRows(tags, cards);
  tagCache = { tags, cards, rows };
  return rows;
}

export type MetaKey = 'codebase' | 'version';

export interface MetaRow {
  name: string;
  color: TagColor;
  count: number;
}

function buildMetaRows(cards: IssueCard[], key: MetaKey): MetaRow[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const card of cards) {
    const name = card[key].trim();
    if (!name) continue;
    const seen = counts.get(name.toLowerCase());
    if (seen) seen.count += 1;
    else counts.set(name.toLowerCase(), { name, count: 1 });
  }
  return [...counts.values()]
    .map(({ name, count }) => ({ name, color: fallbackColor(name), count }))
    .sort(byName);
}

const metaCache = new Map<MetaKey, { cards: IssueCard[]; rows: MetaRow[] }>();

export function metaRows(cards: IssueCard[], key: MetaKey): MetaRow[] {
  const hit = metaCache.get(key);
  if (hit && hit.cards === cards) return hit.rows;
  const rows = buildMetaRows(cards, key);
  metaCache.set(key, { cards, rows });
  return rows;
}
