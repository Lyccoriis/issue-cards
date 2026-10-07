import { FlaskConical, Undo2 } from 'lucide-react';

import RichText from '@/components/shared/Mentions';
import { Badge } from '@/components/ui/badge';
import { relTime } from '@/lib/relTime';
import { SEVERITY_LABEL, type Rejection, type RejectionSeverity } from '@/types';
import { PersonLine } from './IssueBits';

export const SEVERITY_COLOR: Record<RejectionSeverity, string> = {
  'still-broken': 'var(--destructive)',
  'partly-fixed': 'var(--warning)',
  'wrong-fix': 'var(--destructive)',
};

export function SeverityBadge({ severity }: { severity: RejectionSeverity }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className="dot" style={{ background: SEVERITY_COLOR[severity] }} />
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}

export function RejectionBanner({ rejection }: { rejection: Rejection }) {
  return (
    <div
      className="rounded-md border border-border bg-destructive/8 p-3"
      style={{ borderLeft: '3px solid var(--destructive)' }}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Undo2 size={15} strokeWidth={1.6} className="text-destructive" />
        <span className="text-[12px] font-semibold text-foreground">The last fix was rejected</span>
        <SeverityBadge severity={rejection.severity} />
        {rejection.version && <Badge variant="secondary">Ver. {rejection.version}</Badge>}
        <span className="mono ml-auto flex items-center gap-1.5">
          {rejection.by ? (
            <PersonLine userId={rejection.byId} name={rejection.by} />
          ) : (
            'someone'
          )}
          · {rejection.time}
          {relTime(rejection.time) && ` · ${relTime(rejection.time)}`}
        </span>
      </div>
      <RichText text={rejection.reason} className="mt-1.5 text-[13px]" />
    </div>
  );
}

export default function RejectionHistory({
  rejections,
  onOpenMedia,
}: {
  rejections: Rejection[];
  onOpenMedia?: (url: string, name: string, video: boolean) => void;
}) {
  if (rejections.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {rejections.map((row, index) => (
        <div
          key={row.id}
          className="rounded-md border border-border p-2.5"
          style={{ borderLeft: '2px solid var(--destructive)' }}
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              fix {index + 1} rejected by
              {row.by ? (
                <PersonLine userId={row.byId} name={row.by} />
              ) : (
                <span>somebody</span>
              )}
            </span>
            <SeverityBadge severity={row.severity} />
            {row.version && <Badge variant="secondary">Ver. {row.version}</Badge>}
            {row.time && (
              <span className="mono ml-auto">
                {row.time}
                {relTime(row.time) && ` · ${relTime(row.time)}`}
              </span>
            )}
          </div>

          <RichText text={row.reason} className="mt-1.5 text-[13px]" />

          {row.tested && (
            <div className="mt-2 rounded-md border border-border/70 bg-muted/30 p-2">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FlaskConical size={15} strokeWidth={1.6} />
                what was run
              </div>
              <RichText text={row.tested} className="mt-1 text-[12.5px]" />
            </div>
          )}

          {row.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.attachments.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="overflow-hidden rounded-md border border-border"
                  onClick={() =>
                    item.kind === 'image' || item.kind === 'video'
                      ? onOpenMedia?.(item.url, item.name, item.kind === 'video')
                      : window.api.shell.openExternal(item.url)
                  }
                >
                  {item.kind === 'image' ? (
                    <img src={item.url} alt={item.name} className="size-16 object-cover" />
                  ) : (
                    <span className="block max-w-[180px] truncate px-2 py-1.5 text-[11px]">
                      {item.name || item.url}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
