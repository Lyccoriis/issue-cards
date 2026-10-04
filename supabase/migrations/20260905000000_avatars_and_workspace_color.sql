alter table public.profiles
  add column if not exists avatar_url text not null default '';

alter table public.workspaces
  add column if not exists color text not null default 'blue';

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.workspaces;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.workspace_members;
exception
  when duplicate_object then null;
end;
$$;
