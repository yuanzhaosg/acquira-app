export type EvidenceRequestType =
  | 'valuation_blocker'
  | 'diligence_item'
  | 'market_gap'
  | 'pipeline_gap'
  | 'other'

export type EvidenceRequestStatus = 'draft' | 'sent' | 'received' | 'waived' | 'closed'
export type EvidenceRequestPriority = 'high' | 'medium' | 'low'

export interface EvidenceRequest {
  id: string
  deal_id: string
  run_id?: string | null
  diligence_item_id?: string | null
  request_type: EvidenceRequestType
  title: string
  body: string
  status: EvidenceRequestStatus
  priority: EvidenceRequestPriority
  requested_from?: string | null
  requested_at?: string | null
  due_date?: string | null
  copied_to_clipboard_at?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  linked_document_ids?: string[]
  linked_document_count?: number
  linked_documents?: EvidenceRequestDocumentSummary[]
}

export interface EvidenceRequestDraft {
  run_id?: string | null
  diligence_item_id?: string | null
  request_type: EvidenceRequestType
  title: string
  body: string
  priority: EvidenceRequestPriority
  requested_from?: string | null
  due_date?: string | null
}

export type EvidenceRequestSuggestion = EvidenceRequestDraft & {
  id: string
  source_label: string
}

export interface EvidenceRequestDocumentSummary {
  id: string
  filename: string
  document_type?: string | null
  created_at?: string | null
  file_size?: number | null
}
