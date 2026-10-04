alter table public.issues
  add column if not exists test_result_id uuid references public.test_results on delete set null,
  add column if not exists test_ref text not null default '';

create index if not exists issues_test_ref on public.issues (workspace_id, test_ref) where test_ref <> '';
create index if not exists issues_test_result on public.issues (test_result_id) where test_result_id is not null;

create or replace function public.file_test_issue(p_result uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_ref      text;
  v_title    text;
  v_body     text;
  v_proc     text;
  v_issue    public.issues%rowtype;
  v_id       uuid;
  v_rej      uuid;
  v_same     boolean;
  v_line     text;
begin
  select tr.id as result_id, tr.user_id, tr.result, tr.why, tr.repro, tr.tester_name, tr.workspace_id,
         s.num, s.how, s.expected, g.letter, f.key, f.version
    into r
    from public.test_results tr
    join public.test_steps s on s.id = tr.step_id
    join public.test_groups g on g.id = s.group_id
    join public.test_features f on f.id = tr.feature_id
    where tr.id = p_result;

  if not found then
    raise exception 'That answer is gone, reload the list';
  end if;
  if r.user_id is distinct from auth.uid() then
    raise exception 'Only the tester who answered can file it';
  end if;
  if r.result <> 'fail' then
    raise exception 'Only a broken step files an issue';
  end if;
  if not public.is_tester(r.workspace_id) then
    raise exception 'Your role in this workspace cannot answer tests';
  end if;

  v_ref := r.key || ' ' || r.letter || r.num;
  v_title := v_ref || ': ' || left(regexp_replace(btrim(r.why), '\s+', ' ', 'g'), 80);
  v_body := btrim(r.why) || E'\n\n**How to see it**\n' || btrim(r.repro);
  v_proc := 'Do: ' || r.how || E'\n\nExpect: ' || r.expected;

  select i.* into v_issue
    from public.issues i
    where i.workspace_id = r.workspace_id and i.test_ref = v_ref
    order by i.time_opened desc
    limit 1;

  if not found then
    insert into public.issues
      (workspace_id, title, type, priority, status, version, description, test_procedure,
       tags, created_by, test_result_id, test_ref)
      values
      (r.workspace_id, v_title, 'Bug', 'medium', 'open', r.version, v_body, v_proc,
       array['test'], r.user_id, p_result, v_ref)
      returning id into v_id;
  else
    v_id := v_issue.id;
    v_same := v_issue.test_result_id is null
      or exists (select 1 from public.test_results t where t.id = v_issue.test_result_id and t.user_id = r.user_id);

    if v_same then
      update public.issues
        set title = v_title, description = v_body, test_procedure = v_proc, test_result_id = p_result
        where id = v_id;
    else
      insert into public.issue_comments (issue_id, author, body, created_by)
        values (v_id, r.tester_name,
                'Also broken for me.' || E'\n\n' || btrim(r.why) || E'\n\n**How to see it**\n' || btrim(r.repro),
                r.user_id);
    end if;

    if v_issue.status = 'fixed' then
      insert into public.issue_rejections (issue_id, severity, reason, tested, by_name, fix_by, created_by)
        values (v_id, 'still-broken', btrim(r.why), btrim(r.repro), r.tester_name, v_issue.fixed_by, r.user_id)
        returning id into v_rej;
      v_line := '- ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS') || ' | ' || r.tester_name || ': '
        || replace(replace(btrim(r.why), E'\r', ' '), E'\n', ' ');
      update public.issues
        set status = 'open',
            rejections = case when rejections = '' then v_line else rejections || E'\n' || v_line end
        where id = v_id;
    elsif v_issue.status in ('resolved', 'wontfix') then
      update public.issues set status = 'open' where id = v_id;
    end if;
  end if;

  insert into public.issue_attachments
    (issue_id, rejection_id, url, kind, host, name, mime, bytes, source_url, created_by)
    select v_id, v_rej, a.url, a.kind, a.host, a.name, a.mime, a.bytes, a.source_url, a.created_by
    from public.test_attachments a
    where a.result_id = p_result
      and not exists (
        select 1 from public.issue_attachments x
        where x.issue_id = v_id and x.url = a.url and x.rejection_id is not distinct from v_rej
      );

  return v_id;
end;
$$;

create or replace function public.sync_test_from_issue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step uuid;
begin
  if new.test_result_id is null or new.status is not distinct from old.status then
    return new;
  end if;

  select step_id into v_step from public.test_results where id = new.test_result_id;
  if v_step is null then
    return new;
  end if;

  if new.status = 'resolved' then
    update public.test_results
      set result = 'pass'
      where step_id = v_step and result = 'fail' and not superseded;
  elsif old.status = 'resolved' and new.status = 'open' then
    update public.test_results
      set result = 'fail'
      where step_id = v_step and result = 'pass' and not superseded
        and btrim(why) <> '' and btrim(repro) <> '';
  end if;

  return new;
end;
$$;

drop trigger if exists issues_sync_test on public.issues;
create trigger issues_sync_test
  after update of status on public.issues
  for each row execute function public.sync_test_from_issue();
