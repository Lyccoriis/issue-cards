import { useMemo, useRef, useState } from 'react';

import UserAvatar from '@/components/shared/UserAvatar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { mentionToken } from '@/lib/mentions';
import { ROLE_LABEL } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';

type FieldProps = Omit<React.ComponentProps<'textarea'>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  multiline?: boolean;
};

const TRIGGER = /(?<![\p{L}\p{N}_@])@([\p{L}\p{N}_.-]*)$/u;
const MAX_SHOWN = 6;

export default function MentionField({ value, onValueChange, multiline, onKeyDown, onBlur, ...rest }: FieldProps) {
  const members = useAuthStore(s => s.members);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const query = useMemo(() => TRIGGER.exec(value.slice(0, caret)), [value, caret]);

  const matches = useMemo(() => {
    if (!query) return [];
    const typed = query[1].toLowerCase();
    return members
      .filter(m => !typed || m.displayName.toLowerCase().includes(typed) || m.email.toLowerCase().startsWith(typed))
      .slice(0, MAX_SHOWN);
  }, [members, query]);

  const open = !dismissed && matches.length > 0;

  function pick(position: number) {
    const member = matches[position];
    if (!member || !query) return;
    const start = caret - query[0].length;
    const token = `${mentionToken(member)} `;
    const next = value.slice(0, start) + token + value.slice(caret);
    onValueChange(next);
    const at = start + token.length;
    setCaret(at);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(at, at);
    });
  }

  function look(element: HTMLInputElement | HTMLTextAreaElement) {
    setCaret(element.selectionStart ?? element.value.length);
  }

  const shared = {
    ref,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      onValueChange(event.target.value);
      look(event.target);
      setDismissed(false);
      setIndex(0);
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      if (event.key.startsWith('Arrow') && open) return;
      look(event.currentTarget);
    },
    onClick: (event: React.MouseEvent<HTMLInputElement & HTMLTextAreaElement>) => look(event.currentTarget),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      if (open) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setIndex(i => (i + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          event.stopPropagation();
          pick(index);
          return;
        }
      }
      onKeyDown?.(event as never);
    },
    onBlur: (event: React.FocusEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      setDismissed(true);
      onBlur?.(event as never);
    },
    ...rest,
  };

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>{multiline ? <Textarea {...shared} /> : <Input {...(shared as unknown as React.ComponentProps<'input'>)} />}</PopoverAnchor>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-64 p-1"
        onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
      >
        <div className="px-2 py-1 text-[11px] text-muted-foreground">Mention someone</div>
        {matches.map((member, position) => (
          <button
            key={member.userId}
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => pick(position)}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] outline-none',
              position === index ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
            )}
          >
            <UserAvatar
              name={member.displayName}
              initials={member.initials}
              accent={member.accent}
              url={member.avatarUrl}
              className="size-5"
            />
            <span className="min-w-0 flex-1 truncate">{member.displayName}</span>
            <span className="text-[11px] text-muted-foreground">{ROLE_LABEL[member.role]}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
