import { useEffect, useState } from 'react';

import MentionField from '@/components/shared/MentionField';
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
  onConfirm: (text: string) => Promise<unknown>;
}

export default function ReasonDialog({
  open,
  onOpenChange,
  title,
  label,
  description,
  confirmLabel,
  initial = '',
  onConfirm,
}: ReasonDialogProps) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    if (open) setText(initial);
  }, [open, initial]);

  async function confirm() {
    if (!text.trim()) return;
    onOpenChange(false);
    await onConfirm(text.trim());
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!text.trim()} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
