import { useMemo } from 'react';

import { splitMentions } from '@/lib/mentions';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUiStore } from '@/stores/useUiStore';

export function MentionChip({ userId, label }: { userId: string; label?: string }) {
  const member = useAuthStore(s => s.members.find(m => m.userId === userId) ?? null);
  const mine = useAuthStore(s => s.profile?.id === userId);
  const openProfile = useUiStore(s => s.openUserProfile);
  const name = member?.displayName ?? label ?? 'Unknown';

  return (
    <button
      type="button"
      title={member ? `Open ${name}'s profile` : name}
      disabled={!member}
      onClick={event => {
        event.stopPropagation();
        openProfile(userId);
      }}
      className={cn(
        'inline rounded px-1 py-px text-[0.95em] font-medium transition-colors duration-150',
        'bg-primary/15 text-primary hover:bg-primary/25 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        mine && 'bg-primary/30',
      )}
    >
      @{name}
    </button>
  );
}

export function RichInline({ text }: { text: string }) {
  const members = useAuthStore(s => s.members);
  const parts = useMemo(() => splitMentions(text, members), [text, members]);

  return (
    <>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          <span key={index}>{part}</span>
        ) : (
          <MentionChip key={index} userId={part.member.userId} />
        ),
      )}
    </>
  );
}

export default function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('whitespace-pre-wrap', className)}>
      <RichInline text={text} />
    </div>
  );
}
