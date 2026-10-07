import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

import TagBadge from '@/components/shared/TagBadge';
import WhyDisabled from '@/components/shared/WhyDisabled';
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
import { Input } from '@/components/ui/input';
import { normalizeTag, tagVar } from '@/lib/tags';
import { createTag, updateTag } from '@/stores/useTagStore';
import { TAG_COLORS, type IssueTag, type TagColor } from '@/types';

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: IssueTag | null;
  onCreated?: (tag: IssueTag) => void;
}

export default function TagDialog({ open, onOpenChange, tag = null, onCreated }: TagDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>('chart-1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(tag?.name ?? '');
    setColor(tag?.color ?? 'chart-1');
  }, [open, tag]);

  const clean = normalizeTag(name);

  async function save() {
    if (!clean || saving) return;
    setSaving(true);
    try {
      if (tag) {
        await updateTag(tag.id, { name: clean, color });
        toast.success(`${clean} saved`);
      } else {
        const made = await createTag(clean, color);
        if (made) {
          onCreated?.(made);
          toast.success(`${made.name} created`);
        }
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{tag ? `Edit ${tag.name}` : 'New tag'}</DialogTitle>
          <DialogDescription>
            Tags belong to this workspace. Renaming one follows it onto every card that carries it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="tag-name">Name</FieldLabel>
            <Input
              id="tag-name"
              value={name}
              autoFocus
              placeholder="perf"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void save()}
            />
            <FieldDescription>
              Commas and brackets are dropped, spaces become hyphens.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Color</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map(option => (
                <button
                  key={option}
                  type="button"
                  aria-label={option}
                  aria-pressed={color === option}
                  style={{ background: tagVar(option) }}
                  onClick={() => setColor(option)}
                  className={`flex size-6 items-center justify-center rounded-full border-2 transition-transform duration-150 hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
                    color === option ? 'border-foreground' : 'border-transparent'
                  }`}
                >
                  {color === option && (
                    <Check size={13} strokeWidth={2.4} className="text-background" />
                  )}
                </button>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel>Preview</FieldLabel>
            <div>
              <TagBadge tag={clean || 'tag'} color={color} />
            </div>
          </Field>
        </div>

        <DialogFooter className="items-center">
          <WhyDisabled reason={clean ? null : 'Type a tag name first'} className="sm:mr-auto" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!clean || saving} onClick={() => void save()}>
            {tag ? 'Save' : 'Create tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
