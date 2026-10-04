import type { AttachmentKind } from '@/types';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v)$/i;
const YOUTUBE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i;
const DISCORD = /(?:cdn|media)\.discordapp\.(?:net|com)/i;

function pathPart(ref: string): string {
  return ref.split(/[?#]/)[0];
}

export function youtubeId(ref: string): string | null {
  return YOUTUBE.exec(ref)?.[1] ?? null;
}

export function isDiscord(ref: string): boolean {
  return DISCORD.test(ref);
}

export function discordExpires(ref: string): boolean {
  return isDiscord(ref) && /[?&]ex=/.test(ref);
}

export function attachmentKind(ref: string): AttachmentKind {
  if (youtubeId(ref)) return 'youtube';
  const path = pathPart(ref);
  if (VIDEO_EXT.test(path)) return 'video';
  if (IMAGE_EXT.test(path)) return 'image';
  return 'file';
}

export function attachmentName(ref: string): string {
  const id = youtubeId(ref);
  if (id) return `youtube.com/watch?v=${id}`;
  return decodeURIComponent(pathPart(ref).split(/[\\/]/).pop() || ref);
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
