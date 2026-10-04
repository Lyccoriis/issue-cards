import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function extFor(file: File): string {
  const known = EXT[file.type];
  if (known) return known;
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  return /^[a-z0-9]{1,5}$/.test(fromName) ? fromName : 'png';
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  if (!EXT[file.type]) throw new Error('That file is not a picture the bucket takes');
  if (file.size > MAX_AVATAR_BYTES) throw new Error('That picture is larger than 5 MB');

  const path = `${userId}/${Date.now()}.${extFor(file)}`;
  const client = supabase();

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);

  return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function objectPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
}

export async function removeAvatar(url: string, userId: string): Promise<void> {
  const path = objectPath(url);
  if (!path || !path.startsWith(`${userId}/`)) return;
  await supabase().storage.from(BUCKET).remove([path]);
}
