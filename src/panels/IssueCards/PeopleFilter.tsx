import { TableProperties } from 'lucide-react';

import UserIdentity from '@/components/shared/UserIdentity';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/useAuthStore';
import { SHEET_AUTHOR, isFromSheet, useIssueStore } from '@/stores/useIssueStore';
import type { IssueCard } from '@/types';

export default function PeopleFilter({ cards }: { cards: IssueCard[] }) {
  const members = useAuthStore(s => s.members);
  const selected = useIssueStore(s => s.filters.author);
  const toggleAuthor = useIssueStore(s => s.toggleAuthor);

  const filed = members.map(member => ({
    member,
    count: cards.filter(c => !isFromSheet(c) && c.createdBy === member.userId).length,
  }));
  const fromSheet = cards.filter(isFromSheet).length;

  if (filed.length < 2 && fromSheet === 0) return null;
  const sheetOn = selected.includes(SHEET_AUTHOR);

  return (
    <div className="flex items-center gap-1">
      {filed.map(({ member, count }) => {
        const on = selected.includes(member.userId);
        return (
          <Tooltip key={member.userId}>
            <TooltipTrigger asChild>
              <span className="flex size-7 items-center justify-center">
                <UserIdentity
                  userId={member.userId}
                  active={on}
                  avatarClassName={`size-6 ${on ? '' : 'opacity-75'}`}
                  action={{
                    label: on ? 'Stop filtering by them' : 'Only their cards',
                    run: () => toggleAuthor(member.userId),
                  }}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {member.displayName}, {count === 1 ? '1 card' : `${count} cards`}
              {member.role === 'owner' && ' · owner'}
            </TooltipContent>
          </Tooltip>
        );
      })}

      {fromSheet > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={sheetOn}
              aria-label="cards imported from the bug sheet"
              onClick={() => toggleAuthor(SHEET_AUTHOR)}
              className={`size-7 rounded-full p-0 text-muted-foreground ${
                sheetOn ? 'ring-[3px] ring-ring/50' : 'opacity-75'
              }`}
            >
              <TableProperties size={15} strokeWidth={1.6} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            From the bug sheet, {fromSheet === 1 ? '1 card' : `${fromSheet} cards`}, filed by nobody
            here
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
