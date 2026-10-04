import {
  Fragment,
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { ChevronDown, ChevronUp, FlaskConical, MessageSquare, RotateCcw } from 'lucide-react';

import TagBadge from '@/components/shared/TagBadge';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ageDays,
  dueInDays,
  formatAge,
  rejectionCount,
  useIssueStore,
  type SortKey,
} from '@/stores/useIssueStore';
import { useIsNew } from '@/stores/useSeenStore';
import type { IssueCard } from '@/types';
import {
  AuthorDot,
  PriorityBadge,
  StatusBadge,
  isStale,
  useMetaItems,
  type BadgeItem,
} from './IssueBits';
import IssueContextMenu from './IssueContextMenu';

interface Column {
  key: SortKey | null;
  label: string;
  className: string;
}

const COLUMNS: Column[] = [
  { key: 'id', label: 'ID', className: 'w-[140px] pl-2 pr-2' },
  { key: 'priority', label: 'Priority', className: 'w-[76px] px-1' },
  { key: 'status', label: 'Status', className: 'w-[124px] px-1' },
  { key: 'type', label: 'Type', className: 'w-[84px] pl-1 pr-4' },
  { key: 'title', label: 'Title', className: 'w-auto px-3' },
  { key: null, label: 'Tags', className: 'w-[320px] px-3' },
  { key: 'timeOpened', label: 'Opened', className: 'w-[104px] pl-3 pr-3' },
];

const ROW_HEIGHT = 'h-[46px]';
const ROW_PX = 46;
const OVERSCAN = 12;

interface IssueTableProps {
  cards: IssueCard[];
  onEdit?: (card: IssueCard) => void;
}

export default function IssueTable({ cards, onEdit }: IssueTableProps) {
  const order = useIssueStore(s => s.order);
  const sortKey = useIssueStore(s => s.sortKey);
  const sortDir = useIssueStore(s => s.sortDir);
  const selectedId = useIssueStore(s => s.selectedId);
  const checkedIds = useIssueStore(s => s.checkedIds);
  const tagFilter = useIssueStore(s => s.filters.tag);
  const setSort = useIssueStore(s => s.setSort);
  const setChecked = useIssueStore(s => s.setChecked);

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const allChecked = cards.length > 0 && cards.every(c => checkedSet.has(c.id));

  const body = useRef<HTMLTableSectionElement>(null);
  const [range, setRange] = useState({ start: 0, end: 40 });

  useLayoutEffect(() => {
    const el = body.current;
    const viewport = el?.closest<HTMLElement>('[data-slot=scroll-area-viewport]');
    if (!el || !viewport) return;

    const update = () => {
      const top =
        viewport.scrollTop -
        (el.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop);
      const start = Math.max(0, Math.floor(top / ROW_PX) - OVERSCAN);
      const end = Math.ceil((top + viewport.clientHeight) / ROW_PX) + OVERSCAN;
      setRange(r => (r.start === start && r.end === end ? r : { start, end }));
    };

    update();
    viewport.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => {
      viewport.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [cards.length]);

  const end = Math.min(range.end, cards.length);
  const start = Math.min(range.start, end);

  return (
    <Table className="table-fixed text-[13px]">
      <TableHeader>
        <TableRow>
          <TableHead className="sticky top-0 z-10 w-9 bg-card pl-3 pr-0">
            <Checkbox
              checked={allChecked}
              aria-label="select all shown"
              onCheckedChange={on => setChecked(on ? cards.map(c => c.id) : [])}
            />
          </TableHead>
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
                {order === 'column' &&
                  key !== null &&
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
      <TableBody ref={body}>
        {start > 0 && <Spacer height={start * ROW_PX} />}
        {cards.slice(start, end).map(card => (
          <Row
            key={card.id}
            card={card}
            selected={selectedId === card.id}
            checked={checkedSet.has(card.id)}
            tagFilter={tagFilter}
            onEdit={onEdit}
          />
        ))}
        {end < cards.length && <Spacer height={(cards.length - end) * ROW_PX} />}
      </TableBody>
    </Table>
  );
}

function Spacer({ height }: { height: number }) {
  return (
    <tr aria-hidden>
      <td colSpan={COLUMNS.length + 1} className="border-0 p-0" style={{ height }} />
    </tr>
  );
}

interface RowProps {
  card: IssueCard;
  selected: boolean;
  checked: boolean;
  tagFilter: string[];
  onEdit?: (card: IssueCard) => void;
}

const Row = memo(function Row({ card, selected, checked, tagFilter, onEdit }: RowProps) {
  const select = useIssueStore(s => s.select);
  const toggleChecked = useIssueStore(s => s.toggleChecked);
  const toggleTag = useIssueStore(s => s.toggleTag);
  const fresh = useIsNew(card);
  const rejects = rejectionCount(card);

  const isTagOn = (tag: string) => tagFilter.some(t => t.toLowerCase() === tag.toLowerCase());

  const meta = useMetaItems(card);
  const badges: BadgeItem[] = [
    ...meta,
    ...card.tags.map(tag => ({
      key: `tag:${tag}`,
      node: <TagBadge tag={tag} active={isTagOn(tag)} onClick={() => toggleTag(tag)} />,
    })),
  ];

  const cell = (index: number) => COLUMNS[index].className;

  return (
    <IssueContextMenu card={card} onEdit={onEdit}>
      <TableRow
        onClick={() => select(card.id)}
        data-state={selected ? 'selected' : undefined}
        className={`group cursor-pointer ${ROW_HEIGHT}`}
      >
        <TableCell className="w-9 py-0 pl-3 pr-0" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={checked}
            aria-label={`select ${card.id}`}
            onCheckedChange={() => toggleChecked(card.id)}
            className={
              checked
                ? ''
                : 'opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100'
            }
          />
        </TableCell>
        <TableCell className={`mono py-0 text-[12px] text-muted-foreground ${cell(0)}`}>
          <span className="flex items-center gap-1.5">
            <span className="flex w-2 shrink-0 justify-center">
              {fresh && (
                <span
                  className="dot pulse"
                  style={{ background: 'var(--success)' }}
                  title="Something happened on this card since you last opened it"
                />
              )}
            </span>
            <AuthorDot card={card} />
            <span className="shrink-0">{card.id}</span>
          </span>
        </TableCell>
        <TableCell className={`py-0 ${cell(1)}`}>
          <PriorityBadge priority={card.priority} />
        </TableCell>
        <TableCell className={`py-0 ${cell(2)}`}>
          <span className="flex items-center gap-1.5">
            <StatusBadge status={card.status} />
            {rejects > 0 && (
              <span
                className="flex items-center gap-0.5 text-[11px] text-destructive"
                title={`The fix was rejected ${rejects} ${rejects === 1 ? 'time' : 'times'}`}
              >
                <RotateCcw size={15} strokeWidth={1.6} />
                <span className="tnum">{rejects}</span>
              </span>
            )}
          </span>
        </TableCell>
        <TableCell className={`py-0 ${cell(3)}`}>
          <Badge
            variant="outline"
            className="max-w-full truncate text-muted-foreground opacity-80 transition-opacity duration-150 group-hover:opacity-100"
          >
            {card.type || 'Other'}
          </Badge>
        </TableCell>
        <TableCell className={`overflow-hidden py-0 ${cell(4)}`}>
          <div className="flex items-center gap-2">
            <Marquee text={card.title} />
            {card.location && (
              <span className="path max-w-[30%] shrink-0 truncate opacity-70">{card.location}</span>
            )}
            {card.testRef && (
              <span
                className="flex shrink-0 items-center text-muted-foreground/70"
                title={`Filed by a test, ${card.testRef}`}
              >
                <FlaskConical size={15} strokeWidth={1.6} />
              </span>
            )}
            {card.comments.length > 0 && (
              <span
                className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground/70"
                title={`${card.comments.length} ${card.comments.length === 1 ? 'note' : 'notes'}`}
              >
                <MessageSquare size={15} strokeWidth={1.6} />
                <span className="tnum">{card.comments.length}</span>
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className={`overflow-hidden py-0 ${cell(5)}`}>
          <BadgeStrip items={badges} />
        </TableCell>
        <TableCell className={`py-0 ${cell(6)}`}>
          <TimeCell card={card} />
        </TableCell>
      </TableRow>
    </IssueContextMenu>
  );
});

function TimeCell({ card }: { card: IssueCard }) {
  const age = ageDays(card);
  const left = dueInDays(card);
  const live = card.status === 'open' || card.status === 'fixed';
  const due = live && left !== null && left <= 7 ? left : null;

  return (
    <div className="mono flex flex-col gap-1 overflow-hidden whitespace-nowrap leading-none">
      <span className="text-[11.5px] text-muted-foreground">{card.timeOpened.slice(0, 10)}</span>
      <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground/60">
        {age !== null && <span className="tnum">{formatAge(age)}</span>}
        {due !== null && due < 0 && (
          <span className="tnum text-destructive">over {Math.ceil(-due)}d</span>
        )}
        {due !== null && due >= 0 && (
          <span className="tnum text-warning">due {Math.ceil(due)}d</span>
        )}
        {due === null && isStale(card) && <span>stale</span>}
      </span>
    </div>
  );
}

function BadgeStrip({ items }: { items: BadgeItem[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(items.length);

  const signature = items.map(item => item.key).join('|');

  useLayoutEffect(() => {
    setShown(items.length);
  }, [signature, items.length]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || shown === 0) return;
    if (el.scrollWidth > el.clientWidth + 1) setShown(shown - 1);
  });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setShown(items.length));
    observer.observe(el);
    return () => observer.disconnect();
  }, [signature, items.length]);

  const hidden = items.slice(shown);

  return (
    <div
      ref={box}
      className="flex w-full items-center gap-1.5 overflow-hidden opacity-80 transition-opacity duration-150 group-hover:opacity-100"
    >
      {items.slice(0, shown).map(item => (
        <span key={item.key} className="shrink-0">
          {item.node}
        </span>
      ))}
      {hidden.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Badge variant="secondary" className="shrink-0 cursor-pointer" asChild>
              <button type="button" title="The rest of the tags" onClick={e => e.stopPropagation()}>
                +{hidden.length}
              </button>
            </Badge>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-auto max-w-[280px] p-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-wrap gap-1.5">
              {hidden.map(item => (
                <Fragment key={item.key}>{item.node}</Fragment>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

const MARQUEE_PX_PER_SECOND = 26;

function Marquee({ text }: { text: string }) {
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    const span = line.current;
    if (!el || !span) return;

    const measure = () => {
      const over = span.scrollWidth - el.clientWidth;
      setShift(over > 2 ? over : 0);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const seconds = Math.max(6, Math.round((shift / MARQUEE_PX_PER_SECOND) * 3));

  return (
    <div
      ref={box}
      className="min-w-0 flex-1 overflow-hidden font-medium text-foreground"
      title={text}
    >
      <span
        ref={line}
        className={shift > 0 ? 'marquee' : 'block truncate'}
        style={
          shift > 0
            ? ({
                '--marquee-shift': `${-shift}px`,
                '--marquee-time': `${seconds}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
