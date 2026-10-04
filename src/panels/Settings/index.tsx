import { useState } from 'react';
import { Check, Circle, Copy, LogOut, Pencil, Sparkles, SquareDashed } from 'lucide-react';
import { toast } from 'sonner';

import PanelShell from '@/components/layout/PanelShell';
import ColorPicker from '@/components/shared/ColorPicker';
import ColorSwatches from '@/components/shared/ColorSwatches';
import UserAvatar from '@/components/shared/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ItemGroup, ItemSeparator } from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isHexColor } from '@/lib/accents';
import {
  clearConnection,
  connection,
  errorText,
  imgurClientId,
  saveConnection,
  saveImgurClientId,
  supabase,
} from '@/lib/supabase';
import { ROLE_LABEL } from '@/lib/permissions';
import { useAuthStore, usePermissions } from '@/stores/useAuthStore';
import { useUiStore } from '@/stores/useUiStore';
import type { AvatarBorder } from '@/types';
import IdentityCard from './IdentityCard';
import KeystrokesCard from './KeystrokesCard';
import NotificationsCard from './NotificationsCard';
import PeopleCard from './PeopleCard';
import PictureDialog from './PictureDialog';
import SettingRow from './SettingRow';
import UpdateCard from './UpdateCard';

const THEMES = [
  { value: 'system', label: 'Follow the system' },
  { value: 'oled', label: 'OLED' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const RADII = [
  { value: '0rem', label: 'Square' },
  { value: '0.35rem', label: 'Slight' },
  { value: '0.5rem', label: 'Normal' },
  { value: '0.75rem', label: 'Round' },
];

function AppearanceCard() {
  const profile = useAuthStore(s => s.profile)!;
  const updateProfile = useAuthStore(s => s.updateProfile);

  function patch(next: Parameters<typeof updateProfile>[0]) {
    void updateProfile(next).catch(err => toast.error(errorText(err)));
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-[13px]">Appearance</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup>
          <SettingRow title="Theme" description="Every color in the app comes from this">
            {THEMES.map(theme => (
              <ThemeCard
                key={theme.value}
                id={theme.value}
                label={theme.label}
                active={profile.theme === theme.value}
                onClick={() => patch({ theme: theme.value as never })}
              />
            ))}
          </SettingRow>

          <ItemSeparator />
          <SettingRow title="Accent" description="Buttons, focus rings and the active panel">
            <div className="flex max-w-[340px] flex-wrap items-center justify-end gap-1.5">
              <ColorSwatches
                label="accent"
                value={profile.accent}
                onPick={accent => patch({ accent })}
              />
              <ColorPicker
                label="Custom accent"
                value={profile.accent}
                active={isHexColor(profile.accent)}
                onChange={accent => patch({ accent })}
              />
            </div>
          </SettingRow>

          <ItemSeparator />
          <SettingRow title="Density" description="How tight the rows and cards sit" htmlFor="density">
            <Select value={profile.density} onValueChange={value => patch({ density: value as never })}>
              <SelectTrigger id="density" className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <ItemSeparator />
          <SettingRow title="Corners" description="Radius of cards, inputs and buttons">
            <Select value={profile.radius} onValueChange={value => patch({ radius: value })}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RADII.map(radius => (
                  <SelectItem key={radius.value} value={radius.value}>{radius.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <ItemSeparator />
          <SettingRow
            title="Monospace interface"
            description="Use the code font everywhere, not only in code"
            htmlFor="mono-ui"
          >
            <Switch
              id="mono-ui"
              checked={profile.monoUi}
              onCheckedChange={value => patch({ monoUi: value })}
            />
          </SettingRow>
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

interface ThemeCardProps {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ThemeCard({ id, label, active, onClick }: ThemeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-[92px] cursor-pointer rounded-md border p-2 transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
        active ? 'border-primary ring-[3px] ring-ring/30' : 'border-border hover:border-foreground/30'
      }`}
    >
      {id === 'system' ? (
        <div className="flex h-9 overflow-hidden rounded-sm border">
          <ThemePreview theme="light" className="w-1/2" />
          <ThemePreview theme="oled" className="w-1/2" />
        </div>
      ) : (
        <ThemePreview theme={id} className="h-9 rounded-sm border" />
      )}
      <div className={`mt-1.5 text-center text-[11px] ${active ? '' : 'text-muted-foreground'}`}>
        {label}
      </div>
    </button>
  );
}

function ThemePreview({ theme, className }: { theme: string; className?: string }) {
  return (
    <div
      data-theme={theme}
      className={`flex flex-col justify-between overflow-hidden p-[5px] ${className ?? ''}`}
      style={{ background: 'var(--background)' }}
    >
      <i className="block h-1 w-[60%] rounded-[2px]" style={{ background: 'var(--primary)' }} />
      <i className="block h-1 w-[85%] rounded-[2px]" style={{ background: 'var(--border)' }} />
      <i className="block h-1 w-[40%] rounded-[2px]" style={{ background: 'var(--border)' }} />
    </div>
  );
}

export default function SettingsPanel() {
  const profile = useAuthStore(s => s.profile);
  const signOut = useAuthStore(s => s.signOut);

  if (!profile) return null;

  return (
    <PanelShell title="Settings" description="This account, its workspaces, and how the app looks">
      <div className="flex flex-col gap-6 pb-10">
        <AccountCard />
        <AppearanceCard />
        <WorkspaceCard />
        <PeopleCard />
        <IdentityCard />
        <NotificationsCard />
        <KeystrokesCard />
        <UpdateCard />
        <ConnectionCard />

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut size={15} strokeWidth={1.6} />
            Sign out
          </Button>
        </div>
      </div>
    </PanelShell>
  );
}

const BIO_MAX = 140;

function AccountCard() {
  const profile = useAuthStore(s => s.profile)!;
  const updateProfile = useAuthStore(s => s.updateProfile);
  const role = useAuthStore(s => s.workspaces.find(w => w.id === s.activeWorkspaceId)?.role);

  const [name, setName] = useState(profile.displayName);
  const [initials, setInitials] = useState(profile.initials);
  const [bio, setBio] = useState(profile.bio);
  const [password, setPassword] = useState('');

  const pictureOpen = useUiStore(s => s.pictureOpen);
  const pictureKind = useUiStore(s => s.pictureKind);
  const openPicture = useUiStore(s => s.openPicture);
  const closePicture = useUiStore(s => s.closePicture);
  const openUserProfile = useUiStore(s => s.openUserProfile);

  function save(patch: Parameters<typeof updateProfile>[0], said: string) {
    void updateProfile(patch)
      .then(() => toast.success(said))
      .catch(err => toast.error(errorText(err)));
  }

  async function saveName() {
    try {
      await updateProfile({ displayName: name.trim(), initials: initials.trim().slice(0, 2).toUpperCase() });
      toast.success('Account updated');
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  async function savePassword() {
    if (password.length < 8) {
      toast.error('Use at least 8 characters');
      return;
    }
    const { error } = await supabase().auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword('');
    toast.success('Password changed');
  }

  return (
    <>
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-[13px]">Account</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="border-b border-border">
          <button
            type="button"
            aria-label="Change the banner"
            onClick={() => openPicture('banner')}
            className="group/banner relative block h-28 w-full bg-cover bg-center"
            style={{
              backgroundImage: profile.bannerUrl.trim()
                ? `url(${profile.bannerUrl.trim()})`
                : 'linear-gradient(120deg, color-mix(in oklab, var(--primary) 45%, transparent), color-mix(in oklab, var(--primary) 8%, transparent))',
            }}
          >
            <span className="block size-full bg-gradient-to-b from-transparent to-card/85" />
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-[12px] opacity-0 transition-opacity duration-150 group-hover/banner:opacity-100">
              <Pencil size={15} strokeWidth={1.6} />
              Change the banner
            </span>
          </button>

          <div className="flex min-w-0 items-end gap-3 px-5 pt-2 pb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label="Change the profile picture"
                  onClick={() => openPicture('avatar')}
                  className="group/pic relative -mt-10 size-16 shrink-0 rounded-full p-0"
                >
                  <UserAvatar
                    name={profile.displayName}
                    initials={profile.initials}
                    accent={profile.accent}
                    url={profile.avatarUrl}
                    border={profile.avatarBorder}
                    className="size-16 ring-4 ring-card"
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 opacity-0 transition-opacity duration-150 group-hover/pic:opacity-100">
                    <Pencil size={15} strokeWidth={1.6} />
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Change the picture</TooltipContent>
            </Tooltip>

            <div className="flex min-w-0 flex-1 flex-col pb-1">
              <span className="truncate text-[15px]">{profile.displayName}</span>
              <span className="truncate text-[12px] text-muted-foreground">
                {profile.bio.trim() || profile.email}
              </span>
            </div>
            {role && (
              <Badge variant="outline" className="mb-1 shrink-0">
                {ROLE_LABEL[role]}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mb-1 shrink-0"
              onClick={() => openUserProfile(profile.id)}
            >
              Open my profile
            </Button>
          </div>
        </div>

        <ItemGroup>
          <SettingRow title="Signed in as" description="The address this account signs in with">
            <span className="text-[12.5px] text-muted-foreground">{profile.email}</span>
          </SettingRow>

          <ItemSeparator />
          <SettingRow title="Display name" description="What the other people in a workspace see">
            <Input className="w-[220px]" value={name} onChange={e => setName(e.target.value)} />
            <Input
              className="w-[70px]"
              value={initials}
              maxLength={2}
              onChange={e => setInitials(e.target.value)}
            />
            <Button size="sm" onClick={() => void saveName()}>Save</Button>
          </SettingRow>

          <ItemSeparator />
          <SettingRow
            title="About you"
            description={`One line under your name on your profile, ${BIO_MAX} characters at most`}
          >
            <Input
              className="w-[320px]"
              value={bio}
              maxLength={BIO_MAX}
              placeholder="What you work on"
              onChange={e => setBio(e.target.value)}
            />
            <Button size="sm" onClick={() => save({ bio: bio.trim() }, 'Profile updated')}>
              Save
            </Button>
          </SettingRow>

          <ItemSeparator />
          <SettingRow
            title="Avatar border"
            description="How your picture is framed on your profile, in your accent color"
          >
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={profile.avatarBorder}
              onValueChange={value =>
                value && save({ avatarBorder: value as AvatarBorder }, 'Profile updated')
              }
            >
              <ToggleGroupItem value="none" aria-label="no border" className="gap-1.5 text-[12px]">
                <SquareDashed size={15} strokeWidth={1.6} />
                None
              </ToggleGroupItem>
              <ToggleGroupItem value="glow" aria-label="glowing border" className="gap-1.5 text-[12px]">
                <Sparkles size={15} strokeWidth={1.6} />
                Glow
              </ToggleGroupItem>
              <ToggleGroupItem value="ring" aria-label="solid ring" className="gap-1.5 text-[12px]">
                <Circle size={15} strokeWidth={1.6} />
                Ring
              </ToggleGroupItem>
            </ToggleGroup>
          </SettingRow>

          <ItemSeparator />
          <SettingRow title="Password" description="Change the password on this account">
            <Input
              className="w-[220px]"
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <Button size="sm" onClick={() => void savePassword()} disabled={!password}>Change</Button>
          </SettingRow>
        </ItemGroup>
      </CardContent>
    </Card>

    <PictureDialog
      open={pictureOpen}
      kind={pictureKind}
      onOpenChange={open => (open ? openPicture(pictureKind) : closePicture())}
    />
    </>
  );
}

function WorkspaceCard() {
  const workspaces = useAuthStore(s => s.workspaces);
  const activeId = useAuthStore(s => s.activeWorkspaceId);
  const members = useAuthStore(s => s.members);
  const renameWorkspace = useAuthStore(s => s.renameWorkspace);
  const recolorWorkspace = useAuthStore(s => s.recolorWorkspace);
  const leaveWorkspace = useAuthStore(s => s.leaveWorkspace);
  const regenerateInviteCode = useAuthStore(s => s.regenerateInviteCode);
  const meId = useAuthStore(s => s.profile?.id);
  const joinWorkspace = useAuthStore(s => s.joinWorkspace);
  const can = usePermissions();

  const active = workspaces.find(w => w.id === activeId) ?? null;
  const [name, setName] = useState(active?.name ?? '');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  if (!active) {
    return (
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-[13px]">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ItemGroup>
            <SettingRow title="No workspace open" description="Join one with an invite code">
              <Input className="w-[200px]" value={code} onChange={e => setCode(e.target.value)} />
              <Button
                size="sm"
                onClick={() => void joinWorkspace(code).catch(err => toast.error(errorText(err)))}
              >
                Join
              </Button>
            </SettingRow>
          </ItemGroup>
        </CardContent>
      </Card>
    );
  }

  function copyCode() {
    void navigator.clipboard.writeText(active!.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2 text-[13px]">
          <span className="dot" data-accent={active.color} style={{ background: 'var(--primary)' }} />
          Workspace
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup>
          <SettingRow
            title="Name"
            description={can.editWorkspace ? 'Everyone in it sees this name' : 'The owner and the admins name this one'}
          >
            <Input
              className="w-[220px]"
              value={name || active.name}
              disabled={!can.editWorkspace}
              onChange={e => setName(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!can.editWorkspace}
              onClick={() =>
                void renameWorkspace(active.id, name).catch(err => toast.error(errorText(err)))
              }
            >
              Save
            </Button>
          </SettingRow>

          <ItemSeparator />
          <SettingRow
            title="Invite code"
            description={`Send this to whoever should see these cards, ${members.length} accounts hold it now`}
          >
            <code className="rounded-md border border-border px-2 py-1 font-mono text-[12px]">
              {active.inviteCode}
            </code>
            <Button variant="outline" size="sm" onClick={copyCode}>
              {copied ? <Check size={15} strokeWidth={1.6} /> : <Copy size={15} strokeWidth={1.6} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {active.ownerId === meId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void regenerateInviteCode(active.id)
                    .then(() => toast.success('New invite code, the old one no longer works'))
                    .catch(err => toast.error(errorText(err)))
                }
              >
                New code
              </Button>
            )}
          </SettingRow>

          <ItemSeparator />
          <SettingRow
            title="Color"
            description={
              can.editWorkspace
                ? 'Marks this workspace everywhere it is named, everyone sees the same one'
                : 'Picked by the owner and the admins of this workspace'
            }
          >
            <ColorSwatches
              label="workspace color"
              value={active.color}
              disabled={!can.editWorkspace}
              onPick={color =>
                void recolorWorkspace(active.id, color).catch(err => toast.error(errorText(err)))
              }
            />
          </SettingRow>

          <ItemSeparator />
          <SettingRow title="Leave" description="Stop seeing the cards in this workspace">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void leaveWorkspace(active.id).catch(err => toast.error(errorText(err)))}
            >
              Leave workspace
            </Button>
          </SettingRow>
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function ConnectionCard() {
  const current = connection();
  const [url, setUrl] = useState(current.url);
  const [anonKey, setAnonKey] = useState(current.anonKey);
  const [imgur, setImgur] = useState(imgurClientId());

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-[13px]">Connection</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup>
          <SettingRow title="Project URL" description="The Supabase project this app talks to">
            <Input className="w-[280px]" value={url} onChange={e => setUrl(e.target.value)} />
          </SettingRow>

          <ItemSeparator />
          <SettingRow title="Anon key" description="The public key from the project API settings">
            <Input className="w-[280px]" value={anonKey} onChange={e => setAnonKey(e.target.value)} />
          </SettingRow>

          <ItemSeparator />
          <SettingRow
            title="Imgur Client-ID"
            description="Where attached images go. Left empty they go to catbox instead"
          >
            <Input className="w-[280px]" value={imgur} onChange={e => setImgur(e.target.value)} />
            <Button
              size="sm"
              onClick={() => {
                saveImgurClientId(imgur);
                toast.success(imgur.trim() ? 'Images will go to Imgur' : 'Images will go to catbox');
              }}
            >
              Save
            </Button>
          </SettingRow>

          <ItemSeparator />
          <SettingRow title="Apply" description="Changing the project reloads the window">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearConnection();
                window.location.reload();
              }}
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => {
                saveConnection({ url, anonKey });
                window.location.reload();
              }}
            >
              Save and reload
            </Button>
          </SettingRow>
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
