drop policy if exists members_insert on public.workspace_members;
create policy members_insert on public.workspace_members
  for insert with check (
    public.is_admin(workspace_id)
    and role in ('admin', 'editor', 'viewer')
  );

drop policy if exists rejections_all on public.issue_rejections;
drop policy if exists rejections_read on public.issue_rejections;
drop policy if exists rejections_write on public.issue_rejections;

create policy rejections_read on public.issue_rejections
  for select using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  );

create policy rejections_write on public.issue_rejections
  for all using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_tester(i.workspace_id))
  ) with check (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_tester(i.workspace_id))
  );

create or replace function public.guard_workspace_owner()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'The owner of a workspace cannot be changed';
  end if;

  if new.invite_code is distinct from old.invite_code and auth.uid() is distinct from old.owner_id then
    raise exception 'Only the owner can change the invite code';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_workspace_owner on public.workspaces;
create trigger guard_workspace_owner
  before update on public.workspaces
  for each row execute function public.guard_workspace_owner();
