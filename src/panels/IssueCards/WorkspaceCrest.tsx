import UserIdentity from '@/components/shared/UserIdentity';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';

const SHOWN = 4;

export default function WorkspaceCrest() {
  const workspace = useAuthStore(s => s.workspaces.find(w => w.id === s.activeWorkspaceId) ?? null);
  const members = useAuthStore(s => s.members);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);

  if (!workspace) return null;

  const shown = members.slice(0, SHOWN);
  const rest = members.length - shown.length;

  return (
    <span className="hidden shrink-0 items-center gap-1 lg:flex" data-accent={workspace.color}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={() => setActivePanel('settings')} className="gap-2">
            <span className="dot" style={{ background: 'var(--primary)' }} />
            <span className="max-w-[220px] truncate text-[12px]">{workspace.currentVersion ? `${workspace.name} Ver. ${workspace.currentVersion}` : workspace.name}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px]">
          {members.map(member => member.displayName).join(', ') || 'Nobody else yet'}
        </TooltipContent>
      </Tooltip>

      <span className="hidden items-center xl:flex">
        {shown.map((member, index) => (
          <span
            key={member.userId}
            className={index === 0 ? 'flex' : 'flex -ml-1.5'}
            style={{ zIndex: shown.length - index }}
          >
            <UserIdentity userId={member.userId} avatarClassName="size-6 ring-2 ring-background" />
          </span>
        ))}
        {rest > 0 && (
          <span
            className="-ml-1.5 flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-background"
            style={{ zIndex: 0 }}
          >
            +{rest}
          </span>
        )}
      </span>
    </span>
  );
}
