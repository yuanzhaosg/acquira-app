export type UnderwritingRunType = 'initial' | 'reunderwrite'
export type UnderwritingRunStatus = 'queued' | 'running' | 'completed' | 'failed'
export type UnderwritingRunTrigger = 'user_requested' | 'document_upload' | 'manual'
export type UnderwritingRunExecutionMode = 'sync' | 'async_placeholder'

export interface UnderwritingRun {
  id: string
  deal_id: string
  run_number: number
  run_type: UnderwritingRunType
  status: UnderwritingRunStatus
  trigger: UnderwritingRunTrigger
  base_run_id?: string | null
  input_source_paths: string[]
  input_diligence_document_ids: string[]
  extracted?: unknown | null
  scored?: unknown | null
  workflow?: unknown | null
  diff?: unknown | null
  error_message?: string | null
  created_by?: string | null
  created_at: string
  queued_at?: string | null
  claimed_at?: string | null
  claim_token?: string | null
  worker_id?: string | null
  cancel_requested_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  promoted_at?: string | null
  execution_mode?: UnderwritingRunExecutionMode
  input_document_count?: number | null
  input_total_bytes?: number | null
  progress_message?: string | null
  progress_step?: string | null
  retry_count?: number
  last_error_at?: string | null
  is_current: boolean
}

export interface UnderwritingRunSummary {
  id: string
  deal_id: string
  run_number: number
  run_type: UnderwritingRunType
  status: UnderwritingRunStatus
  trigger: UnderwritingRunTrigger
  base_run_id?: string | null
  created_at: string
  queued_at?: string | null
  claimed_at?: string | null
  worker_id?: string | null
  cancel_requested_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  promoted_at?: string | null
  is_current: boolean
  error_message?: string | null
  input_source_count?: number
  input_diligence_document_count?: number
  input_document_count?: number | null
  input_total_bytes?: number | null
  progress_message?: string | null
  progress_step?: string | null
  execution_mode?: UnderwritingRunExecutionMode
  retry_count?: number
  last_error_at?: string | null
  total_score: number | null
  valuation_gate_status: string | null
  recommendation: string | null
}

export interface RunDiff {
  resolved_blockers?: unknown[]
  new_blockers?: unknown[]
  changed_facts?: unknown[]
  changed_confidence?: unknown[]
  valuation_gate_change?: Record<string, unknown>
  recommendation_change?: Record<string, unknown>
  score_change?: Record<string, unknown>
  missing_fields_change?: Record<string, unknown>
  checklist_changes?: Record<string, unknown>
  warnings?: string[]
}

export interface ReunderwriteRequest {
  base_run_id?: string
  diligence_document_ids?: string[]
  source_document_ids?: string[]
  allow_rejected_items?: boolean
  execution_mode?: 'async' | 'sync'
}

export interface ReunderwriteResponse {
  status?: UnderwritingRunStatus
  run_id?: string
  message?: string
  run: UnderwritingRun
}

export interface RetainedSourceFile {
  original_storage_path?: string | null
  retained_storage_path: string
  filename: string
  content_type?: string | null
  file_size?: number | null
}

export interface DealSourceDocument {
  id: string
  deal_id: string
  run_id?: string | null
  filename: string
  content_type?: string | null
  file_size?: number | null
  source_kind: 'initial_upload' | 'retained_pipeline_source' | 'manual_source_upload' | string
  retained_storage_path: string
  created_at: string
}
