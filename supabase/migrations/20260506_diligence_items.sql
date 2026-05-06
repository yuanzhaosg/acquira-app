create table if not exists diligence_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  workflow_item_id text,
  category text not null,
  question text not null,
  request text,
  why_it_matters text,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'not_requested' check (status in ('not_requested', 'requested', 'received', 'verified', 'waived', 'rejected')),
  owner uuid references auth.users(id),
  due_date date,
  linked_fact_ids text[] default '{}',
  linked_evidence_ids text[] default '{}',
  linked_document_ids uuid[] default '{}',
  notes text,
  waiver_reason text,
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(deal_id, workflow_item_id)
);

create index if not exists diligence_items_deal_id_idx on diligence_items(deal_id);
create index if not exists diligence_items_status_idx on diligence_items(status);
create index if not exists diligence_items_owner_idx on diligence_items(owner);

create or replace function update_diligence_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists diligence_items_updated_at on diligence_items;
create trigger diligence_items_updated_at
  before update on diligence_items
  for each row execute function update_diligence_items_updated_at();

alter table diligence_items enable row level security;

drop policy if exists "diligence_items_deal_access_select" on diligence_items;
create policy "diligence_items_deal_access_select" on diligence_items
  for select using (
    exists (
      select 1 from deals
      where deals.id = diligence_items.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "diligence_items_deal_access_insert" on diligence_items;
create policy "diligence_items_deal_access_insert" on diligence_items
  for insert with check (
    exists (
      select 1 from deals
      where deals.id = diligence_items.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "diligence_items_deal_access_update" on diligence_items;
create policy "diligence_items_deal_access_update" on diligence_items
  for update using (
    exists (
      select 1 from deals
      where deals.id = diligence_items.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  ) with check (
    exists (
      select 1 from deals
      where deals.id = diligence_items.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );
