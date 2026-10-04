alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'member', 'reader'));

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
      and m.role in ('owner', 'member')
  );
$$;

drop policy if exists issues_all on public.issues;

drop policy if exists issues_read on public.issues;
create policy issues_read on public.issues
  for select using (public.is_member(workspace_id));

drop policy if exists issues_insert on public.issues;
create policy issues_insert on public.issues
  for insert with check (public.is_writer(workspace_id));

drop policy if exists issues_update on public.issues;
create policy issues_update on public.issues
  for update using (public.is_writer(workspace_id)) with check (public.is_writer(workspace_id));

drop policy if exists issues_delete on public.issues;
create policy issues_delete on public.issues
  for delete using (public.is_writer(workspace_id));

drop policy if exists tags_all on public.issue_tags;

drop policy if exists tags_read on public.issue_tags;
create policy tags_read on public.issue_tags
  for select using (public.is_member(workspace_id));

drop policy if exists tags_insert on public.issue_tags;
create policy tags_insert on public.issue_tags
  for insert with check (public.is_writer(workspace_id));

drop policy if exists tags_update on public.issue_tags;
create policy tags_update on public.issue_tags
  for update using (public.is_writer(workspace_id)) with check (public.is_writer(workspace_id));

drop policy if exists tags_delete on public.issue_tags;
create policy tags_delete on public.issue_tags
  for delete using (public.is_writer(workspace_id));

drop policy if exists comments_all on public.issue_comments;

drop policy if exists comments_read on public.issue_comments;
create policy comments_read on public.issue_comments
  for select using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  );

drop policy if exists comments_insert on public.issue_comments;
create policy comments_insert on public.issue_comments
  for insert with check (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_writer(i.workspace_id))
  );

drop policy if exists comments_update on public.issue_comments;
create policy comments_update on public.issue_comments
  for update using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_writer(i.workspace_id))
  ) with check (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_writer(i.workspace_id))
  );

drop policy if exists comments_delete on public.issue_comments;
create policy comments_delete on public.issue_comments
  for delete using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_writer(i.workspace_id))
  );

drop policy if exists attachments_all on public.issue_attachments;

drop policy if exists attachments_read on public.issue_attachments;
create policy attachments_read on public.issue_attachments
  for select using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  );

drop policy if exists attachments_insert on public.issue_attachments;
create policy attachments_insert on public.issue_attachments
  for insert with check (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_writer(i.workspace_id))
  );

drop policy if exists attachments_update on public.issue_attachments;
create policy attachments_update on public.issue_attachments
  for update using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_writer(i.workspace_id))
  ) with check (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_writer(i.workspace_id))
  );

drop policy if exists attachments_delete on public.issue_attachments;
create policy attachments_delete on public.issue_attachments
  for delete using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_writer(i.workspace_id))
  );

drop policy if exists members_insert on public.workspace_members;
create policy members_insert on public.workspace_members
  for insert with check (
    (
      user_id = auth.uid()
      or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
    )
    and not exists (
      select 1 from public.workspace_members r
      where r.user_id = auth.uid() and r.role = 'reader'
    )
  );

create or replace function public.grant_reader(ws uuid, reader_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if not exists (select 1 from public.workspaces w where w.id = ws and w.owner_id = auth.uid()) then
    raise exception 'Only the owner of a workspace can add a reader to it';
  end if;

  select id into uid from auth.users where lower(email) = lower(btrim(reader_email));
  if uid is null then
    raise exception 'No account with that email';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
    values (ws, uid, 'reader')
    on conflict (workspace_id, user_id) do update set role = 'reader';
end;
$$;
