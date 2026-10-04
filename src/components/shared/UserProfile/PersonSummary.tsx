import { useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, Trophy } from 'lucide-react';

import TagBadge from '@/components/shared/TagBadge';
import UserAvatar from '@/components/shared/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROLE_LABEL, ROLE_NOTE } from '@/lib/permissions';
import { relTime } from '@/lib/relTime';
import { useAuthStore } from '@/stores/useAuthStore';
import { PRIORITIES, STATUSES, useIssueStore } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type { IssueCard, WorkspaceMember } from '@/types';
import { Dot, PRIORITY_COLOR, STATUS_COLOR } from '@/panels/IssueCards/IssueBits';
import {
  TIER_LABEL,
  eventColor,
  personStats,
  tierColor,
  type PersonEvent,
  type PersonStats,
} from './stats';

interface PersonSummaryProps {
  member: WorkspaceMember | null;
  onOpenChange: (open: boolean) => void;
}

const EVENT_WORD: Record<PersonEvent['kind'], string> = {
  filed: 'Filed',
  note: 'Wrote a note on',
  fixed: 'Marked fixed',
  closed: 'Closed',
  rejected: 'Handed back the fix on',
  file: 'Attached a file to',
};

function Tile({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-3 py-2">
      <div className="tnum text-[20px] leading-tight" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Split({ parts }: { parts: { key: string; count: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {parts.map(part => (
          <span
            key={part.key}
            title={`${part.key}: ${part.count}`}
            style={{ width: `${(part.count / total) * 100}%`, background: part.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {parts
          .filter(part => part.count > 0)
          .map(part => (
            <span key={part.key} className="flex items-center gap-1.5 text-[11.5px]">
              <Dot color={part.color} />
              {part.key}
              <span className="tnum text-muted-foreground">{part.count}</span>
            </span>
          ))}
      </div>
    </div>
  );
}

function Section({ title, extra, children }: { title: string; extra?: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] tracking-wide text-muted-foreground uppercase">{title}</h3>
        {extra && <span className="text-[11px] text-muted-foreground">{extra}</span>}
      </div>
      {children}
    </section>
  );
}

function CardRow({ card, onOpen }: { card: IssueCard; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(card.id)}
      className="flex w-full min-w-0 items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left transition-colors duration-150 hover:bg-accent/50"
    >
      <Dot color={STATUS_COLOR[card.status]} />
      <span className="mono shrink-0 text-[11px] text-muted-foreground">{card.id}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px]">{card.title}</span>
      <span className="mono shrink-0 text-[11px] text-muted-foreground">{card.timeOpened.slice(0, 10)}</span>
    </button>
  );
}

function Timeline({ events, onOpen }: { events: PersonEvent[]; onOpen: (id: string) => void }) {
  if (events.length === 0) {
    return <p className="text-[12px] text-muted-foreground">Nothing recorded yet.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col">
      {events.map(event => (
        <button
          key={event.id}
          type="button"
          onClick={() => onOpen(event.cardId)}
          className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-accent/50"
        >
          <Dot color={eventColor(event.kind)} />
          <span className="shrink-0 text-[12px]">{EVENT_WORD[event.kind]}</span>
          <span className="mono shrink-0 text-[11px] text-muted-foreground">{event.cardId}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{event.text}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {relTime(event.time) || event.time.slice(0, 10)}
          </span>
        </button>
      ))}
    </div>
  );
}

function Badges({ counts }: { counts: PersonStats }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {counts.badges.map(badge => {
        const earned = badge.tier > 0;
        const color = tierColor(badge.tier);
        const step = badge.next === null ? 1 : (badge.count - badge.floor) / (badge.next - badge.floor);

        return (
          <div
            key={badge.id}
            className="flex min-w-0 flex-col gap-2 rounded-lg border p-3"
            style={
              earned
                ? {
                    borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
                    background: `color-mix(in oklab, ${color} 8%, transparent)`,
                  }
                : undefined
            }
          >
            <span className="flex items-center gap-2">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  color: earned ? color : 'var(--muted-foreground)',
                  background: earned
                    ? `color-mix(in oklab, ${color} 18%, transparent)`
                    : 'var(--muted)',
                }}
              >
                <badge.icon size={15} strokeWidth={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">{badge.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{badge.note}</span>
              </span>
              <span
                className="shrink-0 rounded-md border px-1.5 py-0.5 text-[10.5px]"
                style={
                  earned
                    ? { color, borderColor: `color-mix(in oklab, ${color} 45%, transparent)` }
                    : { color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
                }
              >
                {earned ? TIER_LABEL[badge.tier - 1] : '-'}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.min(1, Math.max(0, step)) * 100}%`,
                    background: earned ? color : 'var(--muted-foreground)',
                  }}
                />
              </span>
              <span className="tnum text-[11px] text-muted-foreground">
                {badge.next === null ? `${badge.count}, topped out` : `${badge.count}/${badge.next}`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function PersonSummary({ member, onOpenChange }: PersonSummaryProps) {
  const cards = useIssueStore(s => s.cards);
  const members = useAuthStore(s => s.members);
  const toggleAuthor = useIssueStore(s => s.toggleAuthor);
  const authorFilter = useIssueStore(s => s.filters.author);
  const select = useIssueStore(s => s.select);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);

  const [copied, setCopied] = useState(false);

  const counts = useMemo(
    () => (member ? personStats(member, cards, members) : null),
    [member, cards, members],
  );

  if (!member || !counts) return null;

  const recent = [...counts.filed]
    .sort((a, b) => b.timeOpened.localeCompare(a.timeOpened))
    .slice(0, 6);

  function openCard(id: string) {
    setActivePanel('issue-cards');
    select(id);
    onOpenChange(false);
  }

  function showAll() {
    if (!member) return;
    if (!authorFilter.includes(member.userId)) toggleAuthor(member.userId);
    setActivePanel('issue-cards');
    onOpenChange(false);
  }

  function copyEmail() {
    if (!member) return;
    void navigator.clipboard.writeText(member.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const banner = member.bannerUrl.trim();

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 w-[min(58rem,calc(100vw-2rem))] max-h-[88vh] sm:max-w-none"
        data-accent={member.accent}
      >
        <DialogHeader className="min-w-0 gap-0 space-y-0 pb-3 text-left">
          <div
            className="h-32 w-full bg-cover bg-center"
            style={{
              backgroundImage: banner
                ? `url(${banner})`
                : 'linear-gradient(120deg, color-mix(in oklab, var(--primary) 45%, transparent), color-mix(in oklab, var(--primary) 8%, transparent))',
            }}
          >
            <span className="block size-full bg-gradient-to-b from-transparent to-card/85" />
          </div>

          <div className="flex min-w-0 items-end gap-3 px-5 pt-2">
            <UserAvatar
              name={member.displayName}
              initials={member.initials}
              accent={member.accent}
              url={member.avatarUrl}
              border={member.avatarBorder}
              className="-mt-12 size-20 shrink-0 ring-4 ring-card"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-1">
              <DialogTitle className="truncate text-[18px]">{member.displayName}</DialogTitle>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[12px] text-muted-foreground">{member.email}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy their email"
                  onClick={copyEmail}
                  className="size-6"
                >
                  {copied ? <Check size={15} strokeWidth={1.6} /> : <Copy size={15} strokeWidth={1.6} />}
                </Button>
              </span>
            </div>
            <span className="flex shrink-0 items-center gap-2 pb-1">
              {counts.place > 0 && (
                <Badge variant="outline" className="gap-1.5">
                  <Trophy size={15} strokeWidth={1.6} />#{counts.place} · {counts.score}
                </Badge>
              )}
              <Badge variant={member.role === 'owner' ? 'default' : 'outline'}>
                {ROLE_LABEL[member.role]}
              </Badge>
            </span>
          </div>

          <DialogDescription className="px-5 pt-2 text-[12.5px]">
            {member.bio.trim() || ROLE_NOTE[member.role]}
          </DialogDescription>

          <div className="grid grid-cols-2 gap-2 px-5 pt-3 sm:grid-cols-4">
            <Tile value={counts.filed.length} label="cards filed" />
            <Tile value={counts.notes} label="notes written" />
            <Tile value={counts.files} label="files attached" />
            <Tile
              value={counts.rejectionsTaken}
              label="fixes rejected"
              color={counts.rejectionsTaken > 0 ? 'var(--destructive)' : undefined}
            />
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="min-h-0 gap-0 overflow-hidden">
          <TabsList className="mx-5 w-[calc(100%-2.5rem)] justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>

          <ScrollArea className="min-h-[360px] w-full min-w-0 px-5 py-3">
            <TabsContent value="overview" className="m-0 flex min-w-0 flex-col gap-3">
              <Section title="Last 30 days">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile value={counts.recent.filed} label="filed" />
                  <Tile value={counts.recent.fixed} label="fixes marked" />
                  <Tile value={counts.recent.closed} label="closed" />
                  <Tile value={counts.recent.rejectionsGiven} label="fixes handed back" />
                </div>
              </Section>

              <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <Section title="Latest activity">
                  <Timeline events={counts.events.slice(0, 7)} onOpen={openCard} />
                </Section>

                <Section title="Latest cards" extra={`${counts.filed.length} in all`}>
                  {recent.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">Nothing filed yet.</p>
                  ) : (
                    <div className="flex min-w-0 flex-col gap-1">
                      {recent.map(card => (
                        <CardRow key={card.id} card={card} onOpen={openCard} />
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            </TabsContent>

            <TabsContent value="cards" className="m-0 flex min-w-0 flex-col gap-1">
              {counts.filed.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Nothing filed yet.</p>
              ) : (
                [...counts.filed]
                  .sort((a, b) => b.timeOpened.localeCompare(a.timeOpened))
                  .map(card => <CardRow key={card.id} card={card} onOpen={openCard} />)
              )}
            </TabsContent>

            <TabsContent value="activity" className="m-0 min-w-0">
              <Timeline events={counts.events.slice(0, 60)} onOpen={openCard} />
            </TabsContent>

            <TabsContent value="badges" className="m-0 min-w-0">
              <Badges counts={counts} />
            </TabsContent>

            <TabsContent value="stats" className="m-0 flex min-w-0 flex-col gap-3">
              {counts.filed.length > 0 && (
                <>
                  <Section title="Where their cards stand">
                    <Split
                      parts={STATUSES.map(status => ({
                        key: status,
                        count: counts.filed.filter(c => c.status === status).length,
                        color: STATUS_COLOR[status],
                      }))}
                    />
                  </Section>

                  <Section title="How urgent they file">
                    <Split
                      parts={PRIORITIES.map(priority => ({
                        key: priority,
                        count: counts.filed.filter(c => c.priority === priority).length,
                        color: PRIORITY_COLOR[priority],
                      }))}
                    />
                  </Section>
                </>
              )}

              {counts.tags.length > 0 && (
                <Section title="What they file about">
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {counts.tags.map(tag => (
                      <TagBadge key={tag.name} tag={tag.name} count={tag.count} />
                    ))}
                  </div>
                </Section>
              )}

              <Section title="On the record">
                <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
                  <span className="text-muted-foreground">joined</span>
                  <span className="mono">{member.joinedAt.slice(0, 10) || 'unknown'}</span>
                  <span className="text-muted-foreground">first activity</span>
                  <span className="mono">{counts.first || 'nothing yet'}</span>
                  <span className="text-muted-foreground">last activity</span>
                  <span className="mono">{counts.last || 'nothing yet'}</span>
                  <span className="text-muted-foreground">fixes marked</span>
                  <span className="tnum">{counts.fixed}</span>
                  <span className="text-muted-foreground">cards closed</span>
                  <span className="tnum">{counts.closed}</span>
                  <span className="text-muted-foreground">fixes handed back</span>
                  <span className="tnum">{counts.rejectionsGiven}</span>
                  <span className="text-muted-foreground">still open</span>
                  <span className="tnum">{counts.filed.filter(c => c.status === 'open').length}</span>
                </div>
              </Section>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="border-t px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button disabled={counts.filed.length === 0} onClick={showAll}>
            Show their cards
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
