alter table public.workspaces
  add column if not exists current_version text not null default '',
  add column if not exists versions text[] not null default '{}';

alter table public.issues
  add column if not exists fixed_version  text not null default '',
  add column if not exists closed_version text not null default '';

alter table public.issue_rejections
  add column if not exists version text not null default '';

alter table public.test_results
  add column if not exists version text not null default '';

create or replace function public.remember_workspace_version()
returns trigger
language plpgsql
as $$
begin
  new.current_version := btrim(new.current_version);
  if new.current_version <> '' and not (new.current_version = any (new.versions)) then
    new.versions := array_append(new.versions, new.current_version);
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_remember_version on public.workspaces;
create trigger workspaces_remember_version
  before insert or update on public.workspaces
  for each row execute function public.remember_workspace_version();

create or replace function public.guard_issue_versions()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'open' then
    new.fixed_version := '';
  end if;
  if new.status in ('open', 'fixed') then
    new.closed_version := '';
  end if;
  return new;
end;
$$;

drop trigger if exists issues_guard_versions on public.issues;
create trigger issues_guard_versions
  before update on public.issues
  for each row execute function public.guard_issue_versions();
