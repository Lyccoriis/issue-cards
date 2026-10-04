import { useEffect, useRef, useState, type ComponentType } from 'react';

import IssueCardsPanel from '@/panels/IssueCards';
import LeaderboardPanel from '@/panels/Leaderboard';
import SettingsPanel from '@/panels/Settings';
import TestingPanel from '@/panels/Testing';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type { PanelId } from '@/types';

const PANELS: Array<[PanelId, ComponentType]> = [
  ['issue-cards', IssueCardsPanel],
  ['testing', TestingPanel],
  ['leaderboard', LeaderboardPanel],
  ['settings', SettingsPanel],
];

export default function PanelHost() {
  const activePanel = useLayoutStore(s => s.activePanel);
  const seen = useRef(new Set<PanelId>());
  const [warm, setWarm] = useState(false);
  seen.current.add(activePanel);

  useEffect(() => {
    const id = requestIdleCallback(() => setWarm(true), { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }, []);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {PANELS.filter(([id]) => warm || seen.current.has(id)).map(([id, Panel]) => (
        <div key={id} className={id === activePanel ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}>
          <Panel />
        </div>
      ))}
    </div>
  );
}
