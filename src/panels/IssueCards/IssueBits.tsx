import { Fragment, type ReactNode } from 'react';
import { TableProperties } from 'lucide-react';

import TagBadge from '@/components/shared/TagBadge';
import UserIdentity from '@/components/shared/UserIdentity';
import { Badge } from '@/components/ui/badge';
import { fallbackColor } from '@/lib/tags';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIsNew } from '@/stores/useSeenStore';
import type { IssueCard, IssuePriority, IssueStatus, WorkspaceMember } from '@/types';
import TestRefLink from './TestRefLink';
import {
  SHEET_AUTHOR,
  STALE_DAYS,
  ageDays,
  dueInDays,
  formatAge,
  isFromSheet,
  rejectionCount,
  useIssueStore,
  type StatusFilter,
} from '@/stores/useIssueStore';

export const PRIORITY_COLOR: Record<IssuePriority, string> = {
  high: 'var(--destructive)',
  medium: 'var(--warning)',
  low: 'var(--muted-foreground)',
};

export const STATUS_COLOR: Record<StatusFilter, string> = {
  open: 'var(--warning)',
  fixed: 'var(--primary)',
  rejected: 'var(--destructive)',
  resolved: 'var(--success)',
  wontfix: 'var(--muted-foreground)',
};

export function isStale(card: IssueCard): boolean {
  if (card.status !== 'open') return false;
  const days = ageDays(card);
  return days !== null && days >= STALE_DAYS;
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <Dot color={PRIORITY_COLOR[priority]} />
      {priority}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <Dot color={STATUS_COLOR[status]} />
      {status}
    </Badge>
  );
}

export function CardFlags({ card }: { card: IssueCard }) {
  const rejects = rejectionCount(card);
  const days = ageDays(card);
  const left = dueInDays(card);
  const live = card.status === 'open' || card.status === 'fixed';
  const fresh = useIsNew(card);

  return (
    <>
      {fresh && (
        <Badge
          variant="outline"
          className="new-flag"
          title="Something happened on this card since you last opened it"
        >
          new
        </Badge>
      )}
      {rejects > 0 && (
        <Badge variant="outline" className="text-destructive">
          fix rejected x{rejects}
        </Badge>
      )}
      {live && left !== null && left < 0 && (
        <Badge variant="outline" className="text-destructive">
          overdue {Math.ceil(-left)}d
        </Badge>
      )}
      {live && left !== null && left >= 0 && left <= 7 && (
        <Badge variant="outline" className="text-warning">
          due in {Math.ceil(left)}d
        </Badge>
      )}
      {isStale(card) && <Badge variant="outline">stale</Badge>}
      {card.comments.length > 0 && (
        <Badge variant="outline">
          {card.comments.length} {card.comments.length === 1 ? 'note' : 'notes'}
        </Badge>
      )}
      {days !== null && (
        <span className="tnum text-[11px] text-muted-foreground">{formatAge(days)}</span>
      )}
    </>
  );
}

export interface BadgeItem {
  key: string;
  node: ReactNode;
}

export function useMetaItems(card: IssueCard, clickable = true): BadgeItem[] {
  const codebaseFilter = useIssueStore(s => s.filters.codebase);
  const versionFilter = useIssueStore(s => s.filters.version);
  const toggleMeta = useIssueStore(s => s.toggleMeta);

  const active = { codebase: codebaseFilter, version: versionFilter };

  return (['codebase', 'version'] as const)
    .map(key => ({ key, value: card[key].trim() }))
    .filter(item => item.value)
    .map(({ key, value }) => ({
      key,
      node: (
        <TagBadge
          tag={value}
          color={fallbackColor(value)}
          active={active[key].some(v => v.toLowerCase() === value.toLowerCase())}
          onClick={clickable ? () => toggleMeta(key, value) : undefined}
        />
      ),
    }));
}

export function MetaBadges({ card, clickable = true }: { card: IssueCard; clickable?: boolean }) {
  const items = useMetaItems(card, clickable);
  return (
    <>
      {items.map(item => (
        <Fragment key={item.key}>{item.node}</Fragment>
      ))}
    </>
  );
}

export function useAuthor(card: IssueCard): WorkspaceMember | null {
  const member = useAuthStore(s => s.members.find(m => m.userId === card.createdBy) ?? null);
  return isFromSheet(card) ? null : member;
}

export function AuthorDot({ card }: { card: IssueCard }) {
  const author = useAuthor(card);
  const sheet = isFromSheet(card);
  const active = useIssueStore(s =>
    s.filters.author.includes(sheet ? SHEET_AUTHOR : (card.createdBy ?? '')),
  );
  const toggleAuthor = useIssueStore(s => s.toggleAuthor);

  if (sheet) {
    return (
      <button
        type="button"
        title={active ? 'Stop filtering by the bug sheet' : 'Only the cards from the bug sheet'}
        onClick={event => {
          event.stopPropagation();
          toggleAuthor(SHEET_AUTHOR);
        }}
        className={`flex size-5 items-center justify-center rounded-full text-muted-foreground transition-opacity duration-150 hover:opacity-100 ${
          active ? 'ring-[3px] ring-ring/50' : 'opacity-70'
        }`}
      >
        <TableProperties size={15} strokeWidth={1.6} />
      </button>
    );
  }

  if (!author) return null;

  return (
    <UserIdentity
      userId={author.userId}
      active={active}
      action={{
        label: active ? 'Stop filtering by them' : 'Only their cards',
        run: () => toggleAuthor(author.userId),
      }}
    />
  );
}

export function PersonLine({
  userId,
  name,
  className,
}: {
  userId?: string | null;
  name: string;
  className?: string;
}) {
  return <UserIdentity userId={userId} name={name} showName className={className} />;
}

export function FiledBy({ card }: { card: IssueCard }) {
  const author = useAuthor(card);

  if (isFromSheet(card)) {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <TableProperties size={15} strokeWidth={1.6} />
        from the bug sheet{card.sheetRef ? `, row ${card.sheetRef}` : ''}
      </span>
    );
  }

  const who = author ? (
    <UserIdentity userId={author.userId} showName />
  ) : (
    <span className="text-muted-foreground">someone who left</span>
  );

  if (card.testRef) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {who}
        <span className="text-muted-foreground">from test procedure</span>
        <TestRefLink testRef={card.testRef} />
      </span>
    );
  }

  return who;
}
