create table if not exists diligence_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  storage_path text not null,
  filename text not null,
  mime_type text,
  file_size bigint,
  document_type text,
  source_item_id uuid references diligence_items(id) on delete set null,
  extraction_status text default 'uploaded' check (extraction_status in ('uploaded', 'processing', 'processed', 'failed')),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  processed_at timestamptz
);

create table if not exists evidence_links (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  diligence_item_id uuid references diligence_items(id) on delete cascade,
  document_id uuid references diligence_documents(id) on delete cascade,
  fact_id text,
  evidence_id text,
  run_id uuid,
  link_type text default 'supports',
  notes text,
  created_at timestamptz default now()
);

create index if not exists diligence_documents_deal_id_idx on diligence_documents(deal_id);
create index if not exists diligence_documents_source_item_id_idx on diligence_documents(source_item_id);
create index if not exists evidence_links_deal_id_idx on evidence_links(deal_id);
create index if not exists evidence_links_item_id_idx on evidence_links(diligence_item_id);
create index if not exists evidence_links_document_id_idx on evidence_links(document_id);

alter table diligence_documents enable row level security;
alter table evidence_links enable row level security;

drop policy if exists "diligence_documents_deal_access_select" on diligence_documents;
create policy "diligence_documents_deal_access_select" on diligence_documents
  for select using (
    exists (
      select 1 from deals
      where deals.id = diligence_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "diligence_documents_deal_access_insert" on diligence_documents;
create policy "diligence_documents_deal_access_insert" on diligence_documents
  for insert with check (
    exists (
      select 1 from deals
      where deals.id = diligence_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
    and (
      diligence_documents.source_item_id is null
      or exists (
        select 1 from diligence_items
        where diligence_items.id = diligence_documents.source_item_id
          and diligence_items.deal_id = diligence_documents.deal_id
      )
    )
  );

drop policy if exists "evidence_links_deal_access_select" on evidence_links;
create policy "evidence_links_deal_access_select" on evidence_links
  for select using (
    exists (
      select 1 from deals
      where deals.id = evidence_links.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "evidence_links_deal_access_insert" on evidence_links;
create policy "evidence_links_deal_access_insert" on evidence_links
  for insert with check (
    exists (
      select 1 from deals
      where deals.id = evidence_links.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
    and (
      evidence_links.diligence_item_id is null
      or exists (
        select 1 from diligence_items
        where diligence_items.id = evidence_links.diligence_item_id
          and diligence_items.deal_id = evidence_links.deal_id
      )
    )
    and (
      evidence_links.document_id is null
      or exists (
        select 1 from diligence_documents
        where diligence_documents.id = evidence_links.document_id
          and diligence_documents.deal_id = evidence_links.deal_id
      )
    )
  );
