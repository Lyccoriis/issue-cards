import { memo, useMemo } from 'react';

import TagBadge from '@/components/shared/TagBadge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { STATUSES, useIssueStore } from '@/stores/useIssueStore';
import type { IssueCard } from '@/types';
import { AuthorDot, CardFlags, Dot, MetaBadges, PRIORITY_COLOR, STATUS_COLOR } from './IssueBits';
import IssueContextMenu from './IssueContextMenu';

interface IssueBoardProps {
  cards: IssueCard[];
  onEdit?: (card: IssueCard) => void;
}

export default function IssueBoard({ cards, onEdit }: IssueBoardProps) {
  const selectedId = useIssueStore(s => s.selectedId);
  const checkedIds = useIssueStore(s => s.checkedIds);
  const tagFilter = useIssueStore(s => s.filters.tag);

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

  const columns = useMemo(
    () => STATUSES.map(status => ({ status, mine: cards.filter(c => c.status === status) })),
    [cards],
  );

  return (
    <div className="grid grid-cols-[repeat(4,minmax(260px,1fr))] gap-3 p-[22px]">
      {columns.map(({ status, mine }) => (
        <section key={status} className="flex min-w-0 flex-col gap-2">
          <h2 className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
            <Dot color={STATUS_COLOR[status]} />
            {status}
            <span className="tnum">{mine.length}</span>
          </h2>

          <div className="flex flex-col gap-2">
            {mine.map(card => (
              <BoardCard
                key={card.id}
                card={card}
                selected={selectedId === card.id}
                checked={checkedSet.has(card.id)}
                tagFilter={tagFilter}
                onEdit={onEdit}
              />
            ))}

            {mine.length === 0 && (
              <p className="px-1 py-3 text-[12px] text-muted-foreground">nothing here</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

interface BoardCardProps {
  card: IssueCard;
  selected: boolean;
  checked: boolean;
  tagFilter: string[];
  onEdit?: (card: IssueCard) => void;
}

const BoardCard = memo(function BoardCard({
  card,
  selected,
  checked,
  tagFilter,
  onEdit,
}: BoardCardProps) {
  const select = useIssueStore(s => s.select);
  const toggleChecked = useIssueStore(s => s.toggleChecked);
  const toggleTag = useIssueStore(s => s.toggleTag);

  const isTagOn = (tag: string) => tagFilter.some(t => t.toLowerCase() === tag.toLowerCase());

  return (
    <IssueContextMenu card={card} onEdit={onEdit}>
      <Card
        onClick={() => select(card.id)}
        style={{ borderLeftColor: PRIORITY_COLOR[card.priority] }}
        className={`group mb-0 cursor-pointer gap-0 border-l-2 py-0 transition-colors duration-150 hover:border-foreground/30 ${
          selected ? 'ring-[3px] ring-ring/30' : ''
        }`}
      >
        <CardContent className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={checked}
              aria-label={`select ${card.id}`}
              onClick={e => e.stopPropagation()}
              onCheckedChange={() => toggleChecked(card.id)}
              className={
                checked
                  ? ''
                  : 'opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100'
              }
            />
            <span className="mono text-[11px] text-muted-foreground">{card.id}</span>
            <span className="ml-auto">
              <AuthorDot card={card} />
            </span>
          </div>
          <div className="text-[13px] leading-snug break-words">{card.title}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{card.type || 'Other'}</Badge>
            <MetaBadges card={card} />
            {card.tags.map(tag => (
              <TagBadge key={tag} tag={tag} active={isTagOn(tag)} onClick={() => toggleTag(tag)} />
            ))}
            <CardFlags card={card} />
          </div>
          {card.location && <div className="path truncate">{card.location}</div>}
        </CardContent>
      </Card>
    </IssueContextMenu>
  );
});
