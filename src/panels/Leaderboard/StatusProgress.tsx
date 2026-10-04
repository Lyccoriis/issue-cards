import { STATUSES } from '@/stores/useIssueStore';
import { STATUS_COLOR } from '@/panels/IssueCards/IssueBits';
import type { Progress } from '@/lib/leaderboard';

export default function StatusProgress({ progress }: { progress: Progress }) {
  const { total, counts, done } = progress;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="tnum text-[28px] font-semibold leading-none">
          {Math.round(done * 100)}%
        </span>
        <span className="text-[12px] text-muted-foreground">
          {total === 0
            ? 'nothing filed in this window'
            : `of ${total} ${total === 1 ? 'card' : 'cards'} is behind you`}
        </span>
      </div>

      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {STATUSES.map(status =>
          counts[status] > 0 ? (
            <span
              key={status}
              title={`${counts[status]} ${status}`}
              style={{
                width: `${(counts[status] / total) * 100}%`,
                background: STATUS_COLOR[status],
              }}
            />
          ) : null,
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {STATUSES.map(status => (
          <span key={status} className="flex items-center gap-1.5 text-[12px]">
            <span className="dot" style={{ background: STATUS_COLOR[status] }} />
            <span className="text-muted-foreground">{status}</span>
            <span className="tnum font-medium">{counts[status]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
