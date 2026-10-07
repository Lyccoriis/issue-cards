import { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

import AttachmentTray from '@/components/shared/AttachmentTray';
import MentionField from '@/components/shared/MentionField';
import WhyDisabled from '@/components/shared/WhyDisabled';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { attachToResult } from '@/lib/tests';
import { errorText } from '@/lib/supabase';
import { useIssueStore } from '@/stores/useIssueStore';
import { useTestStore } from '@/stores/useTestStore';
import { draftTarget, testFailTarget, useStagedFor, useUploadStore } from '@/stores/useUploadStore';
import type { Attachment, TestResult, TestStep } from '@/types';
import { resultAttachments, tint } from './TestBits';

interface FailFormProps {
  step: TestStep;
  existing: TestResult | null;
  testVersion: string;
  onClose: () => void;
}

export default function FailForm({ step, existing, testVersion, onClose }: FailFormProps) {
  const answer = useTestStore(s => s.answer);
  const fileIssue = useTestStore(s => s.fileIssue);
  const reload = useTestStore(s => s.load);

  const target = existing ? testFailTarget(existing.id) : draftTarget(`testfail-${step.id}`);
  const staged = useStagedFor(target);
  const unstage = useUploadStore(s => s.unstage);
  const drain = useUploadStore(s => s.drainStaged);

  const [why, setWhy] = useState(existing?.why ?? '');
  const [repro, setRepro] = useState(existing?.repro ?? '');
  const [saving, setSaving] = useState(false);

  const shown: Attachment[] = useMemo(() => {
    if (existing) return resultAttachments(existing);
    return staged.map((item, index) => ({
      id: `staged:${index}`,
      issueId: '',
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
    }));
  }, [existing, staged]);

  const blocked = !testVersion
    ? 'Pick the version you are testing on, above the steps'
    : !why.trim()
      ? 'Say what went wrong'
      : !repro.trim()
        ? 'Say how to see it'
        : null;
  const ready = blocked === null && !saving;

  async function send() {
    if (!ready) return;
    setSaving(true);
    let resultId: string;
    try {
      resultId = await answer(step.id, { version: testVersion, result: 'fail', why, repro });
      if (!existing) {
        const pending = drain(target);
        for (const item of pending) await attachToResult(resultId, item);
        if (pending.length) await reload();
      }
    } catch (err) {
      toast.error(errorText(err));
      setSaving(false);
      return;
    }

    try {
      const rowId = await fileIssue(resultId);
      const key = useIssueStore.getState().cards.find(c => c.rowId === rowId)?.id;
      toast.success(key ? `Filed as ${key}` : 'Issue filed');
    } catch (err) {
      toast.error(`Your answer is saved, but the issue was not filed, ${errorText(err)}`);
    }
    onClose();
  }

  async function remove(id: string) {
    if (existing) await useTestStore.getState().detach(id);
    else unstage(target, Number(id.slice(7)));
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-md border p-3"
      style={{ borderColor: 'var(--destructive)', background: tint('var(--destructive)', 6) }}
    >
      <Field>
        <FieldLabel htmlFor={`why-${step.id}`}>What went wrong?</FieldLabel>
        <MentionField multiline
          id={`why-${step.id}`}
          rows={2}
          value={why}
          onValueChange={setWhy}
          placeholder="Example: the door did not open"
          autoFocus
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`repro-${step.id}`}>How can I see it too?</FieldLabel>
        <MentionField multiline
          id={`repro-${step.id}`}
          rows={3}
          value={repro}
          onValueChange={setRepro}
          placeholder={'Example:\n1. Stand on the platform\n2. Press the button\n3. Nothing happens'}
        />
      </Field>

      <Field>
        <FieldLabel>Screenshot or log</FieldLabel>
        <AttachmentTray target={target} attachments={shown} onRemove={remove} />
      </Field>

      <div className="flex items-center justify-end gap-2">
        <WhyDisabled reason={blocked} className="mr-auto" />
        <Button variant="outline" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" disabled={!ready} onClick={() => void send()}>
          {saving ? <Spinner className="size-4" /> : <Send size={15} strokeWidth={1.6} />}
          Send
        </Button>
      </div>
    </div>
  );
}
