create table if not exists underwriting_runs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  run_number int not null,
  run_type text not null check (run_type in ('initial', 'reunderwrite')),
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  "trigger" text not null check ("trigger" in ('user_requested', 'document_upload', 'manual')),
  base_run_id uuid references underwriting_runs(id),
  input_source_paths text[] not null default '{}',
  input_diligence_document_ids uuid[] not null default '{}',
  extracted jsonb,
  scored jsonb,
  workflow jsonb,
  diff jsonb,
  error_message text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  promoted_at timestamptz,
  is_current boolean not null default false,
  unique(deal_id, run_number)
);

create unique index if not exists underwriting_runs_one_current_per_deal_idx
  on underwriting_runs(deal_id)
  where is_current = true;

create index if not exists underwriting_runs_deal_id_idx on underwriting_runs(deal_id);
create index if not exists underwriting_runs_created_at_idx on underwriting_runs(created_at);
create index if not exists underwriting_runs_base_run_id_idx on underwriting_runs(base_run_id);

alter table deals
add column if not exists current_run_id uuid references underwriting_runs(id) on delete set null;

create index if not exists deals_current_run_id_idx on deals(current_run_id);

alter table underwriting_runs enable row level security;

drop policy if exists "underwriting_runs_deal_access_select" on underwriting_runs;
create policy "underwriting_runs_deal_access_select" on underwriting_runs
  for select using (
    exists (
      select 1 from deals
      where deals.id = underwriting_runs.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "underwriting_runs_deal_access_insert" on underwriting_runs;
create policy "underwriting_runs_deal_access_insert" on underwriting_runs
  for insert with check (
    exists (
      select 1 from deals
      where deals.id = underwriting_runs.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
    and (
      underwriting_runs.base_run_id is null
      or exists (
        select 1 from underwriting_runs base_run
        where base_run.id = underwriting_runs.base_run_id
          and base_run.deal_id = underwriting_runs.deal_id
      )
    )
  );

drop policy if exists "underwriting_runs_deal_access_update" on underwriting_runs;
create policy "underwriting_runs_deal_access_update" on underwriting_runs
  for update using (
    exists (
      select 1 from deals
      where deals.id = underwriting_runs.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  ) with check (
    exists (
      select 1 from deals
      where deals.id = underwriting_runs.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
    and (
      underwriting_runs.base_run_id is null
      or exists (
        select 1 from underwriting_runs base_run
        where base_run.id = underwriting_runs.base_run_id
          and base_run.deal_id = underwriting_runs.deal_id
      )
    )
  );

drop policy if exists "underwriting_runs_deal_access_delete" on underwriting_runs;
create policy "underwriting_runs_deal_access_delete" on underwriting_runs
  for delete using (
    exists (
      select 1 from deals
      where deals.id = underwriting_runs.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

-- Existing deal rows only keep parsed report JSON and the first source filename;
-- original pipeline storage objects were deleted after processing, so source paths
-- are intentionally backfilled as empty until source retention is added.
with inserted_runs as (
  insert into underwriting_runs (
    deal_id,
    run_number,
    run_type,
    status,
    "trigger",
    input_source_paths,
    input_diligence_document_ids,
    extracted,
    scored,
    workflow,
    diff,
    created_by,
    created_at,
    completed_at,
    promoted_at,
    is_current
  )
  select
    d.id,
    1,
    'initial',
    'completed',
    'manual',
    '{}',
    '{}',
    d.extracted,
    d.scored,
    d.workflow,
    null,
    d.user_id,
    coalesce(d.created_at, now()),
    coalesce(d.created_at, now()),
    coalesce(d.created_at, now()),
    true
  from deals d
  where d.current_run_id is null
    and not exists (
      select 1 from underwriting_runs existing
      where existing.deal_id = d.id
        and existing.run_number = 1
    )
  returning id, deal_id
)
update deals d
set current_run_id = inserted_runs.id
from inserted_runs
where d.id = inserted_runs.deal_id
  and d.current_run_id is null;

update deals d
set current_run_id = r.id
from underwriting_runs r
where d.id = r.deal_id
  and d.current_run_id is null
  and r.run_type = 'initial'
  and r.run_number = 1;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'evidence_links'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'evidence_links'
      and column_name = 'run_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'evidence_links_run_id_fkey'
  ) then
    if not exists (
      select 1
      from evidence_links
      where run_id is not null
        and not exists (
          select 1 from underwriting_runs where underwriting_runs.id = evidence_links.run_id
        )
    ) then
      alter table evidence_links
        add constraint evidence_links_run_id_fkey
        foreign key (run_id) references underwriting_runs(id) on delete set null;
    end if;
  end if;
end $$;
