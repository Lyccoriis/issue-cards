import { cn } from '@/lib/utils';

export default function WhyDisabled({ reason, className }: { reason: string | null; className?: string }) {
  if (!reason) return null;
  return (
    <span role="status" className={cn('min-w-0 text-[12px] leading-snug break-words text-destructive', className)}>
      {reason}
    </span>
  );
}
