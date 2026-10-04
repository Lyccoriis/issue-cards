import { memo, useMemo } from 'react';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

import UserIdentity from '@/components/shared/UserIdentity';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { countSteps, featureStatus, needsTester } from '@/lib/tests';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTestStore, type TestSortKey } from '@/stores/useTestStore';
import type { TestFeature } from '@/types';
import { StatusChip } from './TestBits';

interface Column {
  key: TestSortKey | null;
  label: string;
  className: string;
}

const COLUMNS: Column[] = [
  { key: 'key', label: 'ID', className: 'w-[120px] pl-3 pr-2' },
  { key: 'status', label: 'Status', className: 'w-[124px] px-1' },
  { key: 'title', label: 'Title', className: 'w-auto px-3' },
  { key: 'version', label: 'Version', className: 'w-[90px] px-2' },
  { key: null, label: 'Progress', className: 'w-[150px] px-3' },
  { key: null, label: 'Made by', className: 'w-[170px] px-3' },
  { key: 'updated', label: 'Updated', className: 'w-[104px] px-3' },
];

const ROW_HEIGHT = 'h-[46px]';

export default function FeatureTable({ features }: { features: TestFeature[] }) {
  const sortKey = useTestStore(s => s.sortKey);
  const sortDir = useTestStore(s => s.sortDir);
  const selectedId = useTestStore(s => s.selectedId);
  const notes = useTestStore(s => s.notes);
  const setSort = useTestStore(s => s.setSort);
  const myId = useAuthStore(s => s.profile?.id ?? null);

  const noteCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      if (note.featureId) counts.set(note.featureId, (counts.get(note.featureId) ?? 0) + 1);
    }
    return counts;
  }, [notes]);

  return (
    <Table className="table-fixed text-[13px]">
      <TableHeader>
        <TableRow>
          {COLUMNS.map(({ key, label, className }) => (
            <TableHead
              key={label}
              onClick={key ? () => setSort(key) : undefined}
              className={`sticky top-0 z-10 bg-card text-[11px] font-normal uppercase tracking-wide text-muted-foreground/70 ${
                key ? 'cursor-pointer hover:text-foreground' : ''
              } ${className}`}
            >
              <span className="inline-flex items-center gap-1">
                {label}
                {key !== null &&
                  sortKey === key &&
                  (sortDir > 0 ? (
                    <ChevronUp size={15} strokeWidth={1.6} />
                  ) : (
                    <ChevronDown size={15} strokeWidth={1.6} />
                  ))}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {features.map(feature => (
          <Row
            key={feature.id}
            feature={feature}
            selected={selectedId === feature.id}
            waiting={myId !== null && needsTester(feature, myId)}
            notes={noteCount.get(feature.id) ?? 0}
          />
        ))}
      </TableBody>
    </Table>
  );
}

interface RowProps {
  feature: TestFeature;
  selected: boolean;
  waiting: boolean;
  notes: number;
}

const Row = memo(function Row({ feature, selected, waiting, notes }: RowProps) {
  const select = useTestStore(s => s.select);
  const status = featureStatus(feature);
  const { total, passed, failed } = countSteps(feature);
  const cell = (index: number) => COLUMNS[index].className;

  return (
    <TableRow
      onClick={() => select(feature.id)}
      data-state={selected ? 'selected' : undefined}
      className={`group cursor-pointer ${ROW_HEIGHT}`}
    >
      <TableCell className={`mono py-0 text-[12px] text-muted-foreground ${cell(0)}`}>
        <span className="flex items-center gap-1.5">
          <span className="flex w-2 shrink-0 justify-center">
            {waiting && (
              <span
                className="dot pulse"
                style={{ background: 'var(--success)' }}
                title="Waiting on your answer"
              />
            )}
          </span>
          <span className="shrink-0">{feature.key}</span>
        </span>
      </TableCell>
      <TableCell className={`py-0 ${cell(1)}`}>
        <span className="flex items-center gap-1.5">
          <StatusChip status={status} />
          {feature.round > 1 && (
            <span className="tnum text-[11px] text-muted-foreground" title={`Round ${feature.round}`}>
              r{feature.round}
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className={`overflow-hidden py-0 ${cell(2)}`}>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={feature.title}>
            {feature.title}
          </span>
          {notes > 0 && (
            <span
              className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground/70"
              title={`${notes} ${notes === 1 ? 'note' : 'notes'}`}
            >
              <MessageSquare size={15} strokeWidth={1.6} />
              <span className="tnum">{notes}</span>
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={`py-0 ${cell(3)}`}>
        {feature.version && (
          <Badge variant="outline" className="max-w-full truncate text-muted-foreground">
            {feature.version}
          </Badge>
        )}
      </TableCell>
      <TableCell className={`py-0 ${cell(4)}`}>
        <div className="flex items-center gap-2" title={`${passed} passed, ${failed} failed, ${total} steps`}>
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            {total > 0 && (
              <>
                <span style={{ width: `${(passed / total) * 100}%`, background: 'var(--success)' }} />
                <span style={{ width: `${(failed / total) * 100}%`, background: 'var(--destructive)' }} />
              </>
            )}
          </div>
          <span className="tnum mono text-[11px] text-muted-foreground">
            {passed}/{total}
          </span>
        </div>
      </TableCell>
      <TableCell className={`overflow-hidden py-0 ${cell(5)}`}>
        <div onClick={e => e.stopPropagation()} className="w-fit max-w-full">
          <UserIdentity userId={feature.createdBy} name={feature.createdByName} showName />
        </div>
      </TableCell>
      <TableCell className={`mono py-0 text-[11.5px] text-muted-foreground ${cell(6)}`}>
        {feature.updatedAt.slice(0, 10)}
      </TableCell>
    </TableRow>
  );
});
