import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCheck, FileSpreadsheet, FileUp, Link2, X } from 'lucide-react';
import { toast } from 'sonner';

import TagInput from '@/components/shared/TagInput';
import ValueInput from '@/components/shared/ValueInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { plainLink } from '@/lib/attach';
import { attachToIssue, createIssue, setIssueStatus } from '@/lib/issues';
import { errorText } from '@/lib/supabase';
import { dedupe, metaRows, tagRows } from '@/lib/tags';
import { useAuthStore } from '@/stores/useAuthStore';
import { PRIORITIES, useIssueStore } from '@/stores/useIssueStore';
import { ensureTags, useTags } from '@/stores/useTagStore';
import { useUiStore } from '@/stores/useUiStore';
import { cardTarget } from '@/stores/useUploadStore';
import { ISSUE_TYPES, type IssuePriority, type IssueStatus } from '@/types';
import { parseSheet, type SheetRow } from './sheetParser';

interface DraftRow extends SheetRow {
  codebase: string;
  verified: boolean;
  include: boolean;
  duplicate: boolean;
}

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'open',
  fixed: 'fixed, needs a check',
  resolved: 'resolved',
  wontfix: 'wontfix',
};

function statusVariant(status: IssueStatus) {
  return status === 'resolved' ? ('secondary' as const) : ('outline' as const);
}

export default function ImportSheetDialog() {
  const open = useUiStore(s => s.sheetImportOpen);
  const close = useUiStore(s => s.closeSheetImport);

  const workspaceId = useAuthStore(s => s.activeWorkspaceId);
  const cards = useIssueStore(s => s.cards);
  const reload = useIssueStore(s => s.load);

  const tags = useTags();
  const knownTags = useMemo(() => tagRows(tags, cards).map(row => row.name), [tags, cards]);
  const codebases = useMemo(() => metaRows(cards, 'codebase').map(row => row.name), [cards]);
  const versions = useMemo(() => metaRows(cards, 'version').map(row => row.name), [cards]);
  const takenRefs = useMemo(() => new Set(cards.map(c => c.sheetRef).filter(Boolean)), [cards]);

  const filePicker = useRef<HTMLInputElement>(null);

  const [blob, setBlob] = useState('');
  const [source, setSource] = useState('');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [skipped, setSkipped] = useState<{ ref: string; reason: string }[]>([]);
  const [current, setCurrent] = useState(0);
  const [batchVersion, setBatchVersion] = useState('');
  const [batchCodebase, setBatchCodebase] = useState('');
  const [batchTags, setBatchTags] = useState<string[]>([]);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (open) return;
    setBlob('');
    setSource('');
    setRows([]);
    setSkipped([]);
    setCurrent(0);
    setBatchVersion('');
    setBatchCodebase('');
    setBatchTags([]);
    setDone(0);
    setRunning(false);
  }, [open]);

  function parse(text: string, from: string) {
    const result = parseSheet(text);
    if (!result.rows.length) {
      toast.error('No bug sheet rows in that text');
      return;
    }
    setRows(
      result.rows.map(row => ({
        ...row,
        codebase: '',
        verified: false,
        include: !takenRefs.has(row.sheetRef),
        duplicate: takenRefs.has(row.sheetRef),
      })),
    );
    setSkipped(result.skipped);
    setCurrent(0);
    setSource(from);
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    parse(await file.text(), file.name);
  }

  function patch(index: number, change: Partial<DraftRow>) {
    setRows(list => list.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  function applyBatch() {
    setRows(list =>
      list.map(row => ({
        ...row,
        version: batchVersion.trim() || row.version,
        codebase: batchCodebase.trim() || row.codebase,
        tags: dedupe([...row.tags, ...batchTags]),
      })),
    );
  }

  function verifyAll(on: boolean) {
    setRows(list => list.map(row => (row.include ? { ...row, verified: on } : row)));
  }

  const included = rows.filter(r => r.include);
  const left = included.filter(r => !r.verified).length;
  const row = rows[current];

  async function runImport() {
    if (!workspaceId) return;
    setRunning(true);
    setDone(0);

    let made = 0;
    let mediaFailed = 0;
    try {
      await ensureTags(dedupe(included.flatMap(r => r.tags)));

      for (const draft of included) {
        const card = await createIssue(workspaceId, {
          title: draft.title,
          type: draft.type,
          subtype: 'from shared bug sheet',
          priority: draft.priority,
          version: draft.version,
          codebase: draft.codebase,
          sheetRef: draft.sheetRef,
          tags: draft.tags,
          description: draft.description,
          recommendation: draft.notes.map(n => `- ${n}`).join('\n'),
        });
        made += 1;

        if (draft.status !== 'open') {
          await setIssueStatus(card.rowId, draft.status, {
            humanConfirmed: true,
            testProcedure: draft.testProcedure,
          });
        }

        if (draft.media) {
          try {
            const kept = plainLink(draft.media);
            if (kept) await attachToIssue(card.rowId, kept);
            else await window.api.upload.rehost(draft.media, cardTarget(card.rowId));
          } catch {
            mediaFailed += 1;
          }
        }

        setDone(made);
      }
    } catch (err) {
      toast.error(errorText(err));
    }

    await reload();
    setRunning(false);
    if (made > 0) {
      toast.success(
        `Imported ${made} card${made === 1 ? '' : 's'}` +
          (mediaFailed ? `, ${mediaFailed} media links could not be attached` : ''),
      );
    }
    if (made === included.length) close();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && close()}>
      <DialogContent className="flex h-[86vh] max-h-[880px] flex-col gap-4 overflow-hidden sm:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Import from sheet</DialogTitle>
          <DialogDescription>
            Rows from the shared bug sheet, one card each. The sheet ref is kept on the card, the
            card id stays this app's own numbering.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={filePicker}
          type="file"
          accept=".tsv,.csv,.txt,text/plain"
          className="hidden"
          onChange={e => {
            void readFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {rows.length === 0 ? (
          <div
            className="flex flex-1 flex-col gap-3 overflow-hidden"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              void readFile(e.dataTransfer.files[0]);
            }}
          >
            <Field className="min-h-0 flex-1">
              <FieldLabel htmlFor="sheet-blob">Rows</FieldLabel>
              <Textarea
                id="sheet-blob"
                className="min-h-[240px] flex-1 font-mono text-[12px]"
                value={blob}
                placeholder={
                  '#99\tNo media\tBroken\t6 - No Data\t1 - High\tExhaust extension doesnt render'
                }
                onChange={e => setBlob(e.target.value)}
              />
              <FieldDescription>
                Paste one row or the whole sheet, or drop a .tsv export anywhere in this dialog.
                Section labels and version headings are read too, blank rows are ignored.
              </FieldDescription>
            </Field>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            <div className="grid grid-cols-[180px_180px_minmax(220px,1fr)_auto] items-start gap-3 rounded-md border border-border p-3">
              <Field>
                <FieldLabel htmlFor="batch-version">Version for all</FieldLabel>
                <ValueInput
                  id="batch-version"
                  value={batchVersion}
                  onChange={setBatchVersion}
                  suggestions={versions}
                  placeholder="0.18"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="batch-codebase">Codebase for all</FieldLabel>
                <ValueInput
                  id="batch-codebase"
                  value={batchCodebase}
                  onChange={setBatchCodebase}
                  suggestions={codebases}
                  placeholder="Loconautics"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="batch-tags">Tags for all</FieldLabel>
                <TagInput
                  id="batch-tags"
                  value={batchTags}
                  onChange={setBatchTags}
                  suggestions={knownTags}
                  chipsBelow
                />
              </Field>
              <Field>
                <FieldLabel aria-hidden className="invisible">
                  Apply
                </FieldLabel>
                <Button variant="outline" onClick={applyBatch}>
                  Apply to all
                </Button>
              </Field>
            </div>

            {skipped.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle size={15} strokeWidth={1.6} />
                <AlertTitle>{skipped.length} rows could not be read</AlertTitle>
                <AlertDescription>
                  {skipped.map(s => `${s.ref}: ${s.reason}`).join(' · ')}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-3">
              <ScrollArea className="h-full min-h-0 rounded-md border border-border">
                {rows.map((draft, index) => (
                  <div
                    key={draft.sheetRef + index}
                    onClick={() => setCurrent(index)}
                    className={`flex cursor-pointer items-start gap-2 border-b border-border px-3 py-2 transition-colors last:border-b-0 hover:bg-accent/40 ${
                      index === current ? 'bg-accent/60' : ''
                    }`}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={draft.verified}
                      onCheckedChange={v => patch(index, { verified: v === true })}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="mono text-[11px] text-muted-foreground">
                          {draft.sheetRef}
                        </span>
                        <Badge variant={statusVariant(draft.status)} className="text-[10px]">
                          {draft.status}
                        </Badge>
                        {draft.duplicate && (
                          <Badge variant="destructive" className="text-[10px]">
                            imported
                          </Badge>
                        )}
                      </div>
                      <div
                        className={`mt-0.5 truncate text-[12.5px] ${
                          draft.include ? '' : 'text-muted-foreground line-through'
                        }`}
                      >
                        {draft.title}
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>

              {row && (
                <ScrollArea className="h-full min-h-0 rounded-md border border-border">
                  <div className="flex flex-col gap-3.5 p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="mono">
                        {row.sheetRef}
                      </Badge>
                      <Badge variant={statusVariant(row.status)}>{STATUS_LABEL[row.status]}</Badge>
                      {row.section && (
                        <span className="text-[11.5px] text-muted-foreground">{row.section}</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => patch(current, { include: !row.include })}
                      >
                        {row.include ? (
                          <>
                            <X size={15} strokeWidth={1.6} />
                            Skip this row
                          </>
                        ) : (
                          <>
                            <Check size={15} strokeWidth={1.6} />
                            Import this row
                          </>
                        )}
                      </Button>
                    </div>

                    <Separator />

                    <Field>
                      <FieldLabel htmlFor="row-title">Title</FieldLabel>
                      <Input
                        id="row-title"
                        value={row.title}
                        onChange={e => patch(current, { title: e.target.value })}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="row-type">Type</FieldLabel>
                        <Select value={row.type} onValueChange={v => patch(current, { type: v })}>
                          <SelectTrigger id="row-type">
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
                          value={row.priority}
                          onValueChange={v => v && patch(current, { priority: v as IssuePriority })}
                        >
                          {PRIORITIES.map(p => (
                            <ToggleGroupItem key={p} value={p} className="capitalize">
                              {p}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="row-version">Version</FieldLabel>
                        <ValueInput
                          id="row-version"
                          value={row.version}
                          onChange={v => patch(current, { version: v })}
                          suggestions={versions}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="row-codebase">Codebase</FieldLabel>
                        <ValueInput
                          id="row-codebase"
                          value={row.codebase}
                          onChange={v => patch(current, { codebase: v })}
                          suggestions={codebases}
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel htmlFor="row-tags">Tags</FieldLabel>
                      <TagInput
                        id="row-tags"
                        value={row.tags}
                        onChange={v => patch(current, { tags: v })}
                        suggestions={knownTags}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="row-desc">Description</FieldLabel>
                      <Textarea
                        id="row-desc"
                        className="min-h-[110px]"
                        value={row.description}
                        onChange={e => patch(current, { description: e.target.value })}
                      />
                    </Field>

                    {row.notes.length > 0 && (
                      <Field>
                        <FieldLabel>Notes from the sheet</FieldLabel>
                        <FieldDescription>Kept on the card under Recommendation.</FieldDescription>
                        <ul className="flex flex-col gap-1">
                          {row.notes.map((note, i) => (
                            <li key={i} className="text-[12.5px] text-muted-foreground">
                              {note}
                            </li>
                          ))}
                        </ul>
                      </Field>
                    )}

                    <Field>
                      <FieldLabel htmlFor="row-media">Media</FieldLabel>
                      <Input
                        id="row-media"
                        value={row.media}
                        placeholder="No media on this row"
                        onChange={e => patch(current, { media: e.target.value })}
                      />
                      <FieldDescription>
                        <Link2 size={15} strokeWidth={1.6} className="mr-1 inline align-text-top" />
                        Attached to the card once it exists. Discord CDN links are rehosted, plain
                        message links are kept as they are.
                      </FieldDescription>
                    </Field>
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {running && <Progress value={(done / Math.max(included.length, 1)) * 100} />}

        <DialogFooter className="items-center">
          {rows.length > 0 && (
            <span className="mr-auto flex items-center gap-2">
              <Badge variant="secondary" className="tnum">
                {left} left to verify
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                disabled={running || included.length === 0}
                onClick={() => verifyAll(left > 0)}
              >
                <CheckCheck size={15} strokeWidth={1.6} />
                {left > 0 ? 'Verify all' : 'Clear verified'}
              </Button>
              <span className="text-[12px] text-muted-foreground">
                {included.length} of {rows.length} rows{source ? ` from ${source}` : ''}
              </span>
            </span>
          )}

          {rows.length === 0 ? (
            <>
              <Button variant="outline" onClick={() => filePicker.current?.click()}>
                <FileUp size={15} strokeWidth={1.6} />
                Open .tsv
              </Button>
              <Button disabled={!blob.trim()} onClick={() => parse(blob, 'pasted rows')}>
                <FileSpreadsheet size={15} strokeWidth={1.6} />
                Parse rows
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={running} onClick={() => setRows([])}>
                Back
              </Button>
              <Button
                disabled={left > 0 || included.length === 0 || running || !workspaceId}
                onClick={() => void runImport()}
              >
                {running
                  ? `Importing ${done} of ${included.length}`
                  : `Import ${included.length} card${included.length === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
