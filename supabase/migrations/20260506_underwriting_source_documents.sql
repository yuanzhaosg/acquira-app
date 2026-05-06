create table if not exists deal_source_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  run_id uuid references underwriting_runs(id) on delete set null,
  original_storage_path text,
  retained_storage_path text not null,
  filename text not null,
  content_type text,
  file_size bigint,
  source_kind text not null default 'initial_upload'
    check (source_kind in ('initial_upload', 'retained_pipeline_source', 'manual_source_upload')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(deal_id, retained_storage_path)
);

create index if not exists deal_source_documents_deal_id_idx on deal_source_documents(deal_id);
create index if not exists deal_source_documents_run_id_idx on deal_source_documents(run_id);
create index if not exists deal_source_documents_created_at_idx on deal_source_documents(created_at);

alter table deal_source_documents enable row level security;

drop policy if exists "deal_source_documents_deal_access_select" on deal_source_documents;
create policy "deal_source_documents_deal_access_select" on deal_source_documents
  for select using (
    exists (
      select 1 from deals
      where deals.id = deal_source_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "deal_source_documents_deal_access_insert" on deal_source_documents;
create policy "deal_source_documents_deal_access_insert" on deal_source_documents
  for insert with check (
    exists (
      select 1 from deals
      where deals.id = deal_source_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
    and (
      deal_source_documents.run_id is null
      or exists (
        select 1 from underwriting_runs
        where underwriting_runs.id = deal_source_documents.run_id
          and underwriting_runs.deal_id = deal_source_documents.deal_id
      )
    )
  );

drop policy if exists "deal_source_documents_deal_access_update" on deal_source_documents;
create policy "deal_source_documents_deal_access_update" on deal_source_documents
  for update using (
    exists (
      select 1 from deals
      where deals.id = deal_source_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  ) with check (
    exists (
      select 1 from deals
      where deals.id = deal_source_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
    and (
      deal_source_documents.run_id is null
      or exists (
        select 1 from underwriting_runs
        where underwriting_runs.id = deal_source_documents.run_id
          and underwriting_runs.deal_id = deal_source_documents.deal_id
      )
    )
  );

drop policy if exists "deal_source_documents_deal_access_delete" on deal_source_documents;
create policy "deal_source_documents_deal_access_delete" on deal_source_documents
  for delete using (
    exists (
      select 1 from deals
      where deals.id = deal_source_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

-- Existing deals cannot be backfilled here: prior pipeline uploads were deleted
-- after processing and only parsed JSON/filename summaries remain.
