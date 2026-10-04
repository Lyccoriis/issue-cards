alter table public.issues
  add column if not exists sheet_ref text not null default '';

create index if not exists issues_sheet_ref
  on public.issues (workspace_id, sheet_ref)
  where sheet_ref <> '';
