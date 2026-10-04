import type { WorkspaceMember } from '@/types';

export interface Identity {
  userId: string | null;
  name: string;
  initials: string;
  accent: string;
  avatarUrl: string;
  email: string;
  member: WorkspaceMember | null;
}

function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function resolveIdentity(
  members: WorkspaceMember[],
  userId: string | null | undefined,
  name: string | null | undefined,
): Identity {
  const written = (name ?? '').trim();

  const member =
    (userId ? members.find(m => m.userId === userId) : undefined) ??
    (written
      ? members.find(m => m.displayName.trim().toLowerCase() === written.toLowerCase())
      : undefined) ??
    null;

  if (member) {
    return {
      userId: member.userId,
      name: member.displayName,
      initials: member.initials,
      accent: member.accent,
      avatarUrl: member.avatarUrl,
      email: member.email,
      member,
    };
  }

  return {
    userId: null,
    name: written,
    initials: initialsFrom(written),
    accent: 'blue',
    avatarUrl: '',
    email: '',
    member: null,
  };
}
