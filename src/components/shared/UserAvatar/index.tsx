import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type { AvatarBorder } from '@/types';

interface UserAvatarProps {
  name: string;
  initials: string;
  accent?: string;
  url?: string;
  className?: string;
  title?: string;
  border?: AvatarBorder;
}

export default function UserAvatar({
  name,
  initials,
  accent = 'blue',
  url,
  className,
  title,
  border = 'none',
}: UserAvatarProps) {
  const letters = (initials || name || '?').slice(0, 2).toUpperCase();
  const shape = useLayoutStore(s => s.identity.shape);

  return (
    <Avatar
      className={cn(
        'size-7',
        shape === 'square' && 'rounded-md',
        border === 'ring' && 'ring-[3px] ring-primary',
        border === 'glow' && 'ring-2 ring-primary/60',
        className,
      )}
      data-accent={accent}
      title={title ?? name}
      style={
        border === 'glow'
          ? { boxShadow: '0 0 20px color-mix(in oklab, var(--primary) 55%, transparent)' }
          : undefined
      }
    >
      {url && <AvatarImage src={url} alt={name} className="object-cover" />}
      <AvatarFallback
        className={cn('text-[11px] font-medium', shape === 'square' && 'rounded-md')}
        style={{
          color: 'var(--primary)',
          background: 'color-mix(in oklab, var(--primary) 18%, transparent)',
        }}
      >
        {letters}
      </AvatarFallback>
    </Avatar>
  );
}
