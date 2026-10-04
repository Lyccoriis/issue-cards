alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'editor', 'member', 'viewer', 'reader'));

update public.workspace_members set role = 'editor' where role = 'member';

alter table public.workspace_members
  drop constraint workspace_members_role_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'editor', 'viewer', 'reader'));

alter table public.workspace_members
  alter column role set default 'editor';

create or replace function public.is_writer(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function public.is_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

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
    values (ws_id, auth.uid(), 'editor')
    on conflict do nothing;

  return ws_id;
end;
$$;

create or replace function public.set_member_role(ws uuid, member uuid, next_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  if next_role not in ('admin', 'editor', 'viewer') then
    raise exception 'A role can only be set to admin, editor or viewer';
  end if;

  select role into caller_role
    from public.workspace_members
    where workspace_id = ws and user_id = auth.uid();

  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'Only an owner or an admin can change a role';
  end if;

  select role into target_role
    from public.workspace_members
    where workspace_id = ws and user_id = member;

  if target_role is null then
    raise exception 'That account is not in this workspace';
  end if;

  if target_role = 'owner' then
    raise exception 'The owner of a workspace keeps that role';
  end if;

  if target_role = 'reader' then
    raise exception 'That membership is not managed here';
  end if;

  if caller_role = 'admin' and (target_role = 'admin' or next_role = 'admin') then
    raise exception 'Only the owner can add or remove an admin';
  end if;

  update public.workspace_members
    set role = next_role
    where workspace_id = ws and user_id = member;
end;
$$;

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (public.is_admin(id)) with check (public.is_admin(id));

drop policy if exists members_delete on public.workspace_members;
create policy members_delete on public.workspace_members
  for delete using (
    user_id = auth.uid()
    or (
      public.is_admin(workspace_id)
      and role not in ('owner', 'reader')
    )
  );

drop policy if exists members_insert on public.workspace_members;
create policy members_insert on public.workspace_members
  for insert with check (
    (
      user_id = auth.uid()
      or public.is_admin(workspace_id)
    )
    and not exists (
      select 1 from public.workspace_members r
      where r.user_id = auth.uid() and r.role = 'reader'
    )
  );
