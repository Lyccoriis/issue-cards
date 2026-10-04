import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { colorOf, tagStyle } from '@/lib/tags';
import { cn } from '@/lib/utils';
import { useTags } from '@/stores/useTagStore';
import type { TagColor } from '@/types';

interface TagBadgeProps {
  tag: string;
  color?: TagColor;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}

export default function TagBadge({
  tag,
  color,
  count,
  active = false,
  onClick,
  onRemove,
  className,
}: TagBadgeProps) {
  const tags = useTags();
  const style = tagStyle(color ?? colorOf(tags, tag), active);

  const body = (
    <>
      {tag}
      {count !== undefined && <span className="tnum opacity-70">{count}</span>}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`remove ${tag}`}
          className="cursor-pointer opacity-60 transition-opacity hover:opacity-100"
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            e.stopPropagation();
            onRemove();
          }}
        >
          <X size={11} strokeWidth={2} />
        </span>
      )}
    </>
  );

  const classes = cn('gap-1', onClick && 'cursor-pointer', className);

  if (!onClick) {
    return (
      <Badge variant="outline" className={classes} style={style}>
        {body}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={classes} style={style} asChild>
      <button
        type="button"
        title={active ? `Stop filtering by ${tag}` : `Filter by ${tag}`}
        onClick={e => {
          e.stopPropagation();
          onClick();
        }}
      >
        {body}
      </button>
    </Badge>
  );
}
