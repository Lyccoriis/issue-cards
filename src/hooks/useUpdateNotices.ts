import { useEffect } from 'react';

import { useNotificationStore } from '@/stores/useNotificationStore';
import { useUpdateStore } from '@/stores/useUpdateStore';

const VERSION_KEY = 'issue-cards:last-version';

function notice(id: string, title: string, body: string): void {
  useNotificationStore.getState().push(
    { workspaceId: '', actorId: null, actorName: '', kind: 'update', title, body, linkKind: 'settings', linkRef: '', linkSub: '' },
    `local:${id}`,
  );
}

export function useUpdateNotices(): void {
  useEffect(() => {
    return useUpdateStore.subscribe((now, before) => {
      const stage = now.state.stage;
      if (stage === before.state.stage) return;
      const { version } = now.state;
      if (stage === 'available') notice(`update-found:${version}`, `Version ${version} is out`, 'Downloading it now');
      else if (stage === 'ready') notice(`update-ready:${version}`, `Version ${version} is downloaded`, 'Restart to update to the latest version');
      else if (stage === 'error' && before.state.stage === 'downloading') {
        notice(`update-failed:${version}`, 'The update did not download', now.state.message || 'Try again from Settings');
      }
    });
  }, []);

  const currentVersion = useUpdateStore(s => s.state.currentVersion);
  const supported = useUpdateStore(s => s.state.supported);

  useEffect(() => {
    if (!currentVersion || !supported) return;
    const last = localStorage.getItem(VERSION_KEY);
    localStorage.setItem(VERSION_KEY, currentVersion);
    if (last && last !== currentVersion) {
      notice(`updated:${currentVersion}`, 'Updated to the latest version', `Now on ${currentVersion}, was ${last}`);
    }
  }, [currentVersion, supported]);
}
