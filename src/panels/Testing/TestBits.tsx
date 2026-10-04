import { Badge } from '@/components/ui/badge';
import { Dot } from '@/panels/IssueCards/IssueBits';
import type { Attachment, FeatureStatus, StepStatus, TestResult } from '@/types';

export const FEATURE_LOOK: Record<FeatureStatus, { label: string; color: string }> = {
  untested: { label: 'not tested', color: 'var(--muted-foreground)' },
  testing: { label: 'in progress', color: 'var(--warning)' },
  passed: { label: 'passed', color: 'var(--success)' },
  failing: { label: 'failed', color: 'var(--destructive)' },
};

export const STEP_COLOR: Record<StepStatus, string> = {
  untested: 'var(--border)',
  passed: 'var(--success)',
  failed: 'var(--destructive)',
};

export function tint(color: string, percent = 14): string {
  return `color-mix(in oklab, ${color} ${percent}%, transparent)`;
}

export function StatusChip({ status }: { status: FeatureStatus }) {
  const look = FEATURE_LOOK[status];
  return (
    <Badge variant="outline" className="gap-1.5">
      <Dot color={look.color} />
      {look.label}
    </Badge>
  );
}

export function resultAttachments(result: TestResult): Attachment[] {
  return result.attachments.map(a => ({
    id: a.id,
    issueId: result.id,
    url: a.url,
    kind: a.kind,
    host: a.host,
    name: a.name,
    mime: a.mime,
    bytes: a.bytes,
    sourceUrl: a.sourceUrl,
    rejectionId: null,
    createdAt: a.createdAt,
    createdBy: a.createdBy,
  }));
}
