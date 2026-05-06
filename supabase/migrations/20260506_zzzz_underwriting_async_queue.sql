alter table underwriting_runs
add column if not exists queued_at timestamptz,
add column if not exists claimed_at timestamptz,
add column if not exists claim_token text,
add column if not exists worker_id text,
add column if not exists cancel_requested_at timestamptz;

create index if not exists underwriting_runs_queued_idx
  on underwriting_runs(status, queued_at)
  where status = 'queued';

create index if not exists underwriting_runs_claimed_running_idx
  on underwriting_runs(status, claimed_at)
  where status = 'running';

create index if not exists underwriting_runs_worker_id_idx
  on underwriting_runs(worker_id)
  where worker_id is not null;
