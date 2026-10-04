import { useEffect, useMemo, useState } from 'react';
import { Loader2, Paperclip, Save, SquarePen } from 'lucide-react';
import { toast } from 'sonner';

import AttachmentTray from '@/components/shared/AttachmentTray';
import DatePicker from '@/components/shared/DatePicker';
import TagInput from '@/components/shared/TagInput';
import ValueInput from '@/components/shared/ValueInput';
import MentionField from '@/components/shared/MentionField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { attachToIssue, detachFromIssue } from '@/lib/issues';
import { metaRows, tagRows } from '@/lib/tags';
import { errorText } from '@/lib/supabase';
import { PRIORITIES, useIssueStore } from '@/stores/useIssueStore';
import { useTags } from '@/stores/useTagStore';
import { useUiStore } from '@/stores/useUiStore';
import { draftTarget, useStagedFor, useUploadStore } from '@/stores/useUploadStore';
import { ISSUE_TYPES, type Attachment, type IssueCard, type IssuePriority } from '@/types';

interface Draft {
  title: string;
  type: string;
  subtype: string;
  priority: IssuePriority;
  location: string;
  repo: string;
  codebase: string;
  version: string;
  related: string;
  tags: string[];
  dueDate: string;
  description: string;
  evidence: string;
  recommendation: string;
}

function draftFrom(card: IssueCard | null): Draft {
  return {
    title: card?.title ?? '',
    type: card?.type || 'Other',
    subtype: card?.subtype ?? '',
    priority: card?.priority ?? 'medium',
    location: card?.location ?? '',
    repo: card?.repo ?? '',
    codebase: card?.codebase ?? '',
    version: card?.version ?? '',
    related: card?.related.join(', ') ?? '',
    tags: card?.tags ?? [],
    dueDate: card?.dueDate ?? '',
    description: card?.description ?? '',
    evidence: card?.evidence ?? '',
    recommendation: card?.recommendation ?? '',
  };
}

const splitList = (v: string) =>
  v
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

export default function IssueFormDialog() {
  const open = useUiStore(s => s.issueFormOpen);
  const editingId = useUiStore(s => s.editingId);
  const closeForm = useUiStore(s => s.closeIssueForm);
  const create = useIssueStore(s => s.create);
  const reload = useIssueStore(s => s.load);
  const update = useIssueStore(s => s.update);
  const select = useIssueStore(s => s.select);

  const cards = useIssueStore(s => s.cards);
  const card = cards.find(c => c.id === editingId) ?? null;
  const tags = useTags();
  const known = useMemo(() => tagRows(tags, cards).map(row => row.name), [tags, cards]);
  const codebases = useMemo(() => metaRows(cards, 'codebase').map(row => row.name), [cards]);
  const versions = useMemo(() => metaRows(cards, 'version').map(row => row.name), [cards]);

  const [draft, setDraft] = useState<Draft>(() => draftFrom(card));
  const [saving, setSaving] = useState(false);

  const target = draftTarget(`card-${editingId ?? 'new'}`);
  const staged = useStagedFor(target);
  const unstage = useUploadStore(s => s.unstage);
  const clearStaged = useUploadStore(s => s.clearStaged);
  const drain = useUploadStore(s => s.drainStaged);

  const [dropped, setDropped] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setDraft(draftFrom(card));
    setDropped([]);
    setSaving(false);
  }, [open, card]);

  const kept = (card?.attachments ?? []).filter(a => !dropped.includes(a.id));

  const shown: Attachment[] = [
    ...kept,
    ...staged.map((item, index) => ({
      id: `staged:${index}`,
      issueId: card?.rowId ?? '',
      url: item.url,
      kind: item.kind,
      host: item.host,
      name: item.name,
      mime: item.mime ?? '',
      bytes: item.bytes ?? 0,
      sourceUrl: item.sourceUrl ?? '',
      rejectionId: null,
      createdAt: '',
      createdBy: null,
    })),
  ];

  async function drop(id: string) {
    if (id.startsWith('staged:')) {
      unstage(target, Number(id.slice(7)));
      return;
    }
    setDropped(list => [...list, id]);
  }

  function field<K extends keyof Draft>(key: K) {
    return (value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  }

  const ready = draft.title.trim().length > 0 && !saving;

  async function save() {
    if (!ready) return;
    setSaving(true);

    const payload = {
      title: draft.title.trim(),
      type: draft.type,
      subtype: draft.subtype.trim(),
      priority: draft.priority,
      location: draft.location.trim(),
      repo: draft.repo.trim(),
      codebase: draft.codebase.trim(),
      version: draft.version.trim(),
      related: splitList(draft.related),
      tags: draft.tags,
      dueDate: draft.dueDate.trim(),
      description: draft.description,
      evidence: draft.evidence,
      recommendation: draft.recommendation,
    };

    if (card) closeForm();

    try {
      const saved = card ? await update(card.id, payload) : await create(payload);
      if (!saved) {
        setSaving(false);
        return;
      }

      const pending = drain(target);
      await Promise.all(dropped.map(id => detachFromIssue(id, saved.rowId)));
      for (const item of pending) await attachToIssue(saved.rowId, item);
      if (pending.length || dropped.length) await reload();

      if (card) {
        toast.success(`${card.id} saved`);
      } else {
        select(saved.id);
        toast.success(`${saved.id} created`);
      }
      closeForm();
    } catch (err) {
      toast.error(errorText(err));
      setSaving(false);
    }
  }

  const attachedCount = shown.length;

  return (
    <Dialog open={open} onOpenChange={next => !next && closeForm()}>
      <DialogContent
        className="flex h-[86vh] max-h-[880px] flex-col gap-4 overflow-hidden sm:max-w-[1040px]"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{card ? `Editing ${card.id}` : 'New issue card'}</DialogTitle>
          <DialogDescription>
            The title and the writing on the left, everything that files the card on the right. A
            new card starts open.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="issue-title">Title</FieldLabel>
          <MentionField
            id="issue-title"
            className="h-10 text-[15px] placeholder:text-muted-foreground/55"
            placeholder="What is wrong, in one line"
            value={draft.title}
            onValueChange={field('title')}
            autoFocus
          />
        </Field>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] grid-rows-[minmax(0,1fr)] gap-3">
          <ScrollArea className="h-full min-h-0 rounded-md border border-border">
            <div className="flex flex-col gap-4 p-4">
              <Field>
                <FieldLabel htmlFor="issue-description">Description</FieldLabel>
                <MentionField multiline
                  id="issue-description"
                  className="min-h-[200px] placeholder:text-muted-foreground/55"
                  placeholder="What happens, what you expected instead, and how to get there."
                  value={draft.description}
                  onValueChange={field('description')}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="issue-evidence">Evidence</FieldLabel>
                <MentionField multiline
                  id="issue-evidence"
                  className="min-h-[150px] font-mono text-[12.5px] placeholder:text-muted-foreground/55"
                  placeholder="Log lines, a stack trace, the console output."
                  value={draft.evidence}
                  onValueChange={field('evidence')}
                />
                <FieldDescription>Pasted as it came out, no cleanup needed.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="issue-recommendation">Recommendation</FieldLabel>
                <MentionField multiline
                  id="issue-recommendation"
                  className="min-h-[110px] placeholder:text-muted-foreground/55"
                  placeholder="What you think the fix is, if you have one."
                  value={draft.recommendation}
                  onValueChange={field('recommendation')}
                />
              </Field>
            </div>
          </ScrollArea>

          <ScrollArea className="h-full min-h-0 rounded-md border border-border">
            <div className="flex flex-col gap-4 p-4">
              <Field>
                <FieldLabel htmlFor="issue-type">Type</FieldLabel>
                <Select value={draft.type} onValueChange={field('type')}>
                  <SelectTrigger id="issue-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_TYPES.map(t => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Priority</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  value={draft.priority}
                  onValueChange={v => v && field('priority')(v as IssuePriority)}
                >
                  {PRIORITIES.map(p => (
                    <ToggleGroupItem key={p} value={p} className="flex-1 capitalize">
                      {p}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="issue-tags">Tags</FieldLabel>
                <TagInput
                  id="issue-tags"
                  value={draft.tags}
                  onChange={field('tags')}
                  suggestions={known}
                  limit={14}
                  chipsBelow
                />
                <FieldDescription>
                  Enter or a comma adds one. Typing narrows the ones already on file, click to
                  reuse.
                </FieldDescription>
              </Field>

              <FieldSeparator>Where it lives</FieldSeparator>

              <Field>
                <FieldLabel htmlFor="issue-codebase">Codebase</FieldLabel>
                <ValueInput
                  id="issue-codebase"
                  value={draft.codebase}
                  onChange={field('codebase')}
                  suggestions={codebases}
                  placeholder="Loconautics"
                />
                <FieldDescription>Which project this belongs to, not a path.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="issue-version">Version</FieldLabel>
                <ValueInput
                  id="issue-version"
                  value={draft.version}
                  onChange={field('version')}
                  suggestions={versions}
                  placeholder="0.16"
                />
                <FieldDescription>The version it was seen on.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="issue-location">Location</FieldLabel>
                <Input
                  id="issue-location"
                  className="placeholder:text-muted-foreground/55"
                  placeholder="src/panels/IssueCards/index.tsx:120"
                  value={draft.location}
                  onChange={e => field('location')(e.target.value)}
                />
                <FieldDescription>File path, with a line number if you have one.</FieldDescription>
              </Field>

              <FieldSeparator>Filing</FieldSeparator>

              <Field>
                <FieldLabel htmlFor="issue-subtype">Subtype</FieldLabel>
                <Input
                  id="issue-subtype"
                  className="placeholder:text-muted-foreground/55"
                  placeholder="Crash, layout, wrong data"
                  value={draft.subtype}
                  onChange={e => field('subtype')(e.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="issue-related">Related</FieldLabel>
                <Input
                  id="issue-related"
                  className="placeholder:text-muted-foreground/55"
                  placeholder="ISSUE-012, ISSUE-031"
                  value={draft.related}
                  onChange={e => field('related')(e.target.value)}
                />
                <FieldDescription>Comma separated card ids.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="issue-due">Due date</FieldLabel>
                <DatePicker id="issue-due" value={draft.dueDate} onChange={field('dueDate')} />
              </Field>

              <FieldSeparator>
                <span className="flex items-center gap-1.5">
                  <Paperclip size={15} strokeWidth={1.6} />
                  Attachments
                  {attachedCount > 0 && (
                    <Badge variant="secondary" className="tnum">
                      {attachedCount}
                    </Badge>
                  )}
                </span>
              </FieldSeparator>

              <Field>
                <FieldLabel className="sr-only">Attachments</FieldLabel>
                <AttachmentTray target={target} attachments={shown} onRemove={drop} />
              </Field>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="items-center">
          <span className="mr-auto flex items-center gap-2 text-[12px] text-muted-foreground">
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>Enter</Kbd>
            </KbdGroup>
            to {card ? 'save' : 'create'}
          </span>

          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              clearStaged(target);
              closeForm();
            }}
          >
            Cancel
          </Button>
          <Button disabled={!ready} onClick={() => void save()}>
            {saving ? (
              <Loader2 size={15} strokeWidth={1.6} className="animate-spin" />
            ) : card ? (
              <Save size={15} strokeWidth={1.6} />
            ) : (
              <SquarePen size={15} strokeWidth={1.6} />
            )}
            {card ? 'Save' : 'Create card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
