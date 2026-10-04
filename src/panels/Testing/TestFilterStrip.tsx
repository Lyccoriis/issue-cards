import { memo, useMemo } from 'react';
import { Tag as TagIcon, X } from 'lucide-react';

import TagBadge from '@/components/shared/TagBadge';
import UserIdentity from '@/components/shared/UserIdentity';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fallbackColor, tagVar } from '@/lib/tags';
import { Dot } from '@/panels/IssueCards/IssueBits';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  EMPTY_TEST_FILTERS,
  TEST_STATUS_FILTERS,
  TEST_STATUS_LABEL,
  useTestStore,
  visibleFeatures,
  type TestStatusFilter,
} from '@/stores/useTestStore';
import type { TestFeature } from '@/types';

const DOT: Record<TestStatusFilter, string> = {
  mine: 'var(--primary)',
  untested: 'var(--muted-foreground)',
  testing: 'var(--warning)',
  passed: 'var(--success)',
  failing: 'var(--destructive)',
  archived: 'var(--muted-foreground)',
};

export default memo(function TestFilterStrip({ features }: { features: TestFeature[] }) {
  const filters = useTestStore(s => s.filters);
  const setFilter = useTestStore(s => s.setFilter);

  const count = (status: TestStatusFilter) =>
    visibleFeatures({
      features,
      filters: { ...EMPTY_TEST_FILTERS, status: [status] },
      query: '',
      sortKey: 'key',
      sortDir: 1,
    }).length;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-[22px] py-2">
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        value={filters.status}
        onValueChange={v => setFilter('status', v as TestStatusFilter[])}
        className="max-w-full shrink-0"
      >
        {TEST_STATUS_FILTERS.map(s => (
          <ToggleGroupItem
            key={s}
            value={s}
            aria-label={TEST_STATUS_LABEL[s]}
            className="shrink-0 gap-1.5 px-2.5 text-[12px] whitespace-nowrap"
          >
            <Dot color={DOT[s]} />
            {TEST_STATUS_LABEL[s]}
            <span className="tnum text-[11px] text-muted-foreground">{count(s)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <MakerFilter features={features} />
      <VersionFilter features={features} />
    </div>
  );
});

function MakerFilter({ features }: { features: TestFeature[] }) {
  const members = useAuthStore(s => s.members);
  const selected = useTestStore(s => s.filters.person);
  const toggle = useTestStore(s => s.togglePerson);

  const makers = members
    .map(member => ({ member, count: features.filter(f => f.createdBy === member.userId).length }))
    .filter(row => row.count > 0);
  if (makers.length < 2) return null;

  return (
    <div className="flex items-center gap-1">
      {makers.map(({ member, count }) => {
        const on = selected.includes(member.userId);
        return (
          <Tooltip key={member.userId}>
            <TooltipTrigger asChild>
              <span className="flex size-7 items-center justify-center">
                <UserIdentity
                  userId={member.userId}
                  active={on}
                  avatarClassName={`size-6 ${on ? '' : 'opacity-75'}`}
                  action={{
                    label: on ? 'Stop filtering by them' : 'Only their features',
                    run: () => toggle(member.userId),
                  }}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {member.displayName}, {count === 1 ? '1 feature' : `${count} features`}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function VersionFilter({ features }: { features: TestFeature[] }) {
  const active = useTestStore(s => s.filters.version);
  const setFilter = useTestStore(s => s.setFilter);

  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of features) if (f.version) counts.set(f.version, (counts.get(f.version) ?? 0) + 1);
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  }, [features]);
  if (rows.length === 0) return null;

  const toggle = (name: string) =>
    setFilter('version', active.includes(name) ? active.filter(v => v !== name) : [...active, name]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <TagIcon size={15} strokeWidth={1.6} />
            Version
            {active.length > 0 && (
              <span className="tnum text-[11px] text-muted-foreground">{active.length}</span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Filter by version</DropdownMenuLabel>
          <ScrollArea className="max-h-64">
            {rows.map(row => (
              <DropdownMenuCheckboxItem
                key={row.name}
                checked={active.includes(row.name)}
                onSelect={e => e.preventDefault()}
                onCheckedChange={() => toggle(row.name)}
              >
                <span className="dot mr-2" style={{ background: tagVar(fallbackColor(row.name)) }} />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="tnum text-[11px] text-muted-foreground">{row.count}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </ScrollArea>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={active.length === 0} onSelect={() => setFilter('version', [])}>
            <X size={15} strokeWidth={1.6} />
            Clear version filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {active.map(name => (
        <TagBadge
          key={name}
          tag={name}
          color={fallbackColor(name)}
          active
          onRemove={() => toggle(name)}
        />
      ))}
    </div>
  );
}
