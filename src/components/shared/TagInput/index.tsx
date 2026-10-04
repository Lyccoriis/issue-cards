import { useState } from 'react';

import TagBadge from '@/components/shared/TagBadge';
import { Input } from '@/components/ui/input';
import { dedupe, normalizeTag, parseTags } from '@/lib/tags';

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  chipsBelow?: boolean;
  limit?: number;
}

export default function TagInput({
  id,
  value,
  onChange,
  suggestions = [],
  placeholder = 'Type a tag, press Enter',
  chipsBelow = false,
  limit = 8,
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  const has = (tag: string) => value.some(t => t.toLowerCase() === tag.toLowerCase());

  function add(raw: string) {
    const tags = parseTags(raw).filter(tag => !has(tag));
    if (tags.length) onChange(dedupe([...value, ...tags]));
    setDraft('');
  }

  function remove(tag: string) {
    onChange(value.filter(t => t !== tag));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (normalizeTag(draft)) add(draft);
      return;
    }
    if (e.key === 'Backspace' && draft === '' && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const query = draft.trim().toLowerCase();
  const offered = suggestions
    .filter(tag => !has(tag) && (query === '' || tag.toLowerCase().includes(query)))
    .slice(0, limit);

  const chosen = value.length > 0 && (
    <div className="flex flex-wrap gap-1.5">
      {value.map(tag => (
        <TagBadge key={tag} tag={tag} onRemove={() => remove(tag)} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {!chipsBelow && chosen}

      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => normalizeTag(draft) && add(draft)}
      />

      {chipsBelow && chosen}

      {offered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {offered.map(tag => (
            <TagBadge key={tag} tag={tag} onClick={() => add(tag)} className="opacity-70" />
          ))}
        </div>
      )}
    </div>
  );
}
