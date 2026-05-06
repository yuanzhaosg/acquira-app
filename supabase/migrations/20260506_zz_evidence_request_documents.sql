create table if not exists evidence_request_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  evidence_request_id uuid not null references evidence_requests(id) on delete cascade,
  diligence_document_id uuid not null references diligence_documents(id) on delete cascade,
  linked_by uuid references auth.users(id),
  linked_at timestamptz not null default now(),
  unique(evidence_request_id, diligence_document_id)
);

create index if not exists evidence_request_documents_deal_id_idx on evidence_request_documents(deal_id);
create index if not exists evidence_request_documents_request_id_idx on evidence_request_documents(evidence_request_id);
create index if not exists evidence_request_documents_document_id_idx on evidence_request_documents(diligence_document_id);

alter table evidence_request_documents enable row level security;

drop policy if exists "evidence_request_documents_deal_access_select" on evidence_request_documents;
create policy "evidence_request_documents_deal_access_select" on evidence_request_documents
  for select using (
    exists (
      select 1 from deals
      where deals.id = evidence_request_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "evidence_request_documents_deal_access_insert" on evidence_request_documents;
create policy "evidence_request_documents_deal_access_insert" on evidence_request_documents
  for insert with check (
    exists (
      select 1 from deals
      where deals.id = evidence_request_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
    and exists (
      select 1 from evidence_requests
      where evidence_requests.id = evidence_request_documents.evidence_request_id
        and evidence_requests.deal_id = evidence_request_documents.deal_id
    )
    and exists (
      select 1 from diligence_documents
      where diligence_documents.id = evidence_request_documents.diligence_document_id
        and diligence_documents.deal_id = evidence_request_documents.deal_id
    )
  );

drop policy if exists "evidence_request_documents_deal_access_delete" on evidence_request_documents;
create policy "evidence_request_documents_deal_access_delete" on evidence_request_documents
  for delete using (
    exists (
      select 1 from deals
      where deals.id = evidence_request_documents.deal_id
        and (
          deals.user_id = auth.uid()
          or deals.org_id in (select org_id from profiles where id = auth.uid())
        )
    )
  );
