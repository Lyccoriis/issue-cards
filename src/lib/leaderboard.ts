import { isFromSheet } from '@/stores/useIssueStore';
import type { IssueCard, IssueStatus, TestFeature, WorkspaceMember } from '@/types';

export interface Range {
  from: string;
  to: string;
}

export const EMPTY_RANGE: Range = { from: '', to: '' };

export function inRange(stamp: string, range: Range): boolean {
  if (!stamp) return false;
  const day = stamp.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

export interface Tally {
  userId: string;
  name: string;
  initials: string;
  accent: string;
  avatarUrl: string;
  filed: number;
  fixed: number;
  closed: number;
  rejectionsGiven: number;
  rejectionsTaken: number;
  score: number;
}

export const WEIGHTS = {
  filed: 1,
  fixed: 4,
  closed: 2,
  rejectionGiven: 1,
  rejectionTaken: -3,
} as const;

export function tally(cards: IssueCard[], members: WorkspaceMember[], range: Range): Tally[] {
  const rows = new Map<string, Tally>();

  for (const member of members) {
    rows.set(member.userId, {
      userId: member.userId,
      name: member.displayName,
      initials: member.initials,
      accent: member.accent,
      avatarUrl: member.avatarUrl,
      filed: 0,
      fixed: 0,
      closed: 0,
      rejectionsGiven: 0,
      rejectionsTaken: 0,
      score: 0,
    });
  }

  const byName = new Map<string, Tally>();
  for (const row of rows.values()) byName.set(row.name.toLowerCase(), row);

  const named = (name: string) => byName.get(name.trim().toLowerCase());

  for (const card of cards) {
    if (!isFromSheet(card) && card.createdBy && inRange(card.timeOpened, range)) {
      const row = rows.get(card.createdBy);
      if (row) row.filed += 1;
    }

    if (card.fixedBy && inRange(card.timeFixed, range)) {
      const row = named(card.fixedBy);
      if (row) row.fixed += 1;
    }

    if (card.closedBy && card.status === 'resolved' && inRange(card.timeClosed, range)) {
      const row = named(card.closedBy);
      if (row) row.closed += 1;
    }

    for (const rejection of card.rejectionList) {
      if (!inRange(rejection.time, range)) continue;
      const gave = rejection.byId ? rows.get(rejection.byId) : named(rejection.by);
      if (gave) gave.rejectionsGiven += 1;
      const took = rejection.fixBy ? named(rejection.fixBy) : undefined;
      if (took) took.rejectionsTaken += 1;
    }
  }

  const out = [...rows.values()];
  for (const row of out) {
    row.score = Math.round(
      row.filed * WEIGHTS.filed +
        row.fixed * WEIGHTS.fixed +
        row.closed * WEIGHTS.closed +
        row.rejectionsGiven * WEIGHTS.rejectionGiven +
        row.rejectionsTaken * WEIGHTS.rejectionTaken,
    );
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export type RankKey =
  | 'filed'
  | 'fixed'
  | 'closed'
  | 'rejectionsGiven'
  | 'rejectionsTaken'
  | 'score';

export const DEFAULT_RANK: RankKey = 'filed';

export function rank(rows: Tally[], key: RankKey): Tally[] {
  return [...rows].sort(
    (a, b) => b[key] - a[key] || b.score - a.score || a.name.localeCompare(b.name),
  );
}

export function didAnything(row: Tally): boolean {
  return (
    row.filed + row.fixed + row.closed + row.rejectionsGiven + row.rejectionsTaken > 0
  );
}

export interface Progress {
  total: number;
  counts: Record<IssueStatus, number>;
  done: number;
}

export function progress(cards: IssueCard[], range: Range): Progress {
  const kept = cards.filter(c => inRange(c.timeOpened, range));
  const counts: Record<IssueStatus, number> = { open: 0, fixed: 0, resolved: 0, wontfix: 0 };
  for (const card of kept) counts[card.status] += 1;
  return {
    total: kept.length,
    counts,
    done: kept.length ? (counts.resolved + counts.wontfix) / kept.length : 0,
  };
}

export function lastDays(days: number): Range {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return { from: day(start), to: day(now) };
}

export function thisMonth(): Range {
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return { from: `${month}-01`, to: `${month}-${pad(now.getDate())}` };
}

export interface TestTally {
  userId: string;
  name: string;
  initials: string;
  accent: string;
  avatarUrl: string;
  written: number;
  passed: number;
  broke: number;
  score: number;
}

export const TEST_WEIGHTS = { written: 3, passed: 1, broke: 2 } as const;

export function tallyTests(
  features: TestFeature[],
  members: WorkspaceMember[],
  range: Range,
): TestTally[] {
  const rows = new Map<string, TestTally>();
  for (const member of members) {
    rows.set(member.userId, {
      userId: member.userId,
      name: member.displayName,
      initials: member.initials,
      accent: member.accent,
      avatarUrl: member.avatarUrl,
      written: 0,
      passed: 0,
      broke: 0,
      score: 0,
    });
  }

  for (const feature of features) {
    if (feature.createdBy && inRange(feature.createdAt, range)) {
      const row = rows.get(feature.createdBy);
      if (row) row.written += 1;
    }
    for (const result of feature.results) {
      if (!inRange(result.updatedAt, range)) continue;
      const row = rows.get(result.userId);
      if (!row) continue;
      if (result.result === 'fail') row.broke += 1;
      else row.passed += 1;
    }
  }

  const out = [...rows.values()];
  for (const row of out) {
    row.score =
      row.written * TEST_WEIGHTS.written +
      row.passed * TEST_WEIGHTS.passed +
      row.broke * TEST_WEIGHTS.broke;
  }
  return out;
}

export type TestRankKey = 'written' | 'passed' | 'broke' | 'score';

export function rankTests(rows: TestTally[], key: TestRankKey): TestTally[] {
  return [...rows].sort(
    (a, b) => b[key] - a[key] || b.score - a.score || a.name.localeCompare(b.name),
  );
}

export function testedAnything(row: TestTally): boolean {
  return row.written + row.passed + row.broke > 0;
}
