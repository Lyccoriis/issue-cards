import { useState } from 'react';
import { BarChart3, Check, Copy, Filter, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

import UserIdentity from '@/components/shared/UserIdentity';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ASSIGNABLE_ROLES, ROLE_LABEL, ROLE_NOTE } from '@/lib/permissions';
import { errorText } from '@/lib/supabase';
import { useAuthStore, usePermissions } from '@/stores/useAuthStore';
import { isFromSheet, useIssueStore } from '@/stores/useIssueStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useUiStore } from '@/stores/useUiStore';
import type { MemberRole, WorkspaceMember } from '@/types';

function joined(stamp: string): string {
  if (!stamp) return 'joined at some point';
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return 'joined at some point';
  return `joined ${date.toISOString().slice(0, 10)}`;
}

export default function PeopleCard() {
  const profile = useAuthStore(s => s.profile)!;
  const members = useAuthStore(s => s.members);
  const workspaces = useAuthStore(s => s.workspaces);
  const activeId = useAuthStore(s => s.activeWorkspaceId);
  const removeMember = useAuthStore(s => s.removeMember);
  const setMemberRole = useAuthStore(s => s.setMemberRole);
  const can = usePermissions();

  const cards = useIssueStore(s => s.cards);
  const toggleAuthor = useIssueStore(s => s.toggleAuthor);
  const authorFilter = useIssueStore(s => s.filters.author);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);

  const openProfile = useUiStore(s => s.openUserProfile);

  const [copied, setCopied] = useState('');

  const active = workspaces.find(w => w.id === activeId) ?? null;
  if (!active) return null;

  function copyEmail(email: string) {
    void navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(''), 1500);
  }

  function showCards(userId: string) {
    if (!authorFilter.includes(userId)) toggleAuthor(userId);
    setActivePanel('issue-cards');
  }

  function changeRole(member: WorkspaceMember, role: MemberRole) {
    void setMemberRole(member.userId, role)
      .then(() => toast.success(`${member.displayName} is now ${ROLE_LABEL[role].toLowerCase()}`))
      .catch(err => toast.error(errorText(err)));
  }

  function canSetRoleOf(member: WorkspaceMember): boolean {
    if (member.role === 'owner' || member.userId === profile.id) return false;
    if (!can.managePeople) return false;
    return member.role === 'admin' ? can.manageAdmins : true;
  }

  const roleChoices = (member: WorkspaceMember) =>
    ASSIGNABLE_ROLES.filter(role => role !== 'admin' || can.manageAdmins || member.role === 'admin');

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-[13px]">
            People in {active.name}
            <span className="ml-2 font-normal text-muted-foreground">
              {members.length === 1 ? 'only you so far' : `${members.length} accounts`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ItemGroup>
            {members.map((member, index) => {
              const mine = member.userId === profile.id;
              const filed = cards.filter(c => !isFromSheet(c) && c.createdBy === member.userId).length;

              return (
                <div key={member.userId}>
                  {index > 0 && <ItemSeparator />}
                  <Item size="sm" className="rounded-none px-5 py-3">
                    <ItemMedia>
                      <UserIdentity userId={member.userId} avatarClassName="size-9" />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="flex items-center gap-2 text-[13.5px]">
                        <UserIdentity
                          userId={member.userId}
                          showAvatar={false}
                          showName
                          nameClassName="text-[13.5px]"
                        />
                        {mine && <Badge variant="secondary">you</Badge>}
                        {!canSetRoleOf(member) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant={member.role === 'owner' ? 'default' : 'outline'}>
                                {ROLE_LABEL[member.role]}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px]">
                              {ROLE_NOTE[member.role]}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </ItemTitle>
                      <ItemDescription className="text-[12px]">
                        {member.email} · {joined(member.joinedAt)} ·{' '}
                        {filed === 1 ? '1 card filed' : `${filed} cards filed`}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="gap-1">
                      {canSetRoleOf(member) && (
                        <Select
                          value={member.role}
                          onValueChange={role => changeRole(member, role as MemberRole)}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-[104px]"
                            aria-label={`${member.displayName}'s role`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleChoices(member).map(role => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABEL[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`What ${member.displayName} has done`}
                            onClick={() => openProfile(member.userId)}
                          >
                            <BarChart3 size={15} strokeWidth={1.6} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">What they have done</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Copy ${member.displayName}'s email`}
                            onClick={() => copyEmail(member.email)}
                          >
                            {copied === member.email ? (
                              <Check size={15} strokeWidth={1.6} />
                            ) : (
                              <Copy size={15} strokeWidth={1.6} />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Copy email</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={filed === 0}
                            aria-label={`Show ${member.displayName}'s cards`}
                            onClick={() => showCards(member.userId)}
                          >
                            <Filter size={15} strokeWidth={1.6} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Show only their cards</TooltipContent>
                      </Tooltip>

                      {can.managePeople && !mine && member.role !== 'owner' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${member.displayName}`}
                            >
                              <UserMinus size={15} strokeWidth={1.6} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {member.displayName}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                They stop seeing the cards in {active.name}. The {filed} cards they
                                filed stay where they are. They can come back with the invite code.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  void removeMember(member.userId)
                                    .then(() => toast.success(`${member.displayName} removed`))
                                    .catch(err => toast.error(errorText(err)))
                                }
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </ItemActions>
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
        </CardContent>
      </Card>
    </>
  );
}
