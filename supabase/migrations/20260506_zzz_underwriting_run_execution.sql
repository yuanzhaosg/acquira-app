alter table underwriting_runs
add column if not exists started_at timestamptz,
add column if not exists execution_mode text not null default 'sync' check (execution_mode in ('sync', 'async_placeholder')),
add column if not exists input_document_count int,
add column if not exists input_total_bytes bigint,
add column if not exists progress_message text,
add column if not exists progress_step text,
add column if not exists retry_count int not null default 0,
add column if not exists last_error_at timestamptz;

create index if not exists underwriting_runs_status_created_at_idx
  on underwriting_runs(deal_id, status, created_at);
