create table if not exists evidence_requests (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  run_id uuid references underwriting_runs(id) on delete set null,
  diligence_item_id uuid references diligence_items(id) on delete set null,
  request_type text not null check (request_type in ('valuation_blocker', 'diligence_item', 'market_gap', 'pipeline_gap', 'other')),
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'received', 'waived', 'closed')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  requested_from text,
  requested_at timestamptz,
  due_date date,
  copied_to_clipboard_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evidence_requests_deal_id_idx on evidence_requests(deal_id);
create index if not exists evidence_requests_run_id_idx on evidence_requests(run_id);
create index if not exists evidence_requests_diligence_item_id_idx on evidence_requests(diligence_item_id);
create index if not exists evidence_requests_status_idx on evidence_requests(status);
create index if not exists evidence_requests_due_date_idx on evidence_requests(due_date);

alter table evidence_requests enable row level security;

drop policy if exists "evidence_requests_deal_access_select" on evidence_requests;
create policy "evidence_requests_deal_access_select" on evidence_requests
  for select using (
    exists (
      select 1 from deals
      where deals.id = evidence_requests.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "evidence_requests_deal_access_insert" on evidence_requests;
create policy "evidence_requests_deal_access_insert" on evidence_requests
  for insert with check (
    exists (
      select 1 from deals
      where deals.id = evidence_requests.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
    and (
      evidence_requests.run_id is null
      or exists (
        select 1 from underwriting_runs
        where underwriting_runs.id = evidence_requests.run_id
          and underwriting_runs.deal_id = evidence_requests.deal_id
      )
    )
    and (
      evidence_requests.diligence_item_id is null
      or exists (
        select 1 from diligence_items
        where diligence_items.id = evidence_requests.diligence_item_id
          and diligence_items.deal_id = evidence_requests.deal_id
      )
    )
  );

drop policy if exists "evidence_requests_deal_access_update" on evidence_requests;
create policy "evidence_requests_deal_access_update" on evidence_requests
  for update using (
    exists (
      select 1 from deals
      where deals.id = evidence_requests.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  ) with check (
    exists (
      select 1 from deals
      where deals.id = evidence_requests.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
    and (
      evidence_requests.run_id is null
      or exists (
        select 1 from underwriting_runs
        where underwriting_runs.id = evidence_requests.run_id
          and underwriting_runs.deal_id = evidence_requests.deal_id
      )
    )
    and (
      evidence_requests.diligence_item_id is null
      or exists (
        select 1 from diligence_items
        where diligence_items.id = evidence_requests.diligence_item_id
          and diligence_items.deal_id = evidence_requests.deal_id
      )
    )
  );

drop policy if exists "evidence_requests_deal_access_delete" on evidence_requests;
create policy "evidence_requests_deal_access_delete" on evidence_requests
  for delete using (
    exists (
      select 1 from deals
      where deals.id = evidence_requests.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

-- updated_at is maintained by application routes for now; this avoids depending
-- on a project-wide timestamp trigger that may not exist in older environments.
