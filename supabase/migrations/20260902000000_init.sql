create table if not exists public.profiles (
  id               uuid primary key references auth.users on delete cascade,
  email            text        not null,
  display_name     text        not null default '',
  initials         text        not null default '',
  accent           text        not null default 'blue',
  theme            text        not null default 'oled',
  density          text        not null default 'normal',
  radius           text        not null default '0.5rem',
  mono_ui          boolean     not null default false,
  keys             jsonb       not null default '{}'::jsonb,
  active_workspace uuid,
  created_at       timestamptz not null default now()
);

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  invite_code text        not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  owner_id    uuid        not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid        not null references public.workspaces on delete cascade,
  user_id      uuid        not null references auth.users on delete cascade,
  role         text        not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.issue_tags (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name         text not null,
  color        text not null default 'chart-1'
);

create unique index if not exists issue_tags_unique_name
  on public.issue_tags (workspace_id, lower(name));

create table if not exists public.issues (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid        not null references public.workspaces on delete cascade,
  seq            integer     not null,
  key            text        not null,
  title          text        not null,
  type           text        not null default 'Bug',
  subtype        text        not null default '',
  priority       text        not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status         text        not null default 'open'   check (status in ('open', 'fixed', 'resolved', 'wontfix')),
  repo           text        not null default '',
  codebase       text        not null default '',
  version        text        not null default '',
  location       text        not null default '',
  related        text[]      not null default '{}',
  tags           text[]      not null default '{}',
  due_date       text        not null default '',
  description    text        not null default '',
  evidence       text        not null default '',
  recommendation text        not null default '',
  test_procedure text        not null default '',
  rejections     text        not null default '',
  time_opened    timestamptz not null default now(),
  time_fixed     timestamptz,
  time_closed    timestamptz,
  created_by     uuid        references auth.users on delete set null,
  updated_at     timestamptz not null default now()
);

create unique index if not exists issues_workspace_seq on public.issues (workspace_id, seq);
create index if not exists issues_workspace on public.issues (workspace_id);

create table if not exists public.issue_comments (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid        not null references public.issues on delete cascade,
  author     text        not null default '',
  body       text        not null,
  created_at timestamptz not null default now(),
  created_by uuid        references auth.users on delete set null
);

create index if not exists issue_comments_issue on public.issue_comments (issue_id);

create or replace function public.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.assign_issue_key()
returns trigger
language plpgsql
as $$
declare
  next_seq integer;
begin
  perform 1 from public.workspaces where id = new.workspace_id for update;
  select coalesce(max(seq), 0) + 1 into next_seq
    from public.issues where workspace_id = new.workspace_id;
  new.seq := next_seq;
  new.key := 'ISSUE-' || lpad(next_seq::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists issues_assign_key on public.issues;
create trigger issues_assign_key
  before insert on public.issues
  for each row execute function public.assign_issue_key();

create or replace function public.guard_issue_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'fixed' and coalesce(btrim(new.test_procedure), '') = '' then
    raise exception 'A card marked fixed needs a test procedure';
  end if;

  if new.status = 'fixed' and (tg_op = 'INSERT' or old.status is distinct from 'fixed') then
    new.time_fixed := now();
  end if;

  if new.status in ('resolved', 'wontfix') and (tg_op = 'INSERT' or old.status not in ('resolved', 'wontfix')) then
    new.time_closed := now();
  end if;

  if new.status in ('open', 'fixed') then
    new.time_closed := null;
  end if;

  if new.status = 'open' then
    new.time_fixed := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists issues_guard_status on public.issues;
create trigger issues_guard_status
  before insert or update on public.issues
  for each row execute function public.guard_issue_status();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  display text;
begin
  display := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1));

  insert into public.workspaces (name, owner_id)
    values (display || '''s issues', new.id)
    returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, new.id, 'owner');

  insert into public.profiles (id, email, display_name, initials, active_workspace)
    values (new.id, new.email, display, upper(left(display, 2)), ws_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.join_workspace(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  select id into ws_id from public.workspaces where invite_code = lower(btrim(code));
  if ws_id is null then
    raise exception 'No workspace with that invite code';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, auth.uid(), 'member')
    on conflict do nothing;

  return ws_id;
end;
$$;

alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.issue_tags        enable row level security;
alter table public.issues            enable row level security;
alter table public.issue_comments    enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      where mine.user_id = auth.uid() and theirs.user_id = public.profiles.id
    )
  );

drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists workspaces_read on public.workspaces;
create policy workspaces_read on public.workspaces
  for select using (public.is_member(id));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete using (owner_id = auth.uid());

drop policy if exists members_read on public.workspace_members;
create policy members_read on public.workspace_members
  for select using (user_id = auth.uid() or public.is_member(workspace_id));

drop policy if exists members_insert on public.workspace_members;
create policy members_insert on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  );

drop policy if exists members_delete on public.workspace_members;
create policy members_delete on public.workspace_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  );

drop policy if exists tags_all on public.issue_tags;
create policy tags_all on public.issue_tags
  for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

drop policy if exists issues_all on public.issues;
create policy issues_all on public.issues
  for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

drop policy if exists comments_all on public.issue_comments;
create policy comments_all on public.issue_comments
  for all using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  ) with check (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  );

alter publication supabase_realtime add table public.issues;
alter publication supabase_realtime add table public.issue_comments;
alter publication supabase_realtime add table public.issue_tags;
