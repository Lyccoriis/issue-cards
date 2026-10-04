create or replace function public.create_workspace(name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  label text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  label := btrim(name);
  if label = '' then
    raise exception 'Workspace name cannot be empty';
  end if;

  insert into public.workspaces (name, owner_id)
    values (label, auth.uid())
    returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, auth.uid(), 'owner');

  return ws_id;
end;
$$;
