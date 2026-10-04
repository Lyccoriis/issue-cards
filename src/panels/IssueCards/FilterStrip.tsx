import { memo } from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  PRIORITIES,
  STATUS_FILTERS,
  hasRejection,
  useIssueStore,
  type StatusFilter,
} from '@/stores/useIssueStore';
import type { IssueCard, IssuePriority } from '@/types';
import { Dot, PRIORITY_COLOR, STATUS_COLOR } from './IssueBits';
import MetaFilter from './MetaFilter';
import PeopleFilter from './PeopleFilter';
import TagFilter from './TagFilter';

interface FilterStripProps {
  cards: IssueCard[];
}

export default memo(function FilterStrip({ cards }: FilterStripProps) {
  const filters = useIssueStore(s => s.filters);
  const setFilter = useIssueStore(s => s.setFilter);

  const count = (fn: (c: IssueCard) => boolean) => cards.filter(fn).length;
  const types = [...new Set(cards.map(c => c.type || 'Other'))].sort();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-[22px] py-2">
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        value={filters.status}
        onValueChange={v => setFilter('status', v as StatusFilter[])}
        className="w-[500px] max-w-full shrink-0"
      >
        {STATUS_FILTERS.map(s => (
          <ToggleGroupItem key={s} value={s} aria-label={s} className="min-w-0 flex-1 gap-1.5 px-2 text-[12px]">
            <Dot color={STATUS_COLOR[s]} />
            {s}
            <span className="tnum text-[11px] text-muted-foreground">
              {count(c => (s === 'rejected' ? hasRejection(c) : c.status === s))}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        value={filters.priority}
        onValueChange={v => setFilter('priority', v as IssuePriority[])}
      >
        {PRIORITIES.map(p => (
          <ToggleGroupItem key={p} value={p} aria-label={p} className="gap-1.5 text-[12px]">
            <Dot color={PRIORITY_COLOR[p]} />
            {p}
            <span className="tnum text-[11px] text-muted-foreground">
              {count(c => c.priority === p)}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <PeopleFilter cards={cards} />

      <TagFilter cards={cards} />

      <MetaFilter cards={cards} metaKey="codebase" />

      <MetaFilter cards={cards} metaKey="version" />

      {types.length > 1 && (
        <>
          <ToggleGroup
            type="multiple"
            variant="outline"
            size="sm"
            value={filters.type}
            onValueChange={v => setFilter('type', v)}
          >
            {types.map(t => (
              <ToggleGroupItem key={t} value={t} aria-label={t} className="gap-1.5 text-[12px]">
                {t}
                <span className="tnum text-[11px] text-muted-foreground">
                  {count(c => (c.type || 'Other') === t)}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </>
      )}
    </div>
  );
});
