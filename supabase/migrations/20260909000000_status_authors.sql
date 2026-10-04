alter table public.issues
  add column if not exists fixed_by  text not null default '',
  add column if not exists closed_by text not null default '';

create or replace function public.guard_issue_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'fixed' and coalesce(btrim(new.test_procedure), '') = '' then
    raise exception 'A card marked fixed needs a test procedure';
  end if;

  if new.status = 'fixed' and (tg_op = 'INSERT' or old.status is distinct from 'fixed') then
    new.time_fixed := now();
  end if;

  if new.status in ('resolved', 'wontfix') and (tg_op = 'INSERT' or old.status not in ('resolved', 'wontfix')) then
    new.time_closed := now();
  end if;

  if new.status in ('open', 'fixed') then
    new.time_closed := null;
    new.closed_by := '';
  end if;

  if new.status = 'open' then
    new.time_fixed := null;
    new.fixed_by := '';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists issues_guard_status on public.issues;
create trigger issues_guard_status
  before insert or update on public.issues
  for each row execute function public.guard_issue_status();
