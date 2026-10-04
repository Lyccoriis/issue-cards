create or replace function public.pin_author()
returns trigger
language plpgsql
as $$
declare
  who text;
begin
  if current_user not in ('authenticated', 'anon') or auth.uid() is null then
    return new;
  end if;

  select coalesce(nullif(btrim(display_name), ''), email, 'Unknown')
    into who
    from public.profiles
    where id = auth.uid();
  who := coalesce(who, 'Unknown');

  if tg_table_name = 'issues' then
    new.created_by := auth.uid();
  elsif tg_table_name in ('issue_comments', 'test_notes') then
    new.created_by := auth.uid();
    new.author := who;
  elsif tg_table_name = 'issue_rejections' then
    new.created_by := auth.uid();
    new.by_name := who;
  elsif tg_table_name = 'notifications' then
    new.actor_name := who;
  end if;

  return new;
end;
$$;

drop trigger if exists pin_author on public.issues;
create trigger pin_author before insert on public.issues
  for each row execute function public.pin_author();

drop trigger if exists pin_author on public.issue_comments;
create trigger pin_author before insert on public.issue_comments
  for each row execute function public.pin_author();

drop trigger if exists pin_author on public.test_notes;
create trigger pin_author before insert on public.test_notes
  for each row execute function public.pin_author();

drop trigger if exists pin_author on public.issue_rejections;
create trigger pin_author before insert on public.issue_rejections
  for each row execute function public.pin_author();

drop trigger if exists pin_author on public.notifications;
create trigger pin_author before insert on public.notifications
  for each row execute function public.pin_author();

alter table public.workspaces
  alter column invite_code set default replace(gen_random_uuid()::text, '-', '');

create or replace function public.regenerate_invite_code(ws uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh text := replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;

  update public.workspaces
    set invite_code = fresh
    where id = ws and owner_id = auth.uid();

  if not found then
    raise exception 'Only the owner can change the invite code';
  end if;

  return fresh;
end;
$$;

revoke all on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
