
insert into storage.buckets (id, name, public, file_size_limit)
values ('releases', 'releases', true, null)
on conflict (id) do update
  set public = true,
      file_size_limit = null;

drop policy if exists releases_read on storage.objects;
create policy releases_read on storage.objects
  for select using (bucket_id = 'releases');
