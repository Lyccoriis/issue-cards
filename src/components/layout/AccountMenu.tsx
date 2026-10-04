import { useState } from 'react';
import { Check, LogOut, Plus, Settings, User, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import UserAvatar from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorText } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useUiStore } from '@/stores/useUiStore';

type Ask = 'create' | 'join' | null;

export default function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const profile = useAuthStore(s => s.profile);
  const workspaces = useAuthStore(s => s.workspaces);
  const activeId = useAuthStore(s => s.activeWorkspaceId);
  const setActiveWorkspace = useAuthStore(s => s.setActiveWorkspace);
  const createWorkspace = useAuthStore(s => s.createWorkspace);
  const joinWorkspace = useAuthStore(s => s.joinWorkspace);
  const signOut = useAuthStore(s => s.signOut);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);
  const openUserProfile = useUiStore(s => s.openUserProfile);

  const [ask, setAsk] = useState<Ask>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  async function submit() {
    const text = value.trim();
    if (!text) return;
    setBusy(true);
    try {
      if (ask === 'create') await createWorkspace(text);
      else await joinWorkspace(text);
      setAsk(null);
      setValue('');
      toast.success(ask === 'create' ? 'Workspace created' : 'Joined the workspace');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={collapsed ? 'size-8 p-0' : 'h-8 flex-1 justify-start gap-2 px-1'}>
            <UserAvatar
              name={profile.displayName}
              initials={profile.initials}
              accent={profile.accent}
              url={profile.avatarUrl}
              className="size-6"
            />
            {!collapsed && (
              <span className="min-w-0 flex-1 truncate text-left text-[12px]">{profile.displayName}</span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side="top" className="w-60">
          <DropdownMenuLabel className="truncate text-[11px] text-muted-foreground">
            {profile.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-[11px] text-muted-foreground">Workspaces</DropdownMenuLabel>
          {workspaces.map(workspace => (
            <DropdownMenuItem key={workspace.id} onSelect={() => void setActiveWorkspace(workspace.id)}>
              <span className="dot" data-accent={workspace.color} style={{ background: 'var(--primary)' }} />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.memberCount > 1 && (
                <span className="tnum text-[11px] text-muted-foreground">{workspace.memberCount}</span>
              )}
              {workspace.id === activeId && <Check size={14} strokeWidth={1.6} />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { setValue(''); setAsk('create'); }}>
            <Plus size={15} strokeWidth={1.6} />
            New workspace
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setValue(''); setAsk('join'); }}>
            <UserPlus size={15} strokeWidth={1.6} />
            Join with a code
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openUserProfile(profile.id)}>
            <User size={15} strokeWidth={1.6} />
            My profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActivePanel('settings')}>
            <Settings size={15} strokeWidth={1.6} />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
            <LogOut size={15} strokeWidth={1.6} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={ask !== null} onOpenChange={open => !open && setAsk(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ask === 'create' ? 'New workspace' : 'Join a workspace'}</DialogTitle>
            <DialogDescription>
              {ask === 'create'
                ? 'Cards filed here are shared with everyone you invite.'
                : 'Paste the invite code the workspace owner sent you.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="workspace-value">{ask === 'create' ? 'Name' : 'Invite code'}</Label>
            <Input
              id="workspace-value"
              value={value}
              autoFocus
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void submit()}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAsk(null)}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={busy || !value.trim()}>
              {ask === 'create' ? 'Create' : 'Join'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
