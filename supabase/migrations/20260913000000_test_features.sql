create table if not exists public.test_features (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid        not null references public.workspaces on delete cascade,
  seq             integer     not null,
  key             text        not null,
  title           text        not null,
  version         text        not null default '',
  done            text        not null default '',
  round           integer     not null default 1,
  archived        boolean     not null default false,
  created_by      uuid        references auth.users on delete set null,
  created_by_name text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists test_features_workspace_seq on public.test_features (workspace_id, seq);

create table if not exists public.test_groups (
  id           uuid primary key default gen_random_uuid(),
  feature_id   uuid        not null references public.test_features on delete cascade,
  workspace_id uuid        not null references public.workspaces on delete cascade,
  letter       text        not null check (letter ~ '^[A-Z]{1,2}$'),
  title        text        not null default '',
  setup        text        not null default '',
  position     integer     not null default 0,
  unique (feature_id, letter)
);

create table if not exists public.test_steps (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid        not null references public.test_groups on delete cascade,
  feature_id   uuid        not null references public.test_features on delete cascade,
  workspace_id uuid        not null references public.workspaces on delete cascade,
  num          integer     not null check (num > 0),
  how          text        not null default '',
  expected     text        not null default '',
  position     integer     not null default 0,
  unique (group_id, num)
);

create table if not exists public.test_results (
  id           uuid primary key default gen_random_uuid(),
  step_id      uuid        not null references public.test_steps on delete cascade,
  feature_id   uuid        not null references public.test_features on delete cascade,
  workspace_id uuid        not null references public.workspaces on delete cascade,
  user_id      uuid        not null references auth.users on delete cascade,
  tester_name  text        not null default '',
  result       text        not null check (result in ('pass', 'fail')),
  why          text        not null default '',
  repro        text        not null default '',
  round        integer     not null default 1,
  superseded   boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists test_results_live
  on public.test_results (step_id, user_id) where not superseded;
create index if not exists test_results_feature on public.test_results (feature_id);

create table if not exists public.test_attachments (
  id           uuid primary key default gen_random_uuid(),
  result_id    uuid        not null references public.test_results on delete cascade,
  workspace_id uuid        not null references public.workspaces on delete cascade,
  url          text        not null,
  kind         text        not null default 'file' check (kind in ('image', 'video', 'youtube', 'file')),
  host         text        not null default 'link'
                 check (host in ('imgur', 'catbox', 'mclogs', 'discord', 'youtube', 'link')),
  name         text        not null default '',
  mime         text        not null default '',
  bytes        bigint      not null default 0,
  source_url   text        not null default '',
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users on delete set null
);

create index if not exists test_attachments_result on public.test_attachments (result_id);

create or replace function public.is_tester(ws uuid)
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
      and m.role in ('owner', 'admin', 'editor', 'viewer')
  );
$$;

create or replace function public.assign_test_feature_key()
returns trigger
language plpgsql
as $$
declare
  next_seq integer;
begin
  perform 1 from public.workspaces where id = new.workspace_id for update;
  select coalesce(max(seq), 0) + 1 into next_seq
    from public.test_features where workspace_id = new.workspace_id;
  new.seq := next_seq;
  new.key := 'TEST-' || lpad(next_seq::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists test_features_assign_key on public.test_features;
create trigger test_features_assign_key
  before insert on public.test_features
  for each row execute function public.assign_test_feature_key();

create or replace function public.guard_test_feature()
returns trigger
language plpgsql
as $$
begin
  if coalesce(btrim(new.title), '') = '' then
    raise exception 'A feature needs a title';
  end if;
  if coalesce(btrim(new.done), '') = '' then
    raise exception 'A feature needs a note on what was done';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists test_features_guard on public.test_features;
create trigger test_features_guard
  before insert or update on public.test_features
  for each row execute function public.guard_test_feature();

create or replace function public.test_fill_scope()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'test_groups' then
    select f.workspace_id into new.workspace_id
      from public.test_features f where f.id = new.feature_id;
  elsif tg_table_name = 'test_steps' then
    select g.workspace_id, g.feature_id into new.workspace_id, new.feature_id
      from public.test_groups g where g.id = new.group_id;
  elsif tg_table_name = 'test_results' then
    select s.workspace_id, s.feature_id into new.workspace_id, new.feature_id
      from public.test_steps s where s.id = new.step_id;
  elsif tg_table_name = 'test_attachments' then
    select r.workspace_id into new.workspace_id
      from public.test_results r where r.id = new.result_id;
  end if;

  if new.workspace_id is null then
    raise exception 'The parent row for this % is gone', tg_table_name;
  end if;
  return new;
end;
$$;

drop trigger if exists test_groups_scope on public.test_groups;
create trigger test_groups_scope
  before insert or update on public.test_groups
  for each row execute function public.test_fill_scope();

drop trigger if exists test_steps_scope on public.test_steps;
create trigger test_steps_scope
  before insert or update on public.test_steps
  for each row execute function public.test_fill_scope();

drop trigger if exists test_results_scope on public.test_results;
drop trigger if exists test_results_a_scope on public.test_results;
create trigger test_results_a_scope
  before insert or update on public.test_results
  for each row execute function public.test_fill_scope();

drop trigger if exists test_attachments_scope on public.test_attachments;
create trigger test_attachments_scope
  before insert or update on public.test_attachments
  for each row execute function public.test_fill_scope();

create or replace function public.guard_test_result()
returns trigger
language plpgsql
as $$
begin
  if new.result = 'fail' then
    if coalesce(btrim(new.why), '') = '' then
      raise exception 'A failed step needs to say why it failed';
    end if;
    if coalesce(btrim(new.repro), '') = '' then
      raise exception 'A failed step needs to say how to reproduce it';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select f.round into new.round from public.test_features f where f.id = new.feature_id;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists test_results_guard on public.test_results;
drop trigger if exists test_results_b_guard on public.test_results;
create trigger test_results_b_guard
  before insert or update on public.test_results
  for each row execute function public.guard_test_result();

create or replace function public.save_test_feature(
  p_feature   uuid,
  p_workspace uuid,
  p_title     text,
  p_version   text,
  p_done      text,
  p_author    text,
  p_groups    jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  fid        uuid;
  g          jsonb;
  s          jsonb;
  gid        uuid;
  gpos       integer := 0;
  spos       integer;
  kept       text[] := '{}';
  kept_nums  integer[];
begin
  if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'A feature needs at least one test group';
  end if;

  if p_feature is null then
    insert into public.test_features (workspace_id, title, version, done, created_by, created_by_name)
      values (p_workspace, p_title, coalesce(p_version, ''), coalesce(p_done, ''), auth.uid(), coalesce(p_author, ''))
      returning id into fid;
  else
    update public.test_features
      set title = p_title, version = coalesce(p_version, ''), done = coalesce(p_done, '')
      where id = p_feature
      returning id into fid;
    if fid is null then
      raise exception 'That feature is gone, or your role may not edit it';
    end if;
  end if;

  for g in select * from jsonb_array_elements(p_groups) loop
    gpos := gpos + 1;
    if jsonb_typeof(g -> 'steps') is distinct from 'array' or jsonb_array_length(g -> 'steps') = 0 then
      raise exception 'Group % has no steps', coalesce(g ->> 'letter', gpos::text);
    end if;

    insert into public.test_groups (feature_id, letter, title, setup, position)
      values (fid, upper(btrim(g ->> 'letter')), coalesce(g ->> 'title', ''), coalesce(g ->> 'setup', ''), gpos)
      on conflict (feature_id, letter)
      do update set title = excluded.title, setup = excluded.setup, position = excluded.position
      returning id into gid;

    kept := kept || upper(btrim(g ->> 'letter'));
    kept_nums := '{}';
    spos := 0;

    for s in select * from jsonb_array_elements(g -> 'steps') loop
      spos := spos + 1;
      insert into public.test_steps (group_id, num, how, expected, position)
        values (gid, (s ->> 'num')::integer, coalesce(s ->> 'how', ''), coalesce(s ->> 'expected', ''), spos)
        on conflict (group_id, num)
        do update set how = excluded.how, expected = excluded.expected, position = excluded.position;
      kept_nums := kept_nums || (s ->> 'num')::integer;
    end loop;

    delete from public.test_steps where group_id = gid and num <> all (kept_nums);
  end loop;

  delete from public.test_groups where feature_id = fid and letter <> all (kept);

  return fid;
end;
$$;

create or replace function public.request_test_retest(p_feature uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ws       uuid;
  next_round integer;
  moved    integer;
begin
  select workspace_id into ws from public.test_features where id = p_feature;
  if ws is null then
    raise exception 'That feature is gone, reload the list';
  end if;
  if not public.is_writer(ws) then
    raise exception 'Only someone who can write cards can ask for a retest';
  end if;

  update public.test_results
    set superseded = true
    where feature_id = p_feature and result = 'fail' and not superseded;
  get diagnostics moved = row_count;

  if moved = 0 then
    raise exception 'No step has failed, nothing to retest';
  end if;

  update public.test_features set round = round + 1 where id = p_feature
    returning round into next_round;
  return next_round;
end;
$$;

alter table public.test_features    enable row level security;
alter table public.test_groups      enable row level security;
alter table public.test_steps       enable row level security;
alter table public.test_results     enable row level security;
alter table public.test_attachments enable row level security;

drop policy if exists test_features_read on public.test_features;
create policy test_features_read on public.test_features
  for select using (public.is_member(workspace_id));
drop policy if exists test_features_insert on public.test_features;
create policy test_features_insert on public.test_features
  for insert with check (public.is_writer(workspace_id));
drop policy if exists test_features_update on public.test_features;
create policy test_features_update on public.test_features
  for update using (public.is_writer(workspace_id)) with check (public.is_writer(workspace_id));
drop policy if exists test_features_delete on public.test_features;
create policy test_features_delete on public.test_features
  for delete using (public.is_writer(workspace_id));

drop policy if exists test_groups_read on public.test_groups;
create policy test_groups_read on public.test_groups
  for select using (public.is_member(workspace_id));
drop policy if exists test_groups_insert on public.test_groups;
create policy test_groups_insert on public.test_groups
  for insert with check (public.is_writer(workspace_id));
drop policy if exists test_groups_update on public.test_groups;
create policy test_groups_update on public.test_groups
  for update using (public.is_writer(workspace_id)) with check (public.is_writer(workspace_id));
drop policy if exists test_groups_delete on public.test_groups;
create policy test_groups_delete on public.test_groups
  for delete using (public.is_writer(workspace_id));

drop policy if exists test_steps_read on public.test_steps;
create policy test_steps_read on public.test_steps
  for select using (public.is_member(workspace_id));
drop policy if exists test_steps_insert on public.test_steps;
create policy test_steps_insert on public.test_steps
  for insert with check (public.is_writer(workspace_id));
drop policy if exists test_steps_update on public.test_steps;
create policy test_steps_update on public.test_steps
  for update using (public.is_writer(workspace_id)) with check (public.is_writer(workspace_id));
drop policy if exists test_steps_delete on public.test_steps;
create policy test_steps_delete on public.test_steps
  for delete using (public.is_writer(workspace_id));

drop policy if exists test_results_read on public.test_results;
create policy test_results_read on public.test_results
  for select using (public.is_member(workspace_id));
drop policy if exists test_results_insert on public.test_results;
create policy test_results_insert on public.test_results
  for insert with check (user_id = auth.uid() and public.is_tester(workspace_id));
drop policy if exists test_results_update on public.test_results;
create policy test_results_update on public.test_results
  for update using (user_id = auth.uid() and not superseded and public.is_tester(workspace_id))
  with check (user_id = auth.uid() and public.is_tester(workspace_id));
drop policy if exists test_results_delete on public.test_results;
create policy test_results_delete on public.test_results
  for delete using (
    (user_id = auth.uid() and not superseded and public.is_tester(workspace_id))
    or public.is_writer(workspace_id)
  );

drop policy if exists test_attachments_read on public.test_attachments;
create policy test_attachments_read on public.test_attachments
  for select using (public.is_member(workspace_id));
drop policy if exists test_attachments_insert on public.test_attachments;
create policy test_attachments_insert on public.test_attachments
  for insert with check (
    public.is_tester(workspace_id)
    and exists (select 1 from public.test_results r where r.id = result_id and r.user_id = auth.uid())
  );
drop policy if exists test_attachments_delete on public.test_attachments;
create policy test_attachments_delete on public.test_attachments
  for delete using (
    public.is_writer(workspace_id)
    or exists (select 1 from public.test_results r where r.id = result_id and r.user_id = auth.uid())
  );

do $$
declare
  t text;
begin
  foreach t in array array['test_features', 'test_groups', 'test_steps', 'test_results', 'test_attachments'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
