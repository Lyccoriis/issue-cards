create table if not exists public.test_notes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces on delete cascade,
  feature_id   uuid        references public.test_features on delete cascade,
  author       text        not null default '',
  body         text        not null,
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users on delete set null
);

create index if not exists test_notes_workspace on public.test_notes (workspace_id);
create index if not exists test_notes_feature on public.test_notes (feature_id);

create or replace function public.guard_test_note()
returns trigger
language plpgsql
as $$
begin
  if coalesce(btrim(new.body), '') = '' then
    raise exception 'A note needs text';
  end if;

  if new.feature_id is not null and not exists (
    select 1 from public.test_features f
    where f.id = new.feature_id and f.workspace_id = new.workspace_id
  ) then
    raise exception 'That feature is not in this workspace';
  end if;

  return new;
end;
$$;

drop trigger if exists test_notes_guard on public.test_notes;
create trigger test_notes_guard
  before insert on public.test_notes
  for each row execute function public.guard_test_note();

alter table public.test_notes enable row level security;

drop policy if exists test_notes_read on public.test_notes;
create policy test_notes_read on public.test_notes
  for select using (public.is_member(workspace_id));

drop policy if exists test_notes_insert on public.test_notes;
create policy test_notes_insert on public.test_notes
  for insert with check (created_by = auth.uid() and public.is_tester(workspace_id));

drop policy if exists test_notes_delete on public.test_notes;
create policy test_notes_delete on public.test_notes
  for delete using (
    (created_by = auth.uid() and public.is_tester(workspace_id))
    or public.is_writer(workspace_id)
  );

do $$
begin
  alter publication supabase_realtime add table public.test_notes;
exception when duplicate_object then null;
end $$;
