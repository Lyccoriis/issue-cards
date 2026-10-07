import { useState } from 'react';
import { Bug, Check, Pencil, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';

import AttachmentTray from '@/components/shared/AttachmentTray';
import { RichInline } from '@/components/shared/Mentions';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { liveResults, myAnswer } from '@/lib/tests';
import { errorText } from '@/lib/supabase';
import { issueOfStep, openIssue, testRefOf } from '@/lib/testLinks';
import { PersonLine, StatusBadge } from '@/panels/IssueCards/IssueBits';
import { useIssueStore } from '@/stores/useIssueStore';
import { useTestStore } from '@/stores/useTestStore';
import { testFailTarget } from '@/stores/useUploadStore';
import type { TestFeature, TestResult, TestStep } from '@/types';
import FailForm from './FailForm';
import { resultAttachments, tint } from './TestBits';

interface StepRowProps {
  feature: TestFeature;
  step: TestStep;
  myId: string | null;
  canMark: boolean;
  testVersion: string;
  flash: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
}

export default function StepRow({
  feature,
  step,
  myId,
  canMark,
  testVersion,
  flash,
  rowRef,
}: StepRowProps) {
  const answer = useTestStore(s => s.answer);
  const clear = useTestStore(s => s.clear);
  const cards = useIssueStore(s => s.cards);
  const issue = issueOfStep(cards, testRefOf(feature, step));
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState<'pass' | 'undo' | null>(null);

  const mine = myId ? myAnswer(feature, step.id, myId) : null;
  const live = liveResults(feature).filter(r => r.stepId === step.id);
  const others = live.filter(r => r.userId !== myId);
  const fails = live.filter(r => r.result === 'fail' && !(formOpen && r.userId === myId));

  const passed = mine?.result === 'pass';
  const failed = mine?.result === 'fail';
  const strip = passed ? 'var(--success)' : failed ? 'var(--destructive)' : 'var(--border)';

  async function works() {
    if (passed || busy || !testVersion) return;
    setBusy('pass');
    setFormOpen(false);
    try {
      await answer(step.id, { version: testVersion, result: 'pass', why: '', repro: '' });
    } catch (err) {
      toast.error(errorText(err));
    }
    setBusy(null);
  }

  async function undo() {
    if (!mine || busy) return;
    setBusy('undo');
    try {
      await clear(mine.id);
    } catch (err) {
      toast.error(errorText(err));
    }
    setBusy(null);
  }

  return (
    <div
      ref={rowRef}
      className={`flex flex-col gap-2 rounded-md border bg-card p-3 transition-shadow duration-150 ${
        flash ? 'ring-2 ring-primary' : ''
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: strip }}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="tnum mt-0.5 flex h-6 min-w-9 flex-none items-center justify-center rounded bg-muted px-1.5 text-[12px] font-semibold">
          {step.code}
        </span>

        <div className="flex min-w-[180px] flex-1 flex-col gap-1 text-[13px]">
          <p className="whitespace-pre-wrap">
            <b className="mr-2 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
              Do
            </b>
            <RichInline text={step.how} />
          </p>
          <p className="whitespace-pre-wrap">
            <b className="mr-2 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
              Expect
            </b>
            <RichInline text={step.expected} />
          </p>
        </div>

        {canMark && (
          <div className="flex flex-none items-center gap-1.5">
            <Button
              size="sm"
              variant={passed ? 'default' : 'outline'}
              className="w-[88px]"
              disabled={busy !== null || !testVersion}
              title={testVersion ? undefined : 'Pick the version you are testing on first'}
              onClick={() => void works()}
              style={
                passed
                  ? { background: 'var(--success)', color: 'var(--background)' }
                  : { color: 'var(--success)' }
              }
            >
              {busy === 'pass' ? <Spinner className="size-4" /> : <Check size={15} strokeWidth={2} />}
              Works
            </Button>
            <Button
              size="sm"
              variant={failed ? 'default' : 'outline'}
              className="w-[88px]"
              disabled={busy !== null || !testVersion}
              title={testVersion ? undefined : 'Pick the version you are testing on first'}
              onClick={() => setFormOpen(true)}
              style={
                failed
                  ? { background: 'var(--destructive)', color: 'var(--background)' }
                  : { color: 'var(--destructive)' }
              }
            >
              <X size={15} strokeWidth={2} />
              Broken
            </Button>
          </div>
        )}
      </div>

      {formOpen && canMark && (
        <FailForm step={step} existing={mine} testVersion={testVersion} onClose={() => setFormOpen(false)} />
      )}

      {fails.map(result => (
        <FailNote
          key={result.id}
          result={result}
          mine={result.userId === myId}
          onEdit={() => setFormOpen(true)}
        />
      ))}

      {(others.length > 0 || (mine && !formOpen) || issue) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {issue && (
            <button
              type="button"
              title={`Open ${issue.id} in Issue Cards`}
              onClick={() => openIssue(issue.id)}
              className="flex items-center gap-1.5 rounded-md text-[12px] outline-none hover:underline focus-visible:underline"
            >
              <Bug size={13} strokeWidth={1.6} />
              <span className="mono text-primary">{issue.id}</span>
              <StatusBadge status={issue.status} />
            </button>
          )}
          {others.map(result => (
            <span
              key={result.id}
              className="flex items-center gap-1 text-[12px]"
              style={{ color: result.result === 'pass' ? 'var(--success)' : 'var(--destructive)' }}
            >
              {result.result === 'pass' ? (
                <Check size={13} strokeWidth={2} />
              ) : (
                <X size={13} strokeWidth={2} />
              )}
              <span className="text-foreground">
                <PersonLine userId={result.userId} name={result.testerName || 'Someone'} />
              </span>
              {result.version && <span className="mono text-muted-foreground">Ver. {result.version}</span>}
            </span>
          ))}
          {mine && !formOpen && (
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto text-muted-foreground"
              disabled={busy !== null}
              onClick={() => void undo()}
            >
              {busy === 'undo' ? <Spinner className="size-3" /> : <Undo2 size={12} strokeWidth={1.8} />}
              Undo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FailNote({
  result,
  mine,
  onEdit,
}: {
  result: TestResult;
  mine: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-md border p-2.5 text-[13px]"
      style={{
        borderColor: tint('var(--destructive)', 35),
        background: tint('var(--destructive)', 6),
      }}
    >
      <div className="mono flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <X size={13} strokeWidth={2} style={{ color: 'var(--destructive)' }} />
        <PersonLine userId={result.userId} name={result.testerName || 'Someone'} />
        <span>says it is broken · {result.updatedAt}</span>
        {result.version && <span>· Ver. {result.version}</span>}
        {mine && (
          <Button variant="ghost" size="xs" className="ml-auto" onClick={onEdit}>
            <Pencil size={12} strokeWidth={1.8} />
            Edit
          </Button>
        )}
      </div>
      <p className="whitespace-pre-wrap">
        <RichInline text={result.why} />
      </p>
      <p className="whitespace-pre-wrap text-muted-foreground">
        <b className="mr-2 text-[10.5px] font-semibold tracking-wider uppercase">To see it</b>
        <RichInline text={result.repro} />
      </p>
      {result.attachments.length > 0 && (
        <AttachmentTray
          readOnly
          target={testFailTarget(result.id)}
          attachments={resultAttachments(result)}
        />
      )}
    </div>
  );
}
