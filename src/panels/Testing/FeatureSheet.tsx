import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  Bug,
  CircleCheck,
  Copy,
  Info,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import DetailViewer, { DetailMarkdown, DetailSection } from '@/components/shared/DetailViewer';
import Notes from '@/components/shared/Notes';
import { RichInline } from '@/components/shared/Mentions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { relTime } from '@/lib/relTime';
import { errorText } from '@/lib/supabase';
import { allSteps, featureStatus, myAnswer } from '@/lib/tests';
import { issuesOfFeature, openIssue } from '@/lib/testLinks';
import { PersonLine, StatusBadge } from '@/panels/IssueCards/IssueBits';
import { useAuthStore, usePermissions } from '@/stores/useAuthStore';
import { useIssueStore } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useTestStore } from '@/stores/useTestStore';
import { useUiStore } from '@/stores/useUiStore';
import type { TestFeature } from '@/types';
import StepRow from './StepRow';
import { StatusChip, tint } from './TestBits';

export default function FeatureSheet({ feature }: { feature: TestFeature | null }) {
  const can = usePermissions();
  const myId = useAuthStore(s => s.profile?.id ?? null);
  const width = useLayoutStore(s => s.issueSheetWidth);
  const setWidth = useLayoutStore(s => s.setIssueSheetWidth);

  const select = useTestStore(s => s.select);
  const allNotes = useTestStore(s => s.notes);
  const note = useTestStore(s => s.note);
  const unnote = useTestStore(s => s.unnote);
  const archive = useTestStore(s => s.archive);
  const remove = useTestStore(s => s.remove);
  const retest = useTestStore(s => s.retest);
  const openForm = useUiStore(s => s.openTestForm);

  const cards = useIssueStore(s => s.cards);
  const focusStepId = useTestStore(s => s.focusStepId);
  const focus = useTestStore(s => s.focus);

  const rows = useRef(new Map<string, HTMLDivElement>());
  const [last, setLast] = useState<TestFeature | null>(feature);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (feature) setLast(feature);
  }, [feature]);

  useEffect(() => {
    if (!focusStepId || !feature) return;
    const wait = setTimeout(() => {
      rows.current.get(focusStepId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlash(focusStepId);
      focus(null);
    }, 350);
    return () => clearTimeout(wait);
  }, [focusStepId, feature, focus]);

  useEffect(() => {
    if (!flash) return;
    const off = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(off);
  }, [flash]);

  const shown = feature ?? last;
  const notes = useMemo(
    () => allNotes.filter(n => shown && n.featureId === shown.id),
    [allNotes, shown],
  );
  const issues = useMemo(() => (shown ? issuesOfFeature(cards, shown) : []), [cards, shown]);
  if (!shown) return null;

  const steps = allSteps(shown);
  const status = featureStatus(shown);
  const answered = myId ? steps.filter(s => myAnswer(shown, s.id, myId)).length : 0;
  const next = myId ? steps.find(s => !myAnswer(shown, s.id, myId)) : undefined;
  const allDone = can.markTests && steps.length > 0 && !next;

  async function run(work: () => Promise<unknown>, done: string) {
    try {
      await work();
      toast.success(done);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  function goNext() {
    if (next) rows.current.get(next.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const badges = (
    <>
      <StatusChip status={status} />
      {shown.version && <Badge variant="secondary">{shown.version}</Badge>}
      {shown.round > 1 && <Badge variant="outline">round {shown.round}</Badge>}
      {shown.archived && <Badge variant="outline">archived</Badge>}
    </>
  );

  const footer = (
    <>
      {can.writeFeatures && (
        <Button size="sm" onClick={() => openForm(shown.id)}>
          <Pencil size={15} strokeWidth={1.6} />
          Edit
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => void navigator.clipboard.writeText(shown.key).then(() => toast.success('ID copied'))}
      >
        <Copy size={15} strokeWidth={1.6} />
        Copy ID
      </Button>

      {can.writeFeatures && status === 'failing' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RotateCcw size={15} strokeWidth={1.6} />
              Ready for retest
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ready for retest?</AlertDialogTitle>
              <AlertDialogDescription>
                Broken steps go back to untested. Steps that work stay as they are.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void run(() => retest(shown.id), 'Testers will test the broken steps again')}
              >
                Retest
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {can.writeFeatures && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void run(
              () => archive(shown.id, !shown.archived),
              shown.archived ? `${shown.key} is back on the list` : `${shown.key} archived`,
            )
          }
        >
          {shown.archived ? (
            <ArchiveRestore size={15} strokeWidth={1.6} />
          ) : (
            <Archive size={15} strokeWidth={1.6} />
          )}
          {shown.archived ? 'Unarchive' : 'Archive'}
        </Button>
      )}

      {!can.writeFeatures && (
        <span className="text-[12px] text-muted-foreground">
          Your role in this workspace tests features, it does not change them
        </span>
      )}

      {can.writeFeatures && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="ml-auto">
              <Trash2 size={15} strokeWidth={1.6} />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {shown.key}?</AlertDialogTitle>
              <AlertDialogDescription>
                Every answer, screenshot and note on it goes too. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void run(() => remove(shown.id), `${shown.key} deleted`)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );

  return (
    <DetailViewer
      open={Boolean(feature)}
      onOpenChange={open => !open && select(null)}
      width={width}
      onWidth={setWidth}
      eyebrow={shown.key}
      title={shown.title}
      badges={badges}
      footer={footer}
    >
      <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
        <span className="text-muted-foreground">made by</span>
        <span>
          <PersonLine userId={shown.createdBy} name={shown.createdByName || 'Someone'} />
        </span>
        <span className="text-muted-foreground">created</span>
        <span className="mono">
          {shown.createdAt}
          {relTime(shown.createdAt) && <span className="text-muted-foreground"> · {relTime(shown.createdAt)}</span>}
        </span>
        <span className="text-muted-foreground">updated</span>
        <span className="mono">
          {shown.updatedAt}
          {relTime(shown.updatedAt) && <span className="text-muted-foreground"> · {relTime(shown.updatedAt)}</span>}
        </span>
      </div>

      <DetailSection title="What was done">
        <DetailMarkdown text={shown.done} />
      </DetailSection>

      <DetailSection title="Tests">
        <div className="flex flex-col gap-3">
          {can.markTests ? (
            <div className="flex items-center gap-3">
              <span className="tnum mono text-[12px] whitespace-nowrap">
                {answered} of {steps.length} done
              </span>
              <Progress value={steps.length ? (answered / steps.length) * 100 : 0} className="h-1.5 flex-1" />
              {next && (
                <Button variant="outline" size="xs" onClick={goNext}>
                  <ArrowDown size={12} strokeWidth={1.8} />
                  Next {next.code}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Info size={15} strokeWidth={1.6} />
              Your role can look, not answer
            </div>
          )}

          {allDone && (
            <div
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]"
              style={{ color: 'var(--success)', background: tint('var(--success)') }}
            >
              <CircleCheck size={15} strokeWidth={1.8} />
              All done, thank you
            </div>
          )}

          {shown.groups.map(group => (
            <section key={group.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-5 flex-none items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {group.letter}
                </span>
                <h3 className="text-[13px] font-semibold">{group.title || `Group ${group.letter}`}</h3>
              </div>

              {group.setup && (
                <p
                  className="rounded-md border px-2.5 py-1.5 text-[12px] whitespace-pre-wrap"
                  style={{ borderColor: tint('var(--primary)', 30), background: tint('var(--primary)', 8) }}
                >
                  <b className="mr-2">Set up first</b>
                  <RichInline text={group.setup} />
                </p>
              )}

              {group.steps.map(step => (
                <StepRow
                  key={step.id}
                  feature={shown}
                  step={step}
                  myId={myId}
                  canMark={can.markTests}
                  flash={flash === step.id}
                  rowRef={el => {
                    if (el) rows.current.set(step.id, el);
                    else rows.current.delete(step.id);
                  }}
                />
              ))}
            </section>
          ))}
        </div>
      </DetailSection>

      {issues.length > 0 && (
        <DetailSection title={issues.length === 1 ? 'Issue from these tests' : 'Issues from these tests'}>
          <div className="flex flex-col gap-1">
            {issues.map(card => (
              <button
                key={card.rowId}
                type="button"
                title={`Open ${card.id} in Issue Cards`}
                onClick={() => openIssue(card.id)}
                className="flex min-w-0 items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-[13px] outline-none hover:bg-muted/55 focus-visible:bg-muted/55"
              >
                <Bug size={15} strokeWidth={1.6} className="shrink-0 text-muted-foreground" />
                <span className="mono shrink-0 text-[12px] text-primary">{card.id}</span>
                <StatusBadge status={card.status} />
                <span className="mono shrink-0 text-[11px] text-muted-foreground">
                  {card.testRef.split(' ')[1]}
                </span>
                <span className="min-w-0 flex-1 truncate">{card.title}</span>
              </button>
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection title="Notes">
        <Notes
          notes={notes}
          canWrite={can.markTests}
          canDelete={n => (myId !== null && n.authorId === myId) || can.writeFeatures}
          onAdd={text => note(shown.id, text)}
          onDelete={id => unnote(id)}
        />
      </DetailSection>
    </DetailViewer>
  );
}
