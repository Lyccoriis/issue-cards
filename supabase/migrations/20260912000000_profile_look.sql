alter table public.profiles
  add column if not exists bio text not null default '';

alter table public.profiles
  add column if not exists banner_url text not null default '';

alter table public.profiles
  add column if not exists avatar_border text not null default 'none';

