import { useMemo } from 'react';
import { Boxes, Tag as TagIcon, X } from 'lucide-react';

import TagBadge from '@/components/shared/TagBadge';
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
import { fallbackColor, metaRows, sameTag, tagVar, type MetaKey } from '@/lib/tags';
import { useIssueStore } from '@/stores/useIssueStore';
import type { IssueCard } from '@/types';

const LABEL: Record<MetaKey, string> = { codebase: 'Codebase', version: 'Version' };

interface MetaFilterProps {
  cards: IssueCard[];
  metaKey: MetaKey;
}

export default function MetaFilter({ cards, metaKey }: MetaFilterProps) {
  const active = useIssueStore(s => s.filters[metaKey]);
  const toggleMeta = useIssueStore(s => s.toggleMeta);
  const setFilter = useIssueStore(s => s.setFilter);

  const rows = useMemo(() => metaRows(cards, metaKey), [cards, metaKey]);
  if (rows.length === 0) return null;

  const Icon = metaKey === 'codebase' ? Boxes : TagIcon;
  const isOn = (name: string) => active.some(v => sameTag(v, name));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Icon size={15} strokeWidth={1.6} />
            {LABEL[metaKey]}
            {active.length > 0 && (
              <span className="tnum text-[11px] text-muted-foreground">{active.length}</span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Filter by {metaKey}</DropdownMenuLabel>

          <ScrollArea className="max-h-64">
            {rows.map(row => (
              <DropdownMenuCheckboxItem
                key={row.name}
                checked={isOn(row.name)}
                onSelect={e => e.preventDefault()}
                onCheckedChange={() => toggleMeta(metaKey, row.name)}
              >
                <span className="dot mr-2" style={{ background: tagVar(row.color) }} />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="tnum text-[11px] text-muted-foreground">{row.count}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </ScrollArea>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled={active.length === 0} onSelect={() => setFilter(metaKey, [])}>
            <X size={15} strokeWidth={1.6} />
            Clear {metaKey} filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {active.map(name => (
        <TagBadge
          key={name}
          tag={name}
          color={fallbackColor(name)}
          active
          onRemove={() => toggleMeta(metaKey, name)}
        />
      ))}
    </div>
  );
}
