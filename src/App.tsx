import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import AuthScreen from '@/components/auth/AuthScreen';
import ConnectionScreen from '@/components/auth/ConnectionScreen';
import AppShell from '@/components/layout/AppShell';
import GlobalFinder from '@/components/layout/GlobalFinder';
import TitleBar from '@/components/layout/TitleBar';
import UserProfile from '@/components/shared/UserProfile';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useKeybindings } from '@/hooks/useKeybindings';
import { useApplyTheme } from '@/hooks/useTheme';
import { useUpdateNotices } from '@/hooks/useUpdateNotices';
import { imgurClientId } from '@/lib/supabase';
import { notifyDueDates } from '@/lib/notifyEvents';
import { useAuthStore } from '@/stores/useAuthStore';
import { useIssueStore } from '@/stores/useIssueStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useSeenStore } from '@/stores/useSeenStore';
import { useTagStore } from '@/stores/useTagStore';
import { useTestStore } from '@/stores/useTestStore';
import { useUploadStore } from '@/stores/useUploadStore';
import { onUpdateAnnounce, useUpdateStore } from '@/stores/useUpdateStore';

function revealApp(): void {
  document.body.classList.add('booted');
  const splash = document.getElementById('splash');
  if (!splash || splash.classList.contains('done')) return;
  splash.classList.add('done');
  setTimeout(() => splash.remove(), 300);
}

export default function App() {
  const ready = useAuthStore(s => s.ready);
  const configured = useAuthStore(s => s.configured);
  const session = useAuthStore(s => s.session);
  const workspaceId = useAuthStore(s => s.activeWorkspaceId);
  const init = useAuthStore(s => s.init);
  const issuesLoaded = useIssueStore(s => s.loaded);
  const userId = useAuthStore(s => s.profile?.id ?? null);

  useApplyTheme();
  useKeybindings();
  useUpdateNotices();

  useEffect(() => {
    void init();
    window.api.upload.setImgurKey(imgurClientId());
  }, [init]);

  useEffect(() => useUploadStore.getState().listen(), []);

  useEffect(() => {
    const store = useNotificationStore.getState();
    if (!userId) {
      store.reset();
      return;
    }
    void store.load();
    const stopWatching = store.watch(userId);
    const stopClicks = window.api.notify.onOpen(id => useNotificationStore.getState().openById(id));
    return () => {
      stopWatching();
      stopClicks();
    };
  }, [userId]);

  const dueChecked = useRef(false);
  useEffect(() => {
    if (!issuesLoaded || !workspaceId || dueChecked.current) return;
    dueChecked.current = true;
    notifyDueDates(useIssueStore.getState().cards);
  }, [issuesLoaded, workspaceId]);

  useEffect(() => {
    onUpdateAnnounce(state => {
      if (state.stage === 'none') toast.success('This is the latest version');
      else if (state.stage === 'error') toast.error(state.message || 'Could not reach the update feed');
    });
    return useUpdateStore.getState().start();
  }, []);

  useEffect(() => {
    const issues = useIssueStore.getState();
    const auth = useAuthStore.getState();
    const tests = useTestStore.getState();
    if (!workspaceId) {
      issues.unwatch();
      auth.unwatchPeople();
      tests.unwatch();
      useSeenStore.getState().clear();
      return;
    }
    void issues.load();
    void useTagStore.getState().load();
    void useSeenStore.getState().load(workspaceId);
    void tests.load();
    issues.watch();
    auth.watchPeople();
    tests.watch();
    return () => {
      issues.unwatch();
      auth.unwatchPeople();
      tests.unwatch();
    };
  }, [workspaceId]);

  const booted = !configured || (ready && (!session || !workspaceId || issuesLoaded));

  useEffect(() => {
    if (booted) revealApp();
  }, [booted]);

  let body: React.ReactNode;
  if (!configured) body = <ConnectionScreen onSaved={() => window.location.reload()} />;
  else if (!ready) {
    body = (
      <div className="flex h-full w-full gap-4 p-6">
        <Skeleton className="h-full w-12" />
        <Skeleton className="h-full flex-1" />
      </div>
    );
  } else if (!session) body = <AuthScreen />;
  else {
    body = (
      <>
        <AppShell />
        <GlobalFinder />
        <UserProfile />
      </>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full w-full min-w-0 flex-col">
        <TitleBar />
        <div className="flex min-h-0 min-w-0 flex-1">{body}</div>
      </div>
      <Toaster position="bottom-center" />
    </TooltipProvider>
  );
}
