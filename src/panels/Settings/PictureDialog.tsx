import { useEffect, useRef, useState } from 'react';
import { Crop, Image, Link2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import ImageCropper, { type CropperHandle } from '@/components/shared/ImageCropper';
import UserAvatar from '@/components/shared/UserAvatar';
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
import { removeAvatar, uploadAvatar } from '@/lib/avatarStorage';
import { errorText } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import type { PictureKind } from '@/stores/useUiStore';

interface PictureDialogProps {
  open: boolean;
  kind: PictureKind;
  onOpenChange: (open: boolean) => void;
}

export default function PictureDialog({ open, kind, onOpenChange }: PictureDialogProps) {
  const profile = useAuthStore(s => s.profile)!;
  const updateProfile = useAuthStore(s => s.updateProfile);

  const banner = kind === 'banner';
  const current = banner ? profile.bannerUrl : profile.avatarUrl;

  const [url, setUrl] = useState(current);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState<string>('');
  const fileInput = useRef<HTMLInputElement>(null);
  const cropper = useRef<CropperHandle>(null);

  useEffect(() => {
    if (open) setUrl(current);
  }, [open, current]);

  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked);
  }, [picked]);

  function take(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('That is not an image');
      return;
    }
    setPicked(URL.createObjectURL(file));
  }

  async function useCrop() {
    const blob = await cropper.current?.crop();
    if (!blob) {
      toast.error('Could not cut that picture');
      return;
    }
    setBusy(true);
    try {
      const file = new File([blob], `${kind}.png`, { type: 'image/png' });
      const uploaded = await uploadAvatar(file, profile.id);
      setUrl(uploaded);
      setPicked('');
      toast.success('Uploaded, save to keep it');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function dropped(files: FileList) {
    const file = [...files].find(f => f.type.startsWith('image/'));
    if (!file) {
      toast.error('That is not an image');
      return;
    }
    take(file);
  }

  async function save(next: string) {
    const previous = current;
    try {
      await updateProfile(banner ? { bannerUrl: next } : { avatarUrl: next });
      if (previous && previous !== next) await removeAvatar(previous, profile.id);
      onOpenChange(false);
      toast.success(
        next
          ? banner
            ? 'Banner changed'
            : 'Picture changed'
          : banner
            ? 'Banner removed'
            : 'Picture removed',
      );
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(30rem,calc(100vw-2rem))] overflow-hidden sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{banner ? 'Profile banner' : 'Profile picture'}</DialogTitle>
          <DialogDescription>
            {banner
              ? 'The strip behind your face when somebody opens your profile.'
              : 'Everyone in the workspace sees this next to the cards you file.'}
          </DialogDescription>
        </DialogHeader>

        {picked ? (
          <div className="flex min-w-0 flex-col gap-3">
            <ImageCropper
              ref={cropper}
              src={picked}
              aspect={banner ? 3 : 1}
              round={!banner}
              outWidth={banner ? 1200 : 512}
            />
            <p className="text-[12px] text-muted-foreground">
              Drag the picture to move it, the slider or the wheel to zoom. What the frame shows is
              what gets saved.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void useCrop()}>
                <Crop size={15} strokeWidth={1.6} />
                {busy ? 'Uploading' : 'Use this crop'}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPicked('')}>
                Pick another
              </Button>
            </div>
          </div>
        ) : (
        <div
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length) dropped(event.dataTransfer.files);
          }}
          className={`flex gap-4 rounded-xl border border-dashed p-4 transition-colors duration-150 ${
            banner ? 'flex-col' : 'items-center'
          } ${dragging ? 'border-primary bg-accent/40' : 'border-border'}`}
        >
          {banner ? (
            <div
              className="h-24 w-full rounded-lg bg-cover bg-center"
              style={{
                backgroundImage: url.trim()
                  ? `url(${url.trim()})`
                  : 'linear-gradient(120deg, color-mix(in oklab, var(--primary) 45%, transparent), color-mix(in oklab, var(--primary) 8%, transparent))',
              }}
              data-accent={profile.accent}
            />
          ) : (
            <UserAvatar
              name={profile.displayName}
              initials={profile.initials}
              accent={profile.accent}
              url={url}
              className="size-16"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[13px]">Drop an image here</div>
            <div className="text-[12px] text-muted-foreground">
              or pick a file, or paste a link below
            </div>
            <div className="mt-2 flex gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) take(file);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={15} strokeWidth={1.6} />
                Choose a file
              </Button>
              {url && (
                <Button size="sm" variant="ghost" onClick={() => setUrl('')}>
                  <Trash2 size={15} strokeWidth={1.6} />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
        )}

        <Field>
          <FieldLabel htmlFor="picture-url">Link</FieldLabel>
          <Input
            id="picture-url"
            value={url}
            placeholder="https://"
            onChange={event => setUrl(event.target.value)}
          />
          <FieldDescription>
            <Link2 size={15} strokeWidth={1.6} className="mr-1 inline align-text-bottom" />
            Anything reachable over https works. A file picked here is kept in the project's own
            storage, up to 5 MB.
          </FieldDescription>
        </Field>

        <DialogFooter>
          {current && (
            <Button variant="ghost" className="mr-auto" onClick={() => void save('')}>
              <Image size={15} strokeWidth={1.6} />
              {banner ? 'Back to the accent' : 'Back to initials'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || url.trim() === current} onClick={() => void save(url.trim())}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
