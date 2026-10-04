import { ACCENTS } from '@/lib/accents';

interface ColorSwatchesProps {
  value: string;
  onPick: (color: string) => void;
  disabled?: boolean;
  label?: string;
}

export default function ColorSwatches({ value, onPick, disabled, label = 'color' }: ColorSwatchesProps) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {ACCENTS.map(accent => (
        <button
          key={accent}
          type="button"
          disabled={disabled}
          aria-label={`${label} ${accent}`}
          aria-pressed={value === accent}
          data-accent={accent}
          onClick={() => onPick(accent)}
          className={`size-5 rounded-full border transition-transform duration-150 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${
            value === accent ? 'ring-[3px] ring-ring/50' : ''
          }`}
          style={{ background: 'var(--primary)' }}
        />
      ))}
    </div>
  );
}
