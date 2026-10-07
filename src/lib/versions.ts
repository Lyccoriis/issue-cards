import { useMemo } from 'react';

import { useAuthStore } from '@/stores/useAuthStore';
import { useIssueStore } from '@/stores/useIssueStore';
import { useTestStore } from '@/stores/useTestStore';

function byNewest(a: string, b: string): number {
  return b.localeCompare(a, undefined, { numeric: true });
}

export function useVersions(extra = ''): { list: string[]; current: string } {
  const workspace = useAuthStore(s => s.workspaces.find(w => w.id === s.activeWorkspaceId) ?? null);
  const cards = useIssueStore(s => s.cards);
  const features = useTestStore(s => s.features);

  const current = workspace?.currentVersion ?? '';

  const list = useMemo(() => {
    const seen = new Map<string, string>();
    const add = (value: string | undefined) => {
      const name = value?.trim();
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    };
    add(current);
    add(extra);
    workspace?.versions.forEach(add);
    for (const card of cards) {
      add(card.version);
      add(card.fixedVersion);
      add(card.closedVersion);
      card.rejectionList.forEach(r => add(r.version));
    }
    for (const feature of features) {
      add(feature.version);
      feature.results.forEach(r => add(r.version));
    }
    return [...seen.values()].sort(byNewest);
  }, [workspace, current, extra, cards, features]);

  return { list, current };
}
