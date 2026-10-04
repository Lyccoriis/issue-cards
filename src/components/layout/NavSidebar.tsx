import { FlaskConical, KanbanSquare, PanelLeft, Settings, Ticket, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import NotificationTray from '@/components/shared/NotificationTray';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveBindings } from '@/lib/commands';
import { formatBinding } from '@/lib/keys';
import AccountMenu from './AccountMenu';
import { useIssueStore } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTestStore, waitingOnMe } from '@/stores/useTestStore';
import type { PanelId } from '@/types';

export interface NavItem {
  id: PanelId;
  label: string;
  icon: LucideIcon;
}

const PRIMARY: NavItem[] = [
  { id: 'issue-cards', label: 'Issue Cards', icon: KanbanSquare },
  { id: 'testing', label: 'Testing', icon: FlaskConical },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
];
const SYSTEM: NavItem[] = [{ id: 'settings', label: 'Settings', icon: Settings }];

export const NAV_ITEMS: NavItem[] = [...PRIMARY, ...SYSTEM];

const TITLE_BAR = 37;

interface NavSidebarProps {
  expanded: boolean;
}

export default function NavSidebar({ expanded }: NavSidebarProps) {
  const mode = useLayoutStore(s => s.navSidebar.mode);
  const setNavSidebar = useLayoutStore(s => s.setNavSidebar);
  const activePanel = useLayoutStore(s => s.activePanel);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);
  const openCount = useIssueStore(s => s.cards.filter(c => c.status === 'open').length);
  const toTest = useTestStore(s => waitingOnMe(s.features));
  const workspaceName = useAuthStore(
    s => s.workspaces.find(w => w.id === s.activeWorkspaceId)?.name ?? 'No workspace',
  );
  const workspaceColor = useAuthStore(
    s => s.workspaces.find(w => w.id === s.activeWorkspaceId)?.color ?? 'blue',
  );
  const binding = useAuthStore(s => resolveBindings(s.profile?.keys)['nav.toggle']);

  function toggleExpand() {
    setNavSidebar({ mode: mode === 'expanded' ? 'retracted' : 'expanded' });
  }

  function renderGroup(label: string, items: NavItem[]) {
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map(item => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={activePanel === item.id}
                  tooltip={item.label}
                  onClick={() => setActivePanel(item.id)}
                >
                  <item.icon size={15} strokeWidth={1.6} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.id === 'issue-cards' && openCount > 0 && (
                  <SidebarMenuBadge>{openCount}</SidebarMenuBadge>
                )}
                {item.id === 'testing' && toTest > 0 && <SidebarMenuBadge>{toTest}</SidebarMenuBadge>}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-sidebar-border"
      style={{ top: TITLE_BAR, height: `calc(100svh - ${TITLE_BAR}px)` }}
    >
      <SidebarHeader>
        <div className={`flex items-center gap-2 py-1 ${expanded ? 'px-1' : 'justify-center px-0'}`}>
          <div
            data-accent={workspaceColor}
            className="flex size-7 shrink-0 items-center justify-center rounded-md"
            style={{
              color: 'var(--primary)',
              background: 'color-mix(in oklab, var(--primary) 18%, transparent)',
            }}
          >
            <Ticket size={15} strokeWidth={1.6} />
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight">Issue Cards</div>
              <div className="truncate text-[11px] text-muted-foreground">{workspaceName}</div>
            </div>
          )}
          {expanded && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={toggleExpand} aria-label="Collapse sidebar">
                  <PanelLeft size={15} strokeWidth={1.6} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-1.5">
                Collapse
                {binding && (
                  <KbdGroup>
                    {formatBinding(binding).map(key => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </KbdGroup>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup('Workspace', PRIMARY)}
        {renderGroup('System', SYSTEM)}
      </SidebarContent>

      <SidebarFooter>
        <div className={`flex flex-col gap-1 ${expanded ? 'items-stretch' : 'items-center'}`}>
          <NotificationTray collapsed={!expanded} />
          <AccountMenu collapsed={!expanded} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
