import {
  ArrowDownWideNarrow,
  Bell,
  Bug,
  CheckCheck,
  Download,
  FlaskConical,
  Image,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SquareCheck,
  SquareDashed,
  TableProperties,
  Trophy,
  Undo2,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore, activeWorkspace } from '@/stores/useAuthStore';
import { permissionsFor } from '@/lib/permissions';
import { useFinderStore } from '@/stores/useFinderStore';
import { useIssueStore, visibleCards } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useUiStore } from '@/stores/useUiStore';
import { useUpdateStore } from '@/stores/useUpdateStore';
import type { PanelId } from '@/types';

export interface AppCommand {
  id: string;
  label: string;
  hint: string;
  icon?: LucideIcon;
  panelId?: PanelId;
  defaultKey: string;
  run: () => void;
}

function goTo(panelId: PanelId, label: string, defaultKey: string): AppCommand {
  return {
    id: `panel.${panelId}`,
    label: `Go to ${label}`,
    hint: 'Panel',
    panelId,
    defaultKey,
    run: () => useLayoutStore.getState().setActivePanel(panelId),
  };
}

export const APP_COMMANDS: AppCommand[] = [
  {
    id: 'finder.open',
    label: 'Open finder',
    hint: 'Search every card and command',
    icon: Search,
    defaultKey: 'Ctrl+K',
    run: () => useFinderStore.getState().toggle(),
  },
  {
    id: 'finder.find',
    label: 'Find',
    hint: 'Same as the finder, bound to Ctrl+F as well',
    icon: Search,
    defaultKey: 'Ctrl+F',
    run: () => useFinderStore.getState().toggle(),
  },
  {
    id: 'nav.toggle',
    label: 'Toggle nav sidebar',
    hint: 'Expand or retract the left sidebar',
    icon: PanelLeft,
    defaultKey: 'Ctrl+B',
    run: () => {
      const { navSidebar, setNavSidebar } = useLayoutStore.getState();
      setNavSidebar({ mode: navSidebar.mode === 'expanded' ? 'retracted' : 'expanded' });
    },
  },
  {
    id: 'issues.new',
    label: 'New issue card',
    hint: 'File a card in the open workspace',
    icon: Plus,
    defaultKey: 'Ctrl+N',
    run: () => {
      if (!canWrite()) return;
      useLayoutStore.getState().setActivePanel('issue-cards');
      useUiStore.getState().openIssueForm(null);
    },
  },
  {
    id: 'issues.importSheet',
    label: 'Import issues from sheet',
    hint: 'Paste bug sheet rows, or open a .tsv export',
    icon: TableProperties,
    defaultKey: '',
    run: () => {
      if (!canWrite()) return;
      useLayoutStore.getState().setActivePanel('issue-cards');
      useUiStore.getState().openSheetImport();
    },
  },
  {
    id: 'issues.reload',
    label: 'Reload issue cards',
    hint: 'Read the workspace again',
    icon: RefreshCw,
    defaultKey: 'Ctrl+R',
    run: () => {
      void useIssueStore.getState().load(true);
    },
  },
  {
    id: 'issues.rejectFix',
    label: 'Reject the fix on the open card',
    hint: 'Sends a fixed card back to open with the reason kept on it',
    icon: Undo2,
    defaultKey: 'Ctrl+Shift+R',
    run: () => {
      if (!canWrite()) return;
      const { cards, selectedId } = useIssueStore.getState();
      const card = cards.find(c => c.id === selectedId);
      if (!card) {
        toast.error('Open a card first');
        return;
      }
      if (card.status !== 'fixed') {
        toast.error(`${card.id} is ${card.status}, only a fixed card can be rejected`);
        return;
      }
      useLayoutStore.getState().setActivePanel('issue-cards');
      useUiStore.getState().askReject(card.id);
    },
  },
  {
    id: 'issues.orderRelevant',
    label: 'Order cards by relevance',
    hint: 'Open, urgent, overdue and rejected cards first',
    icon: ArrowDownWideNarrow,
    defaultKey: '',
    run: () => useIssueStore.getState().setOrder('relevant'),
  },
  {
    id: 'issues.orderRecent',
    label: 'Order cards by most recent',
    hint: 'Whatever was touched last, newest first',
    icon: ArrowDownWideNarrow,
    defaultKey: '',
    run: () => useIssueStore.getState().setOrder('recent'),
  },
  {
    id: 'issues.orderOldest',
    label: 'Order cards by oldest',
    hint: 'Longest standing card first',
    icon: ArrowDownWideNarrow,
    defaultKey: '',
    run: () => useIssueStore.getState().setOrder('oldest'),
  },
  {
    id: 'account.picture',
    label: 'Change the profile picture',
    hint: 'Upload an image or paste a link',
    icon: Image,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setActivePanel('settings');
      useUiStore.getState().openPicture('avatar');
    },
  },
  {
    id: 'account.banner',
    label: 'Change the profile banner',
    hint: 'The strip behind your face on your profile',
    icon: Image,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setActivePanel('settings');
      useUiStore.getState().openPicture('banner');
    },
  },
  {
    id: 'account.profile',
    label: 'Open my profile',
    hint: 'The same popup every face in the app opens',
    icon: User,
    defaultKey: '',
    run: () => {
      const me = useAuthStore.getState().profile;
      if (me) useUiStore.getState().openUserProfile(me.id);
    },
  },
  {
    id: 'workspace.people',
    label: 'Show the people in this workspace',
    hint: 'Who is in it, what they may do, what they filed',
    icon: Users,
    defaultKey: '',
    run: () => useLayoutStore.getState().setActivePanel('settings'),
  },
  {
    id: 'issues.clearFilters',
    label: 'Clear issue filters',
    hint: 'Drop the search text and every filter',
    icon: Bug,
    defaultKey: '',
    run: () => useIssueStore.getState().clearFilters(),
  },
  {
    id: 'issues.selectAll',
    label: 'Select every card shown',
    hint: 'Puts the whole filtered list in the selection bar',
    icon: SquareCheck,
    defaultKey: '',
    run: () => {
      const store = useIssueStore.getState();
      useLayoutStore.getState().setActivePanel('issue-cards');
      store.setChecked(visibleCards(store).map(card => card.id));
    },
  },
  {
    id: 'issues.clearSelection',
    label: 'Clear the card selection',
    hint: 'Unchecks every selected card',
    icon: SquareDashed,
    defaultKey: '',
    run: () => useIssueStore.getState().clearChecked(),
  },
  {
    id: 'notifications.open',
    label: 'Open notifications',
    hint: 'The tray above your picture, mentions and everything waiting for you',
    icon: Bell,
    defaultKey: 'Ctrl+Shift+N',
    run: () => {
      const ui = useUiStore.getState();
      ui.setTrayOpen(!ui.trayOpen);
    },
  },
  {
    id: 'notifications.markAllRead',
    label: 'Mark every notification as read',
    hint: 'Puts out the green dot above your picture',
    icon: CheckCheck,
    defaultKey: '',
    run: () => {
      void useNotificationStore.getState().markAllRead();
    },
  },
  {
    id: 'app.checkUpdates',
    label: 'Check for updates',
    hint: 'Ask the release bucket whether a newer build is up',
    icon: Download,
    defaultKey: '',
    run: () => {
      useLayoutStore.getState().setActivePanel('settings');
      void useUpdateStore.getState().check(true);
    },
  },
  {
    id: 'account.signOut',
    label: 'Sign out',
    hint: 'Leave the account on this machine',
    icon: Settings,
    defaultKey: '',
    run: () => {
      void useAuthStore.getState().signOut();
    },
  },

  {
    id: 'tests.new',
    label: 'New test feature',
    hint: 'Write what was done and what to test',
    icon: FlaskConical,
    defaultKey: '',
    run: () => {
      if (!permissionsFor(activeWorkspace()?.role).writeFeatures) {
        toast.error('Your role in this workspace tests features, it does not add them');
        return;
      }
      useLayoutStore.getState().setActivePanel('testing');
      useUiStore.getState().openTestForm(null);
    },
  },

  {
    id: 'leaderboard.open',
    label: 'Show the leaderboard',
    hint: 'Who did what, over a range of dates, and how much of the pile is behind you',
    icon: Trophy,
    defaultKey: '',
    run: () => useLayoutStore.getState().setActivePanel('leaderboard'),
  },

  goTo('issue-cards', 'Issue Cards', 'Ctrl+1'),
  goTo('leaderboard', 'Leaderboard', 'Ctrl+2'),
  goTo('testing', 'Testing', 'Ctrl+3'),
  goTo('settings', 'Settings', 'Ctrl+,'),
];

function canWrite(): boolean {
  if (permissionsFor(activeWorkspace()?.role).writeCards) return true;
  toast.error('Your role in this workspace reads the cards, it does not write them');
  return false;
}

export function resolveBindings(overrides: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const command of APP_COMMANDS) {
    const custom = overrides?.[command.id];
    out[command.id] = custom === undefined ? command.defaultKey : custom;
  }
  return out;
}
