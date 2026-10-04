import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { youtubeEmbed } from '@/lib/attachments';

interface FloatingVideoPlayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
}

export default function FloatingVideoPlayer({
  open,
  onOpenChange,
  videoId,
}: FloatingVideoPlayerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="mono text-[12px]">youtube.com/watch?v={videoId}</DialogTitle>
        </DialogHeader>
        <AspectRatio ratio={16 / 9}>
          {open && (
            <iframe
              src={youtubeEmbed(videoId)}
              title={videoId}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full rounded-md border-0"
            />
          )}
        </AspectRatio>
      </DialogContent>
    </Dialog>
  );
}
