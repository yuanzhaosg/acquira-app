export type DiligenceStatus =
  | 'not_requested'
  | 'requested'
  | 'received'
  | 'verified'
  | 'waived'
  | 'rejected'

export type DiligencePriority = 'high' | 'medium' | 'low'

export interface DiligenceItem {
  id: string
  deal_id: string
  workflow_item_id?: string | null
  category: string
  question: string
  request?: string | null
  why_it_matters?: string | null
  priority: DiligencePriority
  status: DiligenceStatus
  owner?: string | null
  due_date?: string | null
  linked_fact_ids?: string[]
  linked_evidence_ids?: string[]
  linked_document_ids?: string[]
  notes?: string | null
  waiver_reason?: string | null
  rejection_reason?: string | null
  created_at?: string
  updated_at?: string
}

export type DiligenceExtractionStatus = 'uploaded' | 'processing' | 'processed' | 'failed'

export interface DiligenceDocument {
  id: string
  deal_id: string
  uploaded_by?: string | null
  storage_path: string
  filename: string
  mime_type?: string | null
  file_size?: number | null
  document_type?: string | null
  source_item_id?: string | null
  extraction_status: DiligenceExtractionStatus
  metadata?: Record<string, unknown> | null
  created_at?: string
  processed_at?: string | null
}

export interface EvidenceLink {
  id: string
  deal_id: string
  diligence_item_id?: string | null
  document_id?: string | null
  fact_id?: string | null
  evidence_id?: string | null
  run_id?: string | null
  link_type?: string | null
  notes?: string | null
  created_at?: string
}

export interface DiligenceItemsResponse {
  items: DiligenceItem[]
  seeded?: boolean
}
