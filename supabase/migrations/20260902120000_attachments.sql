create table if not exists public.issue_attachments (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid        not null references public.issues on delete cascade,
  url        text        not null,
  kind       text        not null default 'file' check (kind in ('image', 'video', 'youtube', 'file')),
  host       text        not null default 'link' check (host in ('imgur', 'catbox', 'discord', 'youtube', 'link')),
  name       text        not null default '',
  mime       text        not null default '',
  bytes      bigint      not null default 0,
  source_url text        not null default '',
  created_at timestamptz not null default now(),
  created_by uuid        references auth.users on delete set null
);

create index if not exists issue_attachments_issue on public.issue_attachments (issue_id);

alter table public.issue_attachments enable row level security;

drop policy if exists attachments_all on public.issue_attachments;
create policy attachments_all on public.issue_attachments
  for all using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  ) with check (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  );

alter publication supabase_realtime add table public.issue_attachments;
