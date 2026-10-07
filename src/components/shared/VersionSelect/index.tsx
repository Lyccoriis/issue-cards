import { Check } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useVersions } from '@/lib/versions';

interface VersionSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function VersionSelect({ id, value, onChange, className, disabled }: VersionSelectProps) {
  const { list, current } = useVersions(value);

  function move(event: React.KeyboardEvent, step: number) {
    event.preventDefault();
    const at = list.indexOf(value);
    const next = list[Math.min(list.length - 1, Math.max(0, (at < 0 ? (step > 0 ? -1 : list.length) : at) + step))];
    if (next) onChange(next);
  }

  return (
    <div
      id={id}
      role="listbox"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={event => {
        if (disabled) return;
        if (event.key === 'ArrowDown') move(event, 1);
        else if (event.key === 'ArrowUp') move(event, -1);
      }}
      className={`flex max-h-[148px] flex-col gap-0.5 overflow-y-auto rounded-md border border-input p-1 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
        disabled ? 'pointer-events-none opacity-50' : ''
      } ${className ?? 'w-full'}`}
    >
      {list.length === 0 && (
        <div className="px-2 py-1.5 text-[12px] text-muted-foreground">
          No versions yet, the owner sets one in Settings
        </div>
      )}
      {list.map(name => (
        <button
          key={name}
          type="button"
          role="option"
          tabIndex={-1}
          aria-selected={name === value}
          onClick={() => onChange(name)}
          ref={el => {
            if (el && name === value) el.scrollIntoView({ block: 'nearest' });
          }}
          className={`flex shrink-0 items-center gap-2 rounded-sm px-2 py-1 text-left text-[13px] transition-colors duration-150 ${
            name === value ? 'bg-primary/15 text-foreground' : 'hover:bg-muted/60'
          } ${name === current ? 'text-primary' : ''}`}
        >
          <span className="mono min-w-0 flex-1 truncate">{name}</span>
          {name === current && <Badge variant="outline">current</Badge>}
          {name === value && <Check size={14} strokeWidth={1.8} />}
        </button>
      ))}
    </div>
  );
}
