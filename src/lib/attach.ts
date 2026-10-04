import { attachmentKind, attachmentName, discordExpires, youtubeId } from '@/lib/attachments';
import type { NewAttachment } from '@/lib/issues';
import type { UploadResult } from '@/types';

export function plainLink(url: string): NewAttachment | null {
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) throw new Error('That is not a link');

  if (youtubeId(clean)) {
    return { url: clean, kind: 'youtube', host: 'youtube', name: attachmentName(clean) };
  }
  if (discordExpires(clean)) return null;

  return { url: clean, kind: attachmentKind(clean), host: 'link', name: attachmentName(clean) };
}

export function fromResult(put: UploadResult, sourceUrl = ''): NewAttachment {
  return {
    url: put.url,
    kind: put.host === 'mclogs' ? 'file' : attachmentKind(put.name),
    host: put.host,
    name: put.name,
    mime: put.mime,
    bytes: put.bytes,
    sourceUrl,
  };
}
