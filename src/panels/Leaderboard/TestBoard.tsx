import { useMemo, useState } from 'react';
import { ChevronDown, FlaskConical, Medal } from 'lucide-react';

import UserIdentity from '@/components/shared/UserIdentity';
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
  TEST_WEIGHTS,
  rankTests,
  tallyTests,
  testedAnything,
  type Range,
  type TestRankKey,
} from '@/lib/leaderboard';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTestStore } from '@/stores/useTestStore';

const COLUMNS: { key: TestRankKey; label: string; note: string }[] = [
  { key: 'written', label: 'Written', note: `test lists they wrote, worth ${TEST_WEIGHTS.written} each` },
  { key: 'passed', label: 'Passed', note: `steps they ran and saw work, worth ${TEST_WEIGHTS.passed} each` },
  { key: 'broke', label: 'Broke', note: `steps they ran and found broken, worth ${TEST_WEIGHTS.broke} each` },
];

const PLACE_COLOR = ['var(--warning)', 'var(--muted-foreground)', 'var(--chart-5)'];

export default function TestBoard({ range }: { range: Range }) {
  const features = useTestStore(s => s.features);
  const members = useAuthStore(s => s.members);
  const [by, setBy] = useState<TestRankKey>('passed');

  const rows = useMemo(
    () => rankTests(tallyTests(features, members, range), by).filter(testedAnything),
    [features, members, range, by],
  );
  const best = rows.length ? Math.max(...rows.map(r => r.score), 1) : 1;

  const heads = [...COLUMNS, { key: 'score' as const, label: 'Score', note: 'Everything above, with the weights applied' }];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who tested</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FlaskConical size={15} strokeWidth={1.6} />
              </EmptyMedia>
              <EmptyTitle>No test steps answered in this window</EmptyTitle>
              <EmptyDescription>
                Run a step in Testing, or widen the dates, and the board fills in.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Person</TableHead>
                {heads.map(column => (
                  <TableHead
                    key={column.key}
                    className={column.key === 'score' ? 'w-[180px] text-right' : 'text-right'}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-pressed={by === column.key}
                          onClick={() => setBy(column.key)}
                          className={`inline-flex items-center gap-1 ${
                            by === column.key
                              ? 'text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {column.label}
                          <ChevronDown
                            size={15}
                            strokeWidth={1.6}
                            className={by === column.key ? '' : 'opacity-0'}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {column.note}
                        {by !== column.key && '. Click to rank by this'}
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
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
                      <span className={row[column.key] === 0 ? 'text-muted-foreground' : ''}>
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
  );
}
