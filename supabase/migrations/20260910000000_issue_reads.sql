create table if not exists public.issue_reads (
  issue_id uuid        not null references public.issues on delete cascade,
  user_id  uuid        not null references auth.users on delete cascade,
  seen_at  timestamptz not null default now(),
  primary key (issue_id, user_id)
);

create index if not exists issue_reads_user on public.issue_reads (user_id);

alter table public.issue_reads enable row level security;

drop policy if exists reads_own on public.issue_reads;
create policy reads_own on public.issue_reads
  for all using (
    user_id = auth.uid()
    and exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  ) with check (
    user_id = auth.uid()
    and exists (select 1 from public.issues i where i.id = issue_id and public.is_member(i.workspace_id))
  );
