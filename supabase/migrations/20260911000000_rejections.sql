
create table if not exists public.issue_rejections (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid        not null references public.issues on delete cascade,
  reason     text        not null default '',
  tested     text        not null default '',
  severity   text        not null default 'still-broken'
               check (severity in ('still-broken', 'partly-fixed', 'wrong-fix')),
  by_name    text        not null default '',
  fix_by     text        not null default '',
  created_at timestamptz not null default now(),
  created_by uuid        references auth.users on delete set null
);

create index if not exists issue_rejections_issue on public.issue_rejections (issue_id);

alter table public.issue_rejections enable row level security;

drop policy if exists rejections_all on public.issue_rejections;
create policy rejections_all on public.issue_rejections
  for all using (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  ) with check (
    exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  );

do $$
begin
  alter publication supabase_realtime add table public.issue_rejections;
exception when duplicate_object then null;
end $$;


alter table public.issue_attachments
  add column if not exists rejection_id uuid references public.issue_rejections on delete cascade;

create index if not exists issue_attachments_rejection
  on public.issue_attachments (rejection_id);

alter table public.issue_attachments drop constraint if exists issue_attachments_host_check;
alter table public.issue_attachments
  add constraint issue_attachments_host_check
  check (host in ('imgur', 'catbox', 'mclogs', 'discord', 'youtube', 'link'));


insert into public.issue_rejections (issue_id, reason, by_name, created_at)
select
  i.id,
  coalesce(m[3], btrim(regexp_replace(line, '^-\s*', ''))),
  btrim(coalesce(m[2], '')),
  coalesce(
    to_timestamp(replace(m[1], 'T', ' '), 'YYYY-MM-DD HH24:MI:SS'),
    i.time_opened
  )
from public.issues i
cross join lateral unnest(
  string_to_array(
    regexp_replace(
      replace(i.rejections, E'\r\n', E'\n'),
      E'\n(-\s*\d{4}-\d{2}-\d{2})',
      E'\x01\1',
      'g'
    ),
    E'\x01'
  )
) as line
cross join lateral (
  select regexp_match(
    btrim(line),
    '^-\s*(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)\s*(?:\|\s*([^:]*))?:\s*([\s\S]*)$'
  ) as m
) parsed
where btrim(line) <> ''
  and not exists (select 1 from public.issue_rejections r where r.issue_id = i.id);
