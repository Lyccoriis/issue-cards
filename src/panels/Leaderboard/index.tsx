import { useMemo, useState } from 'react';
import { ChevronDown, Medal, TableProperties, Trophy } from 'lucide-react';

import PanelShell from '@/components/layout/PanelShell';
import DatePicker from '@/components/shared/DatePicker';
import UserIdentity from '@/components/shared/UserIdentity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DEFAULT_RANK,
  EMPTY_RANGE,
  WEIGHTS,
  didAnything,
  lastDays,
  progress,
  rank,
  tally,
  thisMonth,
  type Range,
  type RankKey,
} from '@/lib/leaderboard';
import { useAuthStore } from '@/stores/useAuthStore';
import { isFromSheet, useIssueStore } from '@/stores/useIssueStore';
import StatusProgress from './StatusProgress';
import TestBoard from './TestBoard';

const QUICK: { label: string; range: () => Range }[] = [
  { label: 'All time', range: () => EMPTY_RANGE },
  { label: 'Last 7 days', range: () => lastDays(7) },
  { label: 'Last 30 days', range: () => lastDays(30) },
  { label: 'This month', range: thisMonth },
];

const COLUMNS: { key: RankKey; label: string; note: string }[] = [
  { key: 'filed', label: 'Filed', note: `cards they wrote, worth ${WEIGHTS.filed} each` },
  { key: 'fixed', label: 'Fixed', note: `fixes that held, worth ${WEIGHTS.fixed} each` },
  { key: 'closed', label: 'Resolved', note: `cards they closed off, worth ${WEIGHTS.closed} each` },
  {
    key: 'rejectionsGiven',
    label: 'Handed back',
    note: `fixes they rejected, worth ${WEIGHTS.rejectionGiven} each, checking is work`,
  },
  {
    key: 'rejectionsTaken',
    label: 'Bounced',
    note: `their own fixes that were rejected, ${WEIGHTS.rejectionTaken} each`,
  },
];

const PLACE_COLOR = ['var(--warning)', 'var(--muted-foreground)', 'var(--chart-5)'];

export default function LeaderboardPanel() {
  const cards = useIssueStore(s => s.cards);
  const members = useAuthStore(s => s.members);
  const workspaceName = useAuthStore(
    s => s.workspaces.find(w => w.id === s.activeWorkspaceId)?.name ?? '',
  );

  const [range, setRange] = useState<Range>(EMPTY_RANGE);
  const [by, setBy] = useState<RankKey>(DEFAULT_RANK);

  const rows = useMemo(
    () => rank(tally(cards, members, range), by),
    [cards, members, range, by],
  );
  const bars = useMemo(() => progress(cards, range), [cards, range]);
  const fromSheet = useMemo(() => cards.filter(isFromSheet).length, [cards]);

  const active = rows.filter(didAnything);
  const best = active.length ? Math.max(...active.map(r => r.score), 1) : 1;

  const window =
    range.from || range.to
      ? `${range.from || 'the start'} to ${range.to || 'today'}`
      : 'everything, from the first card on';

  const actions = (
    <>
      {QUICK.map(quick => (
        <Button key={quick.label} variant="outline" size="sm" onClick={() => setRange(quick.range())}>
          {quick.label}
        </Button>
      ))}
    </>
  );

  return (
    <PanelShell
      title="Leaderboard"
      description={workspaceName ? `${workspaceName}, ${window}` : 'No workspace open'}
      actions={actions}
      width={1200}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <span className="text-[12px] text-muted-foreground">From</span>
            <DatePicker
              value={range.from}
              onChange={from => setRange(r => ({ ...r, from }))}
              placeholder="The first card"
            />
          </div>
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <span className="text-[12px] text-muted-foreground">To</span>
            <DatePicker
              value={range.to}
              onChange={to => setRange(r => ({ ...r, to }))}
              placeholder="Today"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Where the pile stands</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusProgress progress={bars} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <CardTitle>Who did what</CardTitle>
            {fromSheet > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                    <TableProperties size={15} strokeWidth={1.6} />
                    {fromSheet} from the sheet, not counted
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[320px]">
                  Cards brought over from the shared bug sheet were not filed by anyone here, so
                  they are out of Filed. A fix or a close on one afterwards still counts.
                </TooltipContent>
              </Tooltip>
            )}
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Trophy size={15} strokeWidth={1.6} />
                  </EmptyMedia>
                  <EmptyTitle>Nothing happened in this window</EmptyTitle>
                  <EmptyDescription>
                    Widen the dates, or pick All time, and the board fills in.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]" />
                    <TableHead>Person</TableHead>
                    {COLUMNS.map(column => (
                      <TableHead key={column.key} className="text-right">
                        <RankHead column={column} by={by} onPick={setBy} />
                      </TableHead>
                    ))}
                    <TableHead className="w-[180px] text-right">
                      <RankHead
                        column={{
                          key: 'score',
                          label: 'Score',
                          note: 'Everything above, with the weights applied',
                        }}
                        by={by}
                        onPick={setBy}
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.map((row, index) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        {index < 3 ? (
                          <Medal size={15} strokeWidth={1.6} style={{ color: PLACE_COLOR[index] }} />
                        ) : (
                          <span className="tnum text-[12px] text-muted-foreground">{index + 1}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <UserIdentity
                          userId={row.userId}
                          name={row.name}
                          showName
                          avatarClassName="size-6"
                        />
                      </TableCell>
                      {COLUMNS.map(column => (
                        <TableCell key={column.key} className="tnum text-right">
                          <span
                            className={
                              column.key === 'rejectionsTaken' && row.rejectionsTaken > 0
                                ? 'text-destructive'
                                : row[column.key] === 0
                                  ? 'text-muted-foreground'
                                  : ''
                            }
                          >
                            {row[column.key]}
                          </span>
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-2">
                          <span className="h-1.5 w-[90px] overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(0, (row.score / best) * 100)}%` }}
                            />
                          </span>
                          <span className="tnum w-10 text-right font-medium">{row.score}</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <TestBoard range={range} />
      </div>
    </PanelShell>
  );
}

function RankHead({
  column,
  by,
  onPick,
}: {
  column: { key: RankKey; label: string; note: string };
  by: RankKey;
  onPick: (key: RankKey) => void;
}) {
  const on = by === column.key;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => onPick(column.key)}
          className={`inline-flex items-center gap-1 ${
            on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {column.label}
          <ChevronDown
            size={15}
            strokeWidth={1.6}
            className={on ? '' : 'opacity-0'}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {column.note}
        {!on && '. Click to rank by this'}
      </TooltipContent>
    </Tooltip>
  );
}
