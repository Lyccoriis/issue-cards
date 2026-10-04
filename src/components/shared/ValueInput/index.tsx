import TagBadge from '@/components/shared/TagBadge';
import { Input } from '@/components/ui/input';
import { fallbackColor } from '@/lib/tags';

interface ValueInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
}

export default function ValueInput({
  id,
  value,
  onChange,
  suggestions = [],
  placeholder,
}: ValueInputProps) {
  const offered = suggestions.filter(s => s.toLowerCase() !== value.trim().toLowerCase()).slice(0, 6);

  return (
    <div className="flex flex-col gap-2">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />

      {offered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {offered.map(name => (
            <TagBadge
              key={name}
              tag={name}
              color={fallbackColor(name)}
              onClick={() => onChange(name)}
              className="opacity-70"
            />
          ))}
        </div>
      )}
    </div>
  );
}
