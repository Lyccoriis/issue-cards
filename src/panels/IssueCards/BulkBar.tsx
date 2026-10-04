import { useMemo, useState } from 'react';
import {
  Boxes,
  CalendarDays,
  CheckSquare,
  Copy,
  FileType2,
  GitBranch,
  Loader2,
  MailOpen,
  Plus,
  SignalHigh,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import DatePicker from '@/components/shared/DatePicker';
import ValueInput from '@/components/shared/ValueInput';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { errorText } from '@/lib/supabase';
import { cardHasTag, dedupe, metaRows, sameTag, tagRows, tagVar } from '@/lib/tags';
import { usePermissions } from '@/stores/useAuthStore';
import { PRIORITIES, useIssueStore } from '@/stores/useIssueStore';
import { useSeenStore } from '@/stores/useSeenStore';
import { ensureTags, useTags } from '@/stores/useTagStore';
import { ISSUE_TYPES, type IssueCard, type IssueCardPatch, type IssuePriority } from '@/types';
import TagDialog from './TagDialog';

interface BulkBarProps {
  checked: IssueCard[];
  shown: IssueCard[];
}

export default function BulkBar({ checked, shown }: BulkBarProps) {
  const cards = useIssueStore(s => s.cards);
  const update = useIssueStore(s => s.update);
  const setChecked = useIssueStore(s => s.setChecked);
  const clearChecked = useIssueStore(s => s.clearChecked);
  const remove = useIssueStore(s => s.remove);
  const markSeen = useSeenStore(s => s.markSeen);
  const can = usePermissions();
  const tags = useTags();

  const [busy, setBusy] = useState(false);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [codebase, setCodebase] = useState('');
  const [version, setVersion] = useState('');
  const [due, setDue] = useState('');

  const rows = useMemo(() => tagRows(tags, cards), [tags, cards]);
  const codebases = useMemo(() => metaRows(cards, 'codebase').map(row => row.name), [cards]);
  const versions = useMemo(() => metaRows(cards, 'version').map(row => row.name), [cards]);

  const count = checked.length;
  const onAll = (name: string) => checked.every(card => cardHasTag(card, name));
  const onSome = (name: string) => checked.some(card => cardHasTag(card, name));

  const priority = useMemo(() => {
    const first = checked[0]?.priority;
    return checked.every(card => card.priority === first) ? first : undefined;
  }, [checked]);

  const type = useMemo(() => {
    const first = checked[0]?.type || 'Other';
    return checked.every(card => (card.type || 'Other') === first) ? first : undefined;
  }, [checked]);

  async function applyAll(patch: (card: IssueCard) => IssueCardPatch, done: string) {
    setBusy(true);
    try {
      await Promise.all(checked.map(card => update(card.id, patch(card))));
      toast.success(done);
    } catch (err) {
      toast.error(errorText(err));
    }
    setBusy(false);
  }

  async function setTagOnAll(name: string, on: boolean) {
    if (on) await ensureTags([name]);
    await applyAll(
      card => ({
        tags: on
          ? dedupe([...card.tags, name])
          : card.tags.filter(tag => !sameTag(tag, name)),
      }),
      `${name} ${on ? 'added to' : 'taken off'} ${count} card${count === 1 ? '' : 's'}`,
    );
  }

  async function setMetaOnAll(key: 'codebase' | 'version', value: string) {
    const clean = value.trim();
    await applyAll(() => ({ [key]: clean }) as IssueCardPatch, `${key} set on ${count} cards`);
  }

  async function deleteChecked() {
    setBusy(true);
    try {
      await Promise.all(checked.map(card => remove(card.id)));
      clearChecked();
      toast.success(`${count} card${count === 1 ? '' : 's'} deleted`);
    } catch (err) {
      toast.error(errorText(err));
    }
    setBusy(false);
  }

  async function markChecked() {
    setBusy(true);
    try {
      await markSeen(checked.map(card => card.id));
      toast.success(`${count} card${count === 1 ? '' : 's'} marked read`);
    } catch (err) {
      toast.error(errorText(err));
    }
    setBusy(false);
  }

  async function copyIds() {
    await navigator.clipboard.writeText(checked.map(card => card.id).join(', '));
    toast.success(`${count} ids copied`);
  }

  const allShownChecked = checked.length === shown.length;

  return (
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border bg-accent/30 px-[22px] py-2">
      <span className="tnum flex items-center gap-1.5 text-[12px]">
        {busy && <Loader2 size={15} strokeWidth={1.6} className="animate-spin" />}
        {count} selected
      </span>

      <Button
        variant="ghost"
        size="sm"
        disabled={busy || allShownChecked}
        onClick={() => setChecked(shown.map(card => card.id))}
      >
        <CheckSquare size={15} strokeWidth={1.6} />
        Select all {shown.length} shown
      </Button>

      {can.writeCards && (
        <>
          <Separator orientation="vertical" className="h-5" />

          <DropdownMenu open={tagMenuOpen} onOpenChange={setTagMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <Tags size={15} strokeWidth={1.6} />
                Tags
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Tag all {count} selected</DropdownMenuLabel>

              {rows.length === 0 ? (
                <p className="px-2 py-3 text-[12px] text-muted-foreground">
                  No tags yet. Make the first one below.
                </p>
              ) : (
                <ScrollArea className="max-h-64">
                  {rows.map(row => (
                    <DropdownMenuCheckboxItem
                      key={row.name}
                      checked={onAll(row.name)}
                      onSelect={e => e.preventDefault()}
                      onCheckedChange={on => void setTagOnAll(row.name, on)}
                    >
                      <span className="dot mr-2" style={{ background: tagVar(row.color) }} />
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      {!onAll(row.name) && onSome(row.name) && (
                        <span className="text-[11px] text-muted-foreground">on some</span>
                      )}
                    </DropdownMenuCheckboxItem>
                  ))}
                </ScrollArea>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setTagMenuOpen(false);
                  setTagDialogOpen(true);
                }}
              >
                <Plus size={15} strokeWidth={1.6} />
                New tag on all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <MetaPopover
            label="Codebase"
            icon={<Boxes size={15} strokeWidth={1.6} />}
            value={codebase}
            onChange={setCodebase}
            suggestions={codebases}
            placeholder="Loconautics"
            busy={busy}
            count={count}
            onApply={() => void setMetaOnAll('codebase', codebase)}
            onClear={() => void setMetaOnAll('codebase', '')}
          />

          <MetaPopover
            label="Version"
            icon={<GitBranch size={15} strokeWidth={1.6} />}
            value={version}
            onChange={setVersion}
            suggestions={versions}
            placeholder="0.18"
            busy={busy}
            count={count}
            onApply={() => void setMetaOnAll('version', version)}
            onClear={() => void setMetaOnAll('version', '')}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <SignalHigh size={15} strokeWidth={1.6} />
                Priority
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Priority on all {count}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={priority ?? ''}
                onValueChange={v =>
                  void applyAll(
                    () => ({ priority: v as IssuePriority }),
                    `${count} cards set to ${v}`,
                  )
                }
              >
                {PRIORITIES.map(p => (
                  <DropdownMenuRadioItem key={p} value={p} className="capitalize">
                    {p}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <FileType2 size={15} strokeWidth={1.6} />
                Type
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Type on all {count}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={type ?? ''}
                onValueChange={v => void applyAll(() => ({ type: v }), `${count} cards set to ${v}`)}
              >
                {ISSUE_TYPES.map(t => (
                  <DropdownMenuRadioItem key={t} value={t}>
                    {t}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <CalendarDays size={15} strokeWidth={1.6} />
                Due date
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-72 flex-col gap-2">
              <p className="text-[12px] text-muted-foreground">Due date on all {count} selected.</p>
              <DatePicker value={due} onChange={setDue} />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={busy || !due}
                  onClick={() => void applyAll(() => ({ dueDate: due }), `Due date set on ${count} cards`)}
                >
                  Apply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void applyAll(() => ({ dueDate: '' }), `Due date cleared on ${count} cards`)}
                >
                  Clear on all
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}

      <Separator orientation="vertical" className="h-5" />

      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void markChecked()}>
        <MailOpen size={15} strokeWidth={1.6} />
        Mark read
      </Button>

      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void copyIds()}>
        <Copy size={15} strokeWidth={1.6} />
        Copy ids
      </Button>

      {can.deleteCards && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void deleteChecked()}>
          <Trash2 size={15} strokeWidth={1.6} />
          Delete
        </Button>
      )}

      <Button variant="ghost" size="sm" className="ml-auto" onClick={clearChecked}>
        <X size={15} strokeWidth={1.6} />
        Clear
      </Button>

      <TagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        onCreated={tag => void setTagOnAll(tag.name, true)}
      />
    </div>
  );
}

interface MetaPopoverProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
  busy: boolean;
  count: number;
  onApply: () => void;
  onClear: () => void;
}

function MetaPopover({
  label,
  icon,
  value,
  onChange,
  suggestions,
  placeholder,
  busy,
  count,
  onApply,
  onClear,
}: MetaPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {icon}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2">
        <p className="text-[12px] text-muted-foreground">
          {label} on all {count} selected.
        </p>
        <ValueInput value={value} onChange={onChange} suggestions={suggestions} placeholder={placeholder} />
        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1" disabled={busy || !value.trim()} onClick={onApply}>
            Apply
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={onClear}>
            Clear on all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
