import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface LightboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  name: string;
  video?: boolean;
}

export default function LightboxModal({
  open,
  onOpenChange,
  src,
  name,
  video = false,
}: LightboxModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-[92vw]">
        <DialogHeader>
          <DialogTitle className="mono truncate text-[12px]">{name}</DialogTitle>
        </DialogHeader>
        {video ? (
          <video src={src} controls autoPlay className="max-h-[78vh] w-full rounded-md" />
        ) : (
          <img src={src} alt={name} className="max-h-[78vh] w-full rounded-md object-contain" />
        )}
      </DialogContent>
    </Dialog>
  );
}
