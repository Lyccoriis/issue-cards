import type { WorkspaceMember } from '@/types';

export interface MentionHit {
  start: number;
  end: number;
  member: WorkspaceMember;
}

const MENTION = /(?<![\p{L}\p{N}_@])@(?:\{([^}\n]{1,60})\}|([\p{L}\p{N}_.-]+))/gu;

export const MENTION_HREF = '#mention-';

function squash(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

export function resolveMention(name: string, members: WorkspaceMember[]): WorkspaceMember | null {
  const key = squash(name);
  if (!key) return null;
  const exact = members.find(m => squash(m.displayName) === key);
  if (exact) return exact;
  const byEmail = members.find(m => m.email && squash(m.email.split('@')[0]) === key);
  if (byEmail) return byEmail;
  const byFirstWord = members.filter(m => squash(m.displayName.split(/\s+/)[0] ?? '') === key);
  return byFirstWord.length === 1 ? byFirstWord[0] : null;
}

export function findMentions(text: string, members: WorkspaceMember[]): MentionHit[] {
  if (!text.includes('@') || members.length === 0) return [];
  const hits: MentionHit[] = [];
  for (const match of text.matchAll(MENTION)) {
    const braced = match[1];
    const name = braced ?? match[2].replace(/[.-]+$/, '');
    const member = resolveMention(name, members);
    if (!member) continue;
    const start = match.index ?? 0;
    const end = braced === undefined ? start + 1 + name.length : start + match[0].length;
    hits.push({ start, end, member });
  }
  return hits;
}

export function mentionedIds(text: string, members: WorkspaceMember[]): string[] {
  return [...new Set(findMentions(text, members).map(hit => hit.member.userId))];
}

export function addedMentionIds(before: string, after: string, members: WorkspaceMember[]): string[] {
  const had = new Set(mentionedIds(before, members));
  return mentionedIds(after, members).filter(id => !had.has(id));
}

export function mentionToken(member: WorkspaceMember): string {
  return /^[\p{L}\p{N}_.-]+$/u.test(member.displayName) ? `@${member.displayName}` : `@{${member.displayName}}`;
}

export function splitMentions(text: string, members: WorkspaceMember[]): (string | MentionHit)[] {
  const parts: (string | MentionHit)[] = [];
  let cursor = 0;
  for (const hit of findMentions(text, members)) {
    if (hit.start > cursor) parts.push(text.slice(cursor, hit.start));
    parts.push(hit);
    cursor = hit.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

const CODE = /(```[\s\S]*?```|`[^`\n]*`)/;

export function linkMentions(markdown: string, members: WorkspaceMember[]): string {
  if (!markdown.includes('@') || members.length === 0) return markdown;
  return markdown
    .split(CODE)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return splitMentions(part, members)
        .map(piece =>
          typeof piece === 'string'
            ? piece
            : `[@${piece.member.displayName.replace(/[[\]]/g, '')}](${MENTION_HREF}${piece.member.userId})`,
        )
        .join('');
    })
    .join('');
}

export function snippet(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 3).trimEnd()}...` : flat;
}
