import { useMemo, useState } from 'react';
import {
  AtSign,
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Download,
  FilePlus2,
  FlaskConical,
  MessageSquare,
  RotateCcw,
  Settings,
  ShieldCheck,
  Trash2,
  Undo2,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import UserAvatar from '@/components/shared/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { relTime } from '@/lib/relTime';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useNotificationStore, visibleNotifications } from '@/stores/useNotificationStore';
import { useUiStore } from '@/stores/useUiStore';
import { DEFAULT_NOTIFY_PREFS } from '@/lib/notifications';
import type { AppNotification, NotificationKind } from '@/types';

const ICONS: Record<NotificationKind, LucideIcon> = {
  mention: AtSign,
  card_comment: MessageSquare,
  card_new: FilePlus2,
  card_fixed: CheckCircle2,
  card_rejected: Undo2,
  card_closed: XCircle,
  card_due: CalendarClock,
  test_new: FlaskConical,
  test_failed: XCircle,
  test_passed: ShieldCheck,
  test_retest: RotateCcw,
  test_note: MessageSquare,
  member_joined: UserPlus,
  role_changed: ShieldCheck,
  update: Download,
};

const TARGET: Record<string, string> = {
  issue: 'Opens the card',
  test: 'Opens the test',
  profile: 'Opens the profile',
  settings: 'Opens Settings',
};

export function useUnread(): number {
  const items = useNotificationStore(s => s.items);
  const prefs = useAuthStore(s => s.profile?.notifyPrefs ?? DEFAULT_NOTIFY_PREFS);
  return useMemo(() => visibleNotifications(items, prefs).filter(i => !i.read).length, [items, prefs]);
}

export default function NotificationTray({ collapsed }: { collapsed: boolean }) {
  const items = useNotificationStore(s => s.items);
  const loaded = useNotificationStore(s => s.loaded);
  const markAllRead = useNotificationStore(s => s.markAllRead);
  const clearAll = useNotificationStore(s => s.clearAll);
  const prefs = useAuthStore(s => s.profile?.notifyPrefs ?? DEFAULT_NOTIFY_PREFS);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);
  const open = useUiStore(s => s.trayOpen);
  const setOpen = useUiStore(s => s.setTrayOpen);
  const [view, setView] = useState<'all' | 'unread'>('all');

  const shown = useMemo(() => visibleNotifications(items, prefs), [items, prefs]);
  const unread = shown.filter(i => !i.read).length;
  const list = view === 'unread' ? shown.filter(i => !i.read) : shown;

  const trigger = (
    <Button
      variant="ghost"
      aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
      className={collapsed ? 'relative size-8 p-0' : 'relative h-8 w-full justify-start gap-2 px-1'}
    >
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        <Bell size={15} strokeWidth={1.6} />
        {unread > 0 && (
          <span
            className="dot pulse absolute top-0.5 right-0.5 ring-2 ring-sidebar"
            style={{ background: 'var(--success)' }}
          />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-left text-[12px]">Notifications</span>
          {unread > 0 && (
            <Badge variant="secondary" className="tnum">
              {unread}
            </Badge>
          )}
        </>
      )}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Notifications{unread > 0 ? `, ${unread} new` : ''}</TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      )}

      <PopoverContent side="right" align="end" sideOffset={10} className="w-[390px] p-0">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-[13px] font-semibold">Notifications</span>
          {unread > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="dot pulse" style={{ background: 'var(--success)' }} />
              {unread} new
            </span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Mark all as read"
                  disabled={unread === 0}
                  onClick={() => void markAllRead()}
                >
                  <CheckCheck size={15} strokeWidth={1.6} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark all as read</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear all"
                  disabled={items.length === 0}
                  onClick={() => void clearAll()}
                >
                  <Trash2 size={15} strokeWidth={1.6} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear all</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Notification settings"
                  onClick={() => {
                    setOpen(false);
                    setActivePanel('settings');
                  }}
                >
                  <Settings size={15} strokeWidth={1.6} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Choose what notifies you</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="px-3 pb-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={value => value && setView(value as 'all' | 'unread')}
          >
            <ToggleGroupItem value="all" className="text-[12px]">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="unread" className="text-[12px]">
              Unread
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Separator />

        {list.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellOff />
              </EmptyMedia>
              <EmptyTitle className="text-[14px]">{loaded ? 'Nothing waiting' : 'Loading'}</EmptyTitle>
              <EmptyDescription className="text-[12.5px]">
                Mentions, comments on your cards, fixes to test and more show up here, live while you
                are in the app and waiting for you when you are not.
              </EmptyDescription>
            </EmptyHeader>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                setActivePanel('settings');
              }}
            >
              <Settings size={15} strokeWidth={1.6} />
              Choose what notifies you
            </Button>
          </Empty>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <div className="flex flex-col py-1">
              {list.map(item => (
                <Row key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Row({ item }: { item: AppNotification }) {
  const open = useNotificationStore(s => s.open);
  const remove = useNotificationStore(s => s.remove);
  const member = useAuthStore(s => s.members.find(m => m.userId === item.actorId) ?? null);
  const workspace = useAuthStore(s =>
    item.workspaceId !== s.activeWorkspaceId ? s.workspaces.find(w => w.id === item.workspaceId)?.name : null,
  );
  const Icon = ICONS[item.kind];

  return (
    <div
      role="link"
      tabIndex={0}
      title={TARGET[item.linkKind] ?? undefined}
      onClick={() => void open(item)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void open(item);
        }
      }}
      className={cn(
        'group flex cursor-pointer items-start gap-2.5 px-3 py-2 outline-none transition-colors duration-150',
        'hover:bg-accent/60 focus-visible:bg-accent/60',
      )}
    >
      <span className="relative mt-0.5 flex shrink-0">
        {member ? (
          <UserAvatar
            name={member.displayName}
            initials={member.initials}
            accent={member.accent}
            url={member.avatarUrl}
            className="size-7"
          />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon size={14} strokeWidth={1.6} />
          </span>
        )}
        {member && (
          <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-popover text-muted-foreground ring-2 ring-popover">
            <Icon size={9} strokeWidth={2} />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className={cn('text-[13px] leading-snug', !item.read && 'font-medium')}>{item.title}</div>
        {item.body && (
          <div className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{item.body}</div>
        )}
        <div className="tnum mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {relTime(item.createdAt) || item.createdAt}
          {workspace && <span className="truncate">· {workspace}</span>}
        </div>
      </div>

      {!item.read && (
        <span className="dot mt-1.5 shrink-0" style={{ background: 'var(--success)' }} aria-label="Unread" />
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={event => {
          event.stopPropagation();
          void remove(item.id);
        }}
      >
        <X size={13} strokeWidth={1.6} />
      </Button>
    </div>
  );
}
