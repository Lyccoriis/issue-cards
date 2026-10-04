create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces on delete cascade,
  user_id      uuid        not null references auth.users on delete cascade,
  actor_id     uuid        references auth.users on delete set null,
  actor_name   text        not null default '',
  kind         text        not null,
  title        text        not null default '',
  body         text        not null default '',
  link_kind    text        not null default '',
  link_ref     text        not null default '',
  link_sub     text        not null default '',
  dedupe_key   text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user on public.notifications (user_id, created_at desc);
create unique index if not exists notifications_dedupe on public.notifications (user_id, dedupe_key);

alter table public.notifications enable row level security;

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert with check (
    actor_id = auth.uid()
    and public.is_member(workspace_id)
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = notifications.workspace_id and m.user_id = notifications.user_id
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists notify_prefs jsonb not null default '{}'::jsonb;
