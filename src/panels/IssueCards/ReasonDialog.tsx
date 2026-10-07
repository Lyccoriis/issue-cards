import { useEffect, useState } from 'react';

import MentionField from '@/components/shared/MentionField';
import VersionSelect from '@/components/shared/VersionSelect';
import WhyDisabled from '@/components/shared/WhyDisabled';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  description: string;
  confirmLabel: string;
  initial?: string;
  versionLabel?: string;
  onConfirm: (text: string, version: string) => Promise<unknown>;
}

export default function ReasonDialog({
  open,
  onOpenChange,
  title,
  label,
  description,
  confirmLabel,
  initial = '',
  versionLabel,
  onConfirm,
}: ReasonDialogProps) {
  const [text, setText] = useState(initial);
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (!open) return;
    setText(initial);
    setVersion('');
  }, [open, initial]);

  const why = !text.trim()
    ? `Write the ${label.toLowerCase()} first`
    : versionLabel && !version
      ? 'Pick a version first'
      : null;
  const ready = why === null;

  async function confirm() {
    if (!ready) return;
    onOpenChange(false);
    await onConfirm(text.trim(), version);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="reason">{label}</FieldLabel>
          <MentionField multiline
            id="reason"
            rows={6}
            value={text}
            onValueChange={setText}
            autoFocus
          />
          <FieldDescription>{description}</FieldDescription>
        </Field>
        {versionLabel && (
          <Field>
            <FieldLabel htmlFor="reason-version">{versionLabel}</FieldLabel>
            <VersionSelect id="reason-version" value={version} onChange={setVersion} />
          </Field>
        )}
        <DialogFooter className="items-center">
          <WhyDisabled reason={why} className="sm:mr-auto" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!ready} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
