import { Play } from 'lucide-react';

import { youtubeThumbnail } from '@/lib/attachments';

interface YoutubeThumbnailProps {
  videoId: string;
}

export default function YoutubeThumbnail({ videoId }: YoutubeThumbnailProps) {
  return (
    <div className="relative h-full w-full">
      <img
        src={youtubeThumbnail(videoId)}
        alt={videoId}
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-background/40 text-foreground">
        <Play size={15} strokeWidth={1.6} />
      </span>
    </div>
  );
}
