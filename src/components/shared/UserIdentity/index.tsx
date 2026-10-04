import type { ReactNode } from 'react';
import { Copy, Filter, Mail, User } from 'lucide-react';
import { toast } from 'sonner';

import UserAvatar from '@/components/shared/UserAvatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { resolveIdentity } from '@/lib/identity';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIssueStore } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useUiStore } from '@/stores/useUiStore';

export interface IdentityAction {
  label: string;
  run: () => void;
}

interface UserIdentityProps {
  userId?: string | null;
  name?: string;
  showName?: boolean;
  showAvatar?: boolean;
  action?: IdentityAction;
  active?: boolean;
  extras?: ReactNode;
  className?: string;
  avatarClassName?: string;
  nameClassName?: string;
}

export default function UserIdentity({
  userId,
  name,
  showName = false,
  showAvatar = true,
  action,
  active = false,
  extras,
  className,
  avatarClassName,
  nameClassName,
}: UserIdentityProps) {
  const members = useAuthStore(s => s.members);
  const prefs = useLayoutStore(s => s.identity);
  const openProfile = useUiStore(s => s.openUserProfile);
  const toggleAuthor = useIssueStore(s => s.toggleAuthor);
  const filtered = useIssueStore(s => s.filters.author);

  const person = resolveIdentity(members, userId, name);
  if (!person.name && !person.member) return null;

  const avatar = showAvatar ? (
    <UserAvatar
      name={person.name}
      initials={person.initials}
      accent={person.accent}
      url={person.avatarUrl}
      className={cn('size-5', active && 'ring-[3px] ring-ring/50', avatarClassName)}
    />
  ) : null;

  const label = showName ? (
    <span
      className={cn(
        'truncate',
        prefs.underline && person.member && 'group-hover/identity:underline underline-offset-2',
        nameClassName,
      )}
    >
      {person.name}
    </span>
  ) : null;

  if (!person.member) {
    return (
      <span
        className={cn('inline-flex min-w-0 items-center gap-1.5 text-muted-foreground', className)}
        title={person.name ? `${person.name}, no longer in this workspace` : undefined}
      >
        {avatar}
        {label}
      </span>
    );
  }

  const memberId = person.member.userId;
  const onList = filtered.includes(memberId);
  const primary = prefs.click === 'action' && action ? action.run : () => openProfile(memberId);

  function copy(text: string, said: string) {
    void navigator.clipboard.writeText(text);
    toast.success(said);
  }

  const trigger = (
    <span
      role="button"
      tabIndex={0}
      title={person.name}
      onClick={event => {
        event.stopPropagation();
        primary();
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        primary();
      }}
      className={cn(
        'group/identity inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full outline-none transition-opacity duration-150',
        'hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        !active && 'opacity-90',
        className,
      )}
    >
      {avatar}
      {label}
    </span>
  );

  if (!prefs.menu) return trigger;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="truncate text-[11px] text-muted-foreground">
          {person.name}
        </ContextMenuLabel>
        <ContextMenuSeparator />

        <ContextMenuItem onSelect={() => openProfile(memberId)}>
          <User size={15} strokeWidth={1.6} />
          Open their profile
        </ContextMenuItem>

        {action && (
          <ContextMenuItem onSelect={() => action.run()}>
            <Filter size={15} strokeWidth={1.6} />
            {action.label}
          </ContextMenuItem>
        )}

        {!action && (
          <ContextMenuItem onSelect={() => toggleAuthor(memberId)}>
            <Filter size={15} strokeWidth={1.6} />
            {onList ? 'Stop filtering by them' : 'Show only their cards'}
          </ContextMenuItem>
        )}

        {extras}

        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => copy(person.name, 'Name copied')}>
          <Copy size={15} strokeWidth={1.6} />
          Copy name
        </ContextMenuItem>
        {person.email && (
          <ContextMenuItem onSelect={() => copy(person.email, 'Email copied')}>
            <Mail size={15} strokeWidth={1.6} />
            Copy email
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
