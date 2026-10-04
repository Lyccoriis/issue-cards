import { useCallback, useDeferredValue, useEffect, useMemo, useRef } from 'react';
import {
  ArrowDownWideNarrow,
  KanbanSquare,
  Loader2,
  Plus,
  RotateCcw,
  Rows3,
  Search,
  SearchX,
  TableProperties,
} from 'lucide-react';

import PanelShell from '@/components/layout/PanelShell';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore, usePermissions } from '@/stores/useAuthStore';
import { ORDERS, useIssueStore, visibleCards } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useUiStore } from '@/stores/useUiStore';
import type { IssueCard, LayoutState } from '@/types';
import BulkBar from './BulkBar';
import FilterStrip from './FilterStrip';
import IssueBoard from './IssueBoard';
import IssueDetailSheet from './IssueDetailSheet';
import ImportSheetDialog from './ImportSheetDialog';
import IssueFormDialog from './IssueFormDialog';
import IssueTable from './IssueTable';
import StatusDialogs from './StatusDialogs';
import WorkspaceCrest from './WorkspaceCrest';

function sharing(members: number): string {
  const others = Math.max(0, members - 1);
  if (others === 0) return 'not shared yet';
  return others === 1 ? 'shared with 1 other person' : `shared with ${others} other people`;
}

export default function IssueCardsPanel() {
  const workspaceId = useAuthStore(s => s.activeWorkspaceId);
  const workspaceName = useAuthStore(
    s => s.workspaces.find(w => w.id === s.activeWorkspaceId)?.name ?? '',
  );
  const memberCount = useAuthStore(s => s.members.length);
  const can = usePermissions();
  const view = useLayoutStore(s => s.issueView);
  const setView = useLayoutStore(s => s.setIssueView);
  const order = useIssueStore(s => s.order);
  const setOrder = useIssueStore(s => s.setOrder);

  const cards = useIssueStore(s => s.cards);
  const loading = useIssueStore(s => s.loading);
  const query = useIssueStore(s => s.query);
  const filters = useIssueStore(s => s.filters);
  const sortKey = useIssueStore(s => s.sortKey);
  const sortDir = useIssueStore(s => s.sortDir);
  const selectedId = useIssueStore(s => s.selectedId);
  const checkedIds = useIssueStore(s => s.checkedIds);
  const load = useIssueStore(s => s.load);
  const select = useIssueStore(s => s.select);
  const setQuery = useIssueStore(s => s.setQuery);
  const clearFilters = useIssueStore(s => s.clearFilters);
  const clearChecked = useIssueStore(s => s.clearChecked);

  const openForm = useUiStore(s => s.openIssueForm);
  const openImport = useUiStore(s => s.openSheetImport);

  const restored = useRef<string | null>(null);

  useEffect(() => {
    if (!workspaceId || restored.current === workspaceId || loading || cards.length === 0) return;
    restored.current = workspaceId;
    const last = useLayoutStore.getState().lastSelectedIssueId;
    if (last && !selectedId && cards.some(card => card.id === last)) select(last);
  }, [workspaceId, loading, cards, selectedId, select]);

  const listQuery = useDeferredValue(query);
  const shown = useMemo(
    () => visibleCards({ cards, filters, query: listQuery, order, sortKey, sortDir }),
    [cards, filters, listQuery, order, sortKey, sortDir],
  );

  const editCard = useCallback((card: IssueCard) => openForm(card.id), [openForm]);
  const onEdit = can.writeCards ? editCard : undefined;
  const selected = cards.find(c => c.id === selectedId) ?? null;
  const checked = useMemo(() => {
    const wanted = new Set(checkedIds);
    return cards.filter(c => wanted.has(c.id));
  }, [cards, checkedIds]);

  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={() => void load(true)}>
        {loading ? (
          <Loader2 size={15} strokeWidth={1.6} className="animate-spin" />
        ) : (
          <RotateCcw size={15} strokeWidth={1.6} />
        )}
        Refresh
      </Button>
      {can.writeCards && (
        <>
          <Button variant="outline" size="sm" onClick={openImport} disabled={!workspaceId}>
            <TableProperties size={15} strokeWidth={1.6} />
            Import from sheet
          </Button>
          <Button size="sm" onClick={() => openForm(null)} disabled={!workspaceId}>
            <Plus size={15} strokeWidth={1.6} />
            New card
          </Button>
        </>
      )}
    </>
  );

  const topbar = (
    <>
      <div className="flex flex-none items-center gap-2 overflow-hidden border-b border-border px-[22px] py-2">
        <InputGroup className="w-[420px] min-w-[140px] max-w-full shrink">
          <InputGroupAddon>
            <Search size={15} strokeWidth={1.6} />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            placeholder="Search title, description, evidence, location"
            onChange={e => setQuery(e.target.value)}
          />
        </InputGroup>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={order === 'column' ? '' : order}
          onValueChange={v => v && setOrder(v as typeof order)}
        >
          {ORDERS.map(entry => (
            <Tooltip key={entry.key}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={entry.key}
                  aria-label={`order by ${entry.label}`}
                  className="aria-checked:bg-accent aria-checked:text-accent-foreground"
                >
                  {entry.key === 'recent' && <ArrowDownWideNarrow size={15} strokeWidth={1.6} />}
                  {entry.label}
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom">{entry.hint}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={view}
          onValueChange={v => v && setView(v as LayoutState['issueView'])}
        >
          <ToggleGroupItem value="table" aria-label="table view">
            <Rows3 size={15} strokeWidth={1.6} />
            Table
          </ToggleGroupItem>
          <ToggleGroupItem value="board" aria-label="board view">
            <KanbanSquare size={15} strokeWidth={1.6} />
            Board
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <WorkspaceCrest />
          <span className="tnum hidden whitespace-nowrap rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground md:inline-block">
            <span className="lg:hidden">
              {shown.length}/{cards.length}
            </span>
            <span className="hidden lg:inline">
              {shown.length} of {cards.length} shown
            </span>
          </span>
        </div>
      </div>

      {cards.length > 0 && <FilterStrip cards={cards} />}

      {checked.length > 0 && <BulkBar checked={checked} shown={shown} />}
    </>
  );

  return (
    <PanelShell
      title="Issue Cards"
      description={workspaceName ? `${workspaceName}, ${sharing(memberCount)}` : 'No workspace open'}
      actions={actions}
      topbar={topbar}
      scroll={false}
      width={0}
    >
      {cards.length === 0 && loading ? (
        <div className="flex flex-col gap-2 px-[22px] py-3" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[38px] w-full" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KanbanSquare size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>No issue cards</EmptyTitle>
            <EmptyDescription>
              {can.writeCards
                ? 'Everyone in this workspace sees the same cards. File the first one here.'
                : 'Nothing has been filed here yet. Your role in this workspace reads the cards, it does not write them.'}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {can.writeCards && (
              <>
                <Button size="sm" onClick={() => openForm(null)} disabled={!workspaceId}>
                  <Plus size={15} strokeWidth={1.6} />
                  New card
                </Button>
                <Button variant="outline" size="sm" onClick={openImport} disabled={!workspaceId}>
                  <TableProperties size={15} strokeWidth={1.6} />
                  Import from sheet
                </Button>
              </>
            )}
          </EmptyContent>
        </Empty>
      ) : shown.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX size={15} strokeWidth={1.6} />
            </EmptyMedia>
            <EmptyTitle>No cards match</EmptyTitle>
            <EmptyDescription>
              The search and the filter chips above are hiding all {cards.length} cards.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ScrollArea className="h-full">
          {view === 'table' ? (
            <IssueTable cards={shown} onEdit={onEdit} />
          ) : (
            <IssueBoard cards={shown} onEdit={onEdit} />
          )}
        </ScrollArea>
      )}

      <IssueDetailSheet card={selected} onEdit={editCard} />
      <IssueFormDialog />
      <ImportSheetDialog />
      <StatusDialogs />
    </PanelShell>
  );
}
