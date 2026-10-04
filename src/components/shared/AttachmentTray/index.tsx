import { useEffect, useRef, useState } from 'react';
import { FileText, Film, Link2, Paperclip, Plus, RotateCcw, ScrollText, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  Attachment as AttachmentBox,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Progress } from '@/components/ui/progress';
import { attachmentName, formatBytes, youtubeId } from '@/lib/attachments';
import { errorText } from '@/lib/supabase';
import { useJobsFor, useUploadStore } from '@/stores/useUploadStore';
import type { Attachment, UploadJob } from '@/types';
import FloatingVideoPlayer from './FloatingVideoPlayer';
import LightboxModal from './LightboxModal';
import YoutubeThumbnail from './YoutubeThumbnail';

const mounted: symbol[] = [];

interface AttachmentTrayProps {
  target: string;
  attachments: Attachment[];
  onRemove?: (attachmentId: string) => Promise<unknown>;
  readOnly?: boolean;
}

export default function AttachmentTray({
  target,
  attachments,
  onRemove,
  readOnly = false,
}: AttachmentTrayProps) {
  const [link, setLink] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; name: string; video: boolean } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const token = useRef<symbol>(Symbol('tray'));

  const jobs = useJobsFor(target);
  const addFile = useUploadStore(s => s.addFile);
  const addBytes = useUploadStore(s => s.addBytes);
  const addLink = useUploadStore(s => s.addLink);

  async function start(work: () => Promise<unknown>) {
    try {
      await work();
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function pickFile() {
    const picked = await window.api.upload.pick();
    for (const filePath of picked) void start(() => addFile(target, filePath));
  }

  async function drop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (readOnly) return;

    const files = Array.from(event.dataTransfer.files);
    for (const file of files) {
      const filePath = window.api.upload.pathForFile(file);
      if (filePath) void start(() => addFile(target, filePath));
      else void start(async () => addBytes(target, await file.arrayBuffer(), file.name));
    }

    if (files.length === 0) {
      const url =
        event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
      if (url.trim()) void start(() => addLink(target, url.trim()));
    }
  }

  useEffect(() => {
    if (readOnly) return;
    const own = token.current;
    mounted.push(own);

    function onPaste(event: ClipboardEvent) {
      if (mounted[mounted.length - 1] !== own) return;
      const file = Array.from(event.clipboardData?.files ?? [])[0];
      if (!file) return;
      event.preventDefault();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const ext = file.type.split('/')[1] || 'png';
      void start(async () => addBytes(target, await file.arrayBuffer(), `pasted-${stamp}.${ext}`));
    }

    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('paste', onPaste);
      const at = mounted.indexOf(own);
      if (at >= 0) mounted.splice(at, 1);
    };
  }, [readOnly, target, addBytes]);

  return (
    <div
      onDragOver={e => {
        if (readOnly) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => void drop(e)}
      className={`flex flex-col gap-2 rounded-md border border-dashed p-2 transition-colors duration-150 ${
        dragOver ? 'border-primary bg-accent/40' : 'border-border'
      }`}
    >
      {attachments.length > 0 ? (
        <AttachmentGroup>
          {attachments.map(item => (
            <TrayItem
              key={item.id}
              item={item}
              readOnly={readOnly}
              onOpenMedia={(src, name, video) => setLightbox({ src, name, video })}
              onPlayYoutube={setPlaying}
              onRemove={onRemove}
            />
          ))}
        </AttachmentGroup>
      ) : (
        jobs.length === 0 && (
          <p className="px-1 py-2 text-[12px] text-muted-foreground">
            {readOnly ? 'No attachments.' : 'Nothing attached yet.'}
          </p>
        )
      )}

      {jobs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {jobs.map(job => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void pickFile()}>
            <Plus size={15} strokeWidth={1.6} />
            Add file
          </Button>
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <Link2 size={15} strokeWidth={1.6} />
            </InputGroupAddon>
            <InputGroupInput
              value={link}
              placeholder="Paste a YouTube, Discord or image link"
              onChange={e => setLink(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter' || !link.trim()) return;
                const url = link.trim();
                setLink('');
                void start(() => addLink(target, url));
              }}
            />
          </InputGroup>
        </div>
      )}

      {!readOnly && (
        <p className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>V</Kbd>
          </KbdGroup>
          pastes a screenshot, or drag a file straight in. Up to 200 MB, and it keeps going if you
          close this. latest.log, a crash report or an hs_err dump goes to mclo.gs.
        </p>
      )}

      {lightbox && (
        <LightboxModal
          open
          onOpenChange={open => !open && setLightbox(null)}
          src={lightbox.src}
          name={lightbox.name}
          video={lightbox.video}
        />
      )}

      {playing && (
        <FloatingVideoPlayer open onOpenChange={open => !open && setPlaying(null)} videoId={playing} />
      )}
    </div>
  );
}

function JobRow({ job }: { job: UploadJob }) {
  const cancel = useUploadStore(s => s.cancel);
  const retry = useUploadStore(s => s.retry);
  const dismiss = useUploadStore(s => s.dismiss);

  const percent = job.bytes > 0 ? Math.min(100, Math.round((job.sent / job.bytes) * 100)) : 0;
  const dead = job.state === 'error' || job.state === 'canceled';

  const note =
    job.state === 'queued'
      ? 'waiting its turn'
      : job.state === 'canceled'
        ? 'canceled'
        : job.error
          ? job.error
          : job.state === 'uploading'
            ? `${percent}% of ${formatBytes(job.bytes) || 'unknown size'} to ${job.host}${
                job.attempt > 1 ? ` · attempt ${job.attempt}` : ''
              }`
            : 'filing it on the card';

  return (
    <div
      className="rounded-md border border-border p-2"
      style={dead ? { borderLeft: '2px solid var(--destructive)' } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12px]">{job.name}</span>
        <span className={`truncate text-[11px] ${dead ? 'text-destructive' : 'text-muted-foreground'}`}>
          {note}
        </span>
        {dead ? (
          <>
            <Button variant="ghost" size="icon-sm" aria-label="try again" onClick={() => retry(job.id)}>
              <RotateCcw size={15} strokeWidth={1.6} />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="dismiss" onClick={() => dismiss(job.id)}>
              <X size={15} strokeWidth={1.6} />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="cancel upload" onClick={() => cancel(job.id)}>
            <X size={15} strokeWidth={1.6} />
          </Button>
        )}
      </div>
      {!dead && <Progress value={percent} className="mt-1.5 h-1" />}
    </div>
  );
}

interface TrayItemProps {
  item: Attachment;
  readOnly: boolean;
  onOpenMedia: (src: string, name: string, video: boolean) => void;
  onPlayYoutube: (videoId: string) => void;
  onRemove?: (attachmentId: string) => Promise<unknown>;
}

function TrayItem({ item, readOnly, onOpenMedia, onPlayYoutube, onRemove }: TrayItemProps) {
  const [failed, setFailed] = useState(false);
  const videoId = item.kind === 'youtube' ? youtubeId(item.url) : null;
  const name = item.name || attachmentName(item.url);

  function open() {
    if (item.kind === 'youtube' && videoId) onPlayYoutube(videoId);
    else if (item.kind === 'image' || item.kind === 'video') {
      onOpenMedia(item.url, name, item.kind === 'video');
    } else window.api.shell.openExternal(item.url);
  }

  const detail = [item.host, formatBytes(item.bytes)].filter(Boolean).join(' · ');

  return (
    <AttachmentBox orientation="vertical" state={failed ? 'error' : 'done'}>
      <AttachmentMedia variant={item.kind === 'image' ? 'image' : 'icon'}>
        {item.kind === 'youtube' && videoId && <YoutubeThumbnail videoId={videoId} />}
        {item.kind === 'video' && <Film size={15} strokeWidth={1.6} />}
        {item.kind === 'file' &&
          (item.host === 'mclogs' ? (
            <ScrollText size={15} strokeWidth={1.6} />
          ) : (
            <FileText size={15} strokeWidth={1.6} />
          ))}
        {item.kind === 'image' &&
          (failed ? (
            <Paperclip size={15} strokeWidth={1.6} />
          ) : (
            <img src={item.url} alt={name} onError={() => setFailed(true)} />
          ))}
      </AttachmentMedia>

      <AttachmentContent>
        <AttachmentTitle>{name}</AttachmentTitle>
        <AttachmentDescription>{failed ? 'link is dead' : detail || item.kind}</AttachmentDescription>
      </AttachmentContent>

      <AttachmentTrigger aria-label={`open ${name}`} onClick={open} />

      {!readOnly && onRemove && (
        <AttachmentActions>
          <AttachmentAction aria-label={`remove ${name}`} onClick={() => void onRemove(item.id)}>
            <X size={15} strokeWidth={1.6} />
          </AttachmentAction>
        </AttachmentActions>
      )}
    </AttachmentBox>
  );
}
