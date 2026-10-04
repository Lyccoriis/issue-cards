import { useEffect, useMemo, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import AttachmentTray from '@/components/shared/AttachmentTray';
import MentionField from '@/components/shared/MentionField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { attachToIssue } from '@/lib/issues';
import { errorText } from '@/lib/supabase';
import { useIssueStore } from '@/stores/useIssueStore';
import { useUiStore } from '@/stores/useUiStore';
import { draftTarget, useStagedFor, useUploadStore } from '@/stores/useUploadStore';
import {
  REJECTION_SEVERITIES,
  SEVERITY_LABEL,
  SEVERITY_NOTE,
  type Attachment,
  type RejectionSeverity,
} from '@/types';

export default function RejectDialog() {
  const cards = useIssueStore(s => s.cards);
  const reject = useIssueStore(s => s.reject);
  const reload = useIssueStore(s => s.load);

  const rejectCardId = useUiStore(s => s.rejectCardId);
  const close = useUiStore(s => s.closeStatusAsk);
  const card = cards.find(c => c.id === rejectCardId) ?? null;

  const target = draftTarget(`reject-${rejectCardId ?? 'none'}`);
  const staged = useStagedFor(target);
  const unstage = useUploadStore(s => s.unstage);
  const drain = useUploadStore(s => s.drainStaged);

  const [severity, setSeverity] = useState<RejectionSeverity>('still-broken');
  const [reason, setReason] = useState('');
  const [tested, setTested] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!card) return;
    setSeverity('still-broken');
    setReason('');
    setTested('');
    setSaving(false);
  }, [card]);

  const shown: Attachment[] = useMemo(
    () =>
      staged.map((item, index) => ({
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
    [staged, card],
  );

  const ready = reason.trim().length > 0 && !saving;

  async function confirm() {
    if (!card || !ready) return;
    close();
    try {
      const rejectionId = await reject(card.id, {
        severity,
        reason: reason.trim(),
        tested: tested.trim(),
      });

      if (rejectionId) {
        const pending = drain(target);
        for (const item of pending) await attachToIssue(card.rowId, item, rejectionId);
        if (pending.length) await reload();
      }

      toast.success(`${card.id} handed back, now open`);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <Dialog open={Boolean(card)} onOpenChange={open => !open && close()}>
      <DialogContent className="flex h-[78vh] max-h-[760px] flex-col gap-4 overflow-hidden sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{card ? `Reject the fix on ${card.id}` : ''}</DialogTitle>
          <DialogDescription>
            The card goes back to open and this stays on it, at the top, not as a footnote.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 pr-3">
            <Field>
              <FieldLabel>How far off was it</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                className="w-full"
                value={severity}
                onValueChange={v => v && setSeverity(v as RejectionSeverity)}
              >
                {REJECTION_SEVERITIES.map(s => (
                  <ToggleGroupItem key={s} value={s} className="flex-1">
                    {SEVERITY_LABEL[s]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>{SEVERITY_NOTE[severity]}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="reject-reason">What is still wrong</FieldLabel>
              <MentionField multiline
                id="reject-reason"
                rows={4}
                value={reason}
                onValueChange={setReason}
                autoFocus
              />
              <FieldDescription>
                In enough detail that the next attempt does not repeat the one that just failed.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="reject-tested">What you ran</FieldLabel>
              <MentionField multiline
                id="reject-tested"
                rows={3}
                value={tested}
                onValueChange={setTested}
                placeholder="The steps you actually went through to find it still broken."
              />
              <FieldDescription>
                Optional, but it is the difference between a hand back and an argument.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Proof</FieldLabel>
              <AttachmentTray
                target={target}
                attachments={shown}
                onRemove={async id => unstage(target, Number(id.slice(7)))}
              />
              <FieldDescription>
                These hang off this rejection, not off the card, so it is clear what they show.
              </FieldDescription>
            </Field>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!ready} onClick={() => void confirm()}>
            <Undo2 size={15} strokeWidth={1.6} />
            Reject fix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
