import { useCallback, useMemo, useState } from 'react';
import { Bell, Boxes, FlaskConical, KanbanSquare, Settings, Tag } from 'lucide-react';

import TagBadge from '@/components/shared/TagBadge';
import UserAvatar from '@/components/shared/UserAvatar';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { APP_COMMANDS, resolveBindings } from '@/lib/commands';
import { metaRows, tagRows } from '@/lib/tags';
import { featureStatus } from '@/lib/tests';
import type { TagColor } from '@/types';
import { NAV_ITEMS } from './NavSidebar';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinderStore } from '@/stores/useFinderStore';
import { isFromSheet, useIssueStore } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useTags } from '@/stores/useTagStore';
import { useTestStore } from '@/stores/useTestStore';
import { useUiStore } from '@/stores/useUiStore';
import { useDoubleShift } from '@/hooks/useDoubleShift';

interface FinderItem {
  id: string;
  label: string;
  hint: string;
  shortcut?: string;
  icon?: React.ReactNode;
  chip?: { color: TagColor; count: number };
  run: () => void;
}

const GROUPS = [
  'Commands',
  'Panels',
  'Cards',
  'Tests',
  'Notifications',
  'People',
  'Workspaces',
  'Tags',
  'Codebase',
  'Versions',
] as const;
type Group = (typeof GROUPS)[number];

export default function GlobalFinder() {
  const open = useFinderStore(s => s.open);
  const setOpen = useFinderStore(s => s.setOpen);
  const toggle = useFinderStore(s => s.toggle);
  const [query, setQuery] = useState('');

  const cards = useIssueStore(s => s.cards);
  const select = useIssueStore(s => s.select);
  const toggleTag = useIssueStore(s => s.toggleTag);
  const toggleMeta = useIssueStore(s => s.toggleMeta);
  const tags = useTags();
  const notifications = useNotificationStore(s => s.items);
  const openNotification = useNotificationStore(s => s.open);
  const features = useTestStore(s => s.features);
  const selectFeature = useTestStore(s => s.select);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);
  const keys = useAuthStore(s => s.profile?.keys);
  const members = useAuthStore(s => s.members);
  const workspaces = useAuthStore(s => s.workspaces);
  const activeWorkspaceId = useAuthStore(s => s.activeWorkspaceId);
  const setActiveWorkspace = useAuthStore(s => s.setActiveWorkspace);
  const openUserProfile = useUiStore(s => s.openUserProfile);

  useDoubleShift(useCallback(() => toggle(), [toggle]));

  const bindings = useMemo(() => resolveBindings(keys), [keys]);

  const items = useMemo(() => {
    const out: Record<Group, FinderItem[]> = {
      Commands: [],
      Panels: [],
      Cards: [],
      Tests: [],
      Notifications: [],
      People: [],
      Workspaces: [],
      Tags: [],
      Codebase: [],
      Versions: [],
    };

    if (!open) return out;

    for (const command of APP_COMMANDS) {
      if (command.panelId) continue;
      const Icon = command.icon;
      out.Commands.push({
        id: command.id,
        label: command.label,
        hint: command.hint,
        shortcut: bindings[command.id] || undefined,
        icon: Icon ? <Icon size={15} strokeWidth={1.6} /> : undefined,
        run: command.run,
      });
    }

    for (const item of NAV_ITEMS) {
      out.Panels.push({
        id: `panel.${item.id}`,
        label: item.label,
        hint: 'Panel',
        shortcut: bindings[`panel.${item.id}`] || undefined,
        icon: <item.icon size={15} strokeWidth={1.6} />,
        run: () => setActivePanel(item.id),
      });
    }

    for (const card of cards) {
      out.Cards.push({
        id: card.id,
        label: `${card.id} ${card.title}`,
        hint: `${card.status} · ${card.priority}${card.location ? ` · ${card.location}` : ''}`,
        icon: <KanbanSquare size={15} strokeWidth={1.6} />,
        run: () => {
          setActivePanel('issue-cards');
          select(card.id);
        },
      });
    }

    for (const feature of features) {
      out.Tests.push({
        id: `test.${feature.id}`,
        label: `${feature.key} ${feature.title}`,
        hint: `${featureStatus(feature)}${feature.version ? ` · ${feature.version}` : ''}`,
        icon: <FlaskConical size={15} strokeWidth={1.6} />,
        run: () => {
          setActivePanel('testing');
          selectFeature(feature.id);
        },
      });
    }

    for (const note of notifications.slice(0, 30)) {
      out.Notifications.push({
        id: `notification.${note.id}`,
        label: note.title,
        hint: note.read ? note.body : `new${note.body ? ` · ${note.body}` : ''}`,
        icon: <Bell size={15} strokeWidth={1.6} />,
        run: () => void openNotification(note),
      });
    }

    for (const member of members) {
      const filed = cards.filter(c => !isFromSheet(c) && c.createdBy === member.userId).length;
      out.People.push({
        id: `person.${member.userId}`,
        label: member.displayName,
        hint: `${member.role} · ${filed === 1 ? '1 card' : `${filed} cards`} · ${member.email}`,
        icon: (
          <UserAvatar
            name={member.displayName}
            initials={member.initials}
            accent={member.accent}
            url={member.avatarUrl}
            className="size-5"
          />
        ),
        run: () => openUserProfile(member.userId),
      });
    }

    for (const workspace of workspaces) {
      out.Workspaces.push({
        id: `workspace.${workspace.id}`,
        label: workspace.name,
        hint:
          workspace.id === activeWorkspaceId
            ? 'open now'
            : `${workspace.role} · ${workspace.memberCount === 1 ? '1 person' : `${workspace.memberCount} people`}`,
        icon: (
          <span className="dot" data-accent={workspace.color} style={{ background: 'var(--primary)' }} />
        ),
        run: () => void setActiveWorkspace(workspace.id),
      });
    }

    for (const row of tagRows(tags, cards)) {
      out.Tags.push({
        id: `tag.${row.name}`,
        label: row.name,
        hint: row.count === 1 ? '1 card' : `${row.count} cards`,
        icon: <Tag size={15} strokeWidth={1.6} />,
        chip: { color: row.color, count: row.count },
        run: () => {
          setActivePanel('issue-cards');
          toggleTag(row.name);
        },
      });
    }

    for (const [key, group] of [
      ['codebase', 'Codebase'],
      ['version', 'Versions'],
    ] as const) {
      for (const row of metaRows(cards, key)) {
        out[group].push({
          id: `${key}.${row.name}`,
          label: row.name,
          hint: row.count === 1 ? '1 card' : `${row.count} cards`,
          icon: key === 'codebase' ? <Boxes size={15} strokeWidth={1.6} /> : <Tag size={15} strokeWidth={1.6} />,
          chip: { color: row.color, count: row.count },
          run: () => {
            setActivePanel('issue-cards');
            toggleMeta(key, row.name);
          },
        });
      }
    }

    return out;
  }, [
    open,
    bindings,
    cards,
    features,
    notifications,
    openNotification,
    selectFeature,
    tags,
    members,
    workspaces,
    activeWorkspaceId,
    select,
    setActivePanel,
    setActiveWorkspace,
    toggleTag,
    toggleMeta,
    openUserProfile,
  ]);

  function pick(item: FinderItem) {
    setOpen(false);
    setQuery('');
    item.run();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) setQuery('');
      }}
      title="Finder"
      description="Search cards, panels and commands"
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search cards, panels, commands" />
      <CommandList>
        <CommandEmpty>
          <Settings size={15} strokeWidth={1.6} className="mx-auto mb-2 text-muted-foreground" />
          Nothing matches that.
        </CommandEmpty>

        {GROUPS.map(group =>
          items[group].length ? (
            <CommandGroup key={group} heading={group}>
              {items[group].map(item => (
                <CommandItem
                  key={item.id}
                  value={`${group} ${item.label} ${item.hint}`}
                  onSelect={() => pick(item)}
                >
                  {item.icon}
                  {item.chip ? (
                    <span className="min-w-0 flex-1">
                      <TagBadge tag={item.label} color={item.chip.color} count={item.chip.count} />
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  )}
                  <span className="truncate text-[11px] text-muted-foreground">{item.hint}</span>
                  {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null,
        )}
      </CommandList>
    </CommandDialog>
  );
}
