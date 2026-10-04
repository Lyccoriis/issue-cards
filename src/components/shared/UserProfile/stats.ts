import {
  FileText,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  SquareCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { EMPTY_RANGE, inRange, lastDays, rank, tally } from '@/lib/leaderboard';
import { countUses, dedupe } from '@/lib/tags';
import { isFromSheet, rejectionCount } from '@/stores/useIssueStore';
import type { IssueCard, WorkspaceMember } from '@/types';

export type EventKind = 'filed' | 'note' | 'fixed' | 'closed' | 'rejected' | 'file';

export interface PersonEvent {
  id: string;
  kind: EventKind;
  time: string;
  cardId: string;
  text: string;
}

export interface PersonBadge {
  id: string;
  label: string;
  note: string;
  icon: LucideIcon;
  count: number;
  tiers: number[];
  tier: number;
  next: number | null;
  floor: number;
}

export interface PersonStats {
  filed: IssueCard[];
  notes: number;
  files: number;
  fixed: number;
  closed: number;
  rejectionsGiven: number;
  rejectionsTaken: number;
  stale: number;
  first: string;
  last: string;
  tags: { name: string; count: number }[];
  events: PersonEvent[];
  badges: PersonBadge[];
  place: number;
  score: number;
  recent: { filed: number; fixed: number; closed: number; rejectionsGiven: number };
}

const TIERS: Record<string, number[]> = {
  reporter: [10, 25, 50, 100],
  resolver: [5, 10, 25, 50],
  closer: [5, 10, 25, 50],
  reviewer: [10, 25, 50, 100],
  evidence: [10, 25, 50, 100],
  verifier: [3, 10, 25, 50],
};

export const TIER_LABEL = ['I', 'II', 'III', 'IV'];

const TIER_COLOR = ['var(--chart-2)', 'var(--chart-4)', 'var(--warning)', 'var(--primary)'];

export function tierColor(tier: number): string {
  return TIER_COLOR[Math.min(TIER_COLOR.length, Math.max(1, tier)) - 1];
}

function badge(
  id: string,
  label: string,
  note: string,
  icon: LucideIcon,
  count: number,
): PersonBadge {
  const tiers = TIERS[id];
  const tier = tiers.filter(step => count >= step).length;
  return {
    id,
    label,
    note,
    icon,
    count,
    tiers,
    tier,
    next: tier < tiers.length ? tiers[tier] : null,
    floor: tier === 0 ? 0 : tiers[tier - 1],
  };
}

const EVENT_COLOR: Record<EventKind, string> = {
  filed: 'var(--primary)',
  note: 'var(--chart-2)',
  fixed: 'var(--warning)',
  closed: 'var(--success)',
  rejected: 'var(--destructive)',
  file: 'var(--muted-foreground)',
};

export function eventColor(kind: EventKind): string {
  return EVENT_COLOR[kind];
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function personStats(
  member: WorkspaceMember,
  cards: IssueCard[],
  members: WorkspaceMember[],
): PersonStats {
  const name = member.displayName;
  const filed = cards.filter(c => !isFromSheet(c) && c.createdBy === member.userId);

  const events: PersonEvent[] = [];

  for (const card of filed) {
    events.push({ id: `filed:${card.id}`, kind: 'filed', time: card.timeOpened, cardId: card.id, text: card.title });
  }

  for (const card of cards) {
    if (card.timeFixed && sameName(card.fixedBy, name)) {
      events.push({ id: `fixed:${card.id}`, kind: 'fixed', time: card.timeFixed, cardId: card.id, text: card.title });
    }
    if (card.timeClosed && sameName(card.closedBy, name)) {
      events.push({
        id: `closed:${card.id}`,
        kind: 'closed',
        time: card.timeClosed,
        cardId: card.id,
        text: card.title,
      });
    }
    for (const note of card.comments) {
      if (note.authorId === member.userId || sameName(note.author, name)) {
        events.push({ id: `note:${note.id}`, kind: 'note', time: note.time, cardId: card.id, text: note.text });
      }
    }
    for (const row of card.rejectionList) {
      if (row.byId === member.userId || sameName(row.by, name)) {
        events.push({
          id: `rejected:${row.id}`,
          kind: 'rejected',
          time: row.time,
          cardId: card.id,
          text: row.reason,
        });
      }
    }
    for (const file of card.attachments) {
      if (file.createdBy === member.userId) {
        events.push({
          id: `file:${file.id}`,
          kind: 'file',
          time: file.createdAt,
          cardId: card.id,
          text: file.name || file.url,
        });
      }
    }
  }

  events.sort((a, b) => b.time.localeCompare(a.time));

  const board = rank(tally(cards, members, EMPTY_RANGE), 'score');
  const mine = board.find(row => row.userId === member.userId);
  const place = mine ? board.indexOf(mine) + 1 : 0;

  const month = lastDays(30);
  const counted = (kind: EventKind) =>
    events.filter(e => e.kind === kind && inRange(e.time, month)).length;

  const names = dedupe(filed.flatMap(c => c.tags));
  const tags = names
    .map(tag => ({ name: tag, count: countUses(filed, tag) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10);

  const notes = events.filter(e => e.kind === 'note').length;
  const files = events.filter(e => e.kind === 'file').length;
  const fixed = events.filter(e => e.kind === 'fixed').length;
  const closed = events.filter(e => e.kind === 'closed').length;
  const rejectionsGiven = events.filter(e => e.kind === 'rejected').length;
  const rejectionsTaken = cards
    .filter(c => sameName(c.fixedBy, name) || c.rejectionList.some(r => sameName(r.fixBy, name)))
    .reduce((total, card) => total + card.rejectionList.filter(r => sameName(r.fixBy, name)).length, 0);

  const stamps = events.map(e => e.time).filter(Boolean).sort();

  return {
    filed,
    notes,
    files,
    fixed,
    closed,
    rejectionsGiven,
    rejectionsTaken,
    stale: filed.reduce((total, card) => total + (rejectionCount(card) > 0 ? 1 : 0), 0),
    first: stamps[0] ?? '',
    last: stamps[stamps.length - 1] ?? '',
    tags,
    events,
    place,
    score: mine?.score ?? 0,
    recent: {
      filed: counted('filed'),
      fixed: counted('fixed'),
      closed: counted('closed'),
      rejectionsGiven: counted('rejected'),
    },
    badges: [
      badge('reporter', 'Reporter', 'Cards filed', FileText, filed.length),
      badge('resolver', 'Resolver', 'Fixes marked', Wrench, fixed),
      badge('closer', 'Closer', 'Cards closed', SquareCheck, closed),
      badge('reviewer', 'Reviewer', 'Notes written', MessageSquare, notes),
      badge('evidence', 'Evidence', 'Files attached', Paperclip, files),
      badge('verifier', 'Verifier', 'Fixes handed back', ShieldCheck, rejectionsGiven),
    ],
  };
}
