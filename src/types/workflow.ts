export type WorkflowConfidence = 'high' | 'medium' | 'low' | 'missing'
export type WorkflowFactStatus = 'extracted' | 'needs_review' | 'confirmed' | 'overridden'
export type ValuationGateStatus = 'pass' | 'blocked' | 'needs_review'
export type MarketAuditConfidence = 'high' | 'medium' | 'low'
export type MarketAuditInterpretation = 'undersupplied' | 'balanced' | 'oversupplied' | 'unknown'
export type PipelineProjectStatus = 'lodged' | 'approved' | 'under_construction' | 'opened' | 'refused' | 'withdrawn' | 'unknown'
export type PipelineSourceType = 'none' | 'manual_structured' | 'manual_legacy_count' | 'uploaded_document' | 'planningalerts' | 'state_api' | 'council_portal' | 'search_assisted'
export type CompetitorSupplySource = 'geospatial_supabase' | 'postcode_fallback' | 'unavailable'

export interface EvidenceSource {
  label: string | null
  page?: number | null
  sheet?: string | null
  row_label?: string | null
  excerpt?: string | null
  evidence_id?: string | null
  local_evidence_id?: string | null
  run_id?: string | null
  run_evidence_id?: string | null
}

export interface WorkflowFact {
  id: string
  field: string
  category: 'centre' | 'fees' | 'occupancy' | 'financials' | 'lease' | 'staffing' | 'regulatory' | 'valuation' | 'other'
  label: string
  value: string | number | boolean | null
  unit?: 'aud' | 'percent' | 'places' | 'date' | 'multiple' | null
  normalized_value?: string | number | boolean | null
  source: EvidenceSource
  source_label?: string
  confidence: WorkflowConfidence
  status: WorkflowFactStatus
  blocker?: boolean
  extraction_method?: string
  evidence_id?: string
  local_evidence_id?: string | null
  run_id?: string | null
  run_evidence_id?: string | null
}

export interface ValuationBlocker {
  field: string
  reason: string
  required_evidence: string
}

export interface ValuationGate {
  status: ValuationGateStatus
  reason: string
  message: string
  valuation_label: 'evidence_supported' | 'illustrative_only'
  can_show_confident_valuation: boolean
  required_evidence: {
    revenue: boolean
    ebitda: boolean
    payroll_labour_cost: boolean
    occupancy_history: boolean
  }
  blockers: ValuationBlocker[]
  warnings: string[]
}

export interface DiligenceItem {
  id: string
  category: string
  question: string
  request?: string
  why_it_matters?: string
  priority: 'high' | 'medium' | 'low'
  status: 'not_requested' | 'requested' | 'received' | 'verified' | 'waived' | 'rejected'
  source: string
  linked_fact_ids?: string[]
  linked_evidence_ids?: string[]
  linked_fields?: string[]
}

export interface ExtractionWarning {
  id: string
  severity: 'info' | 'warning' | 'high' | 'critical'
  message: string
  field?: string
}

export interface WorkflowEvidence {
  id: string
  fact_id?: string
  field: string
  source_label: string
  source?: EvidenceSource
  excerpt?: string | null
  confidence: WorkflowConfidence
  extraction_method?: string
  local_evidence_id?: string | null
  run_id?: string | null
  run_evidence_id?: string | null
}

export interface MarketAudit {
  catchment_radius_km?: number | null
  radius_reason?: string | null
  kids_0_4?: {
    value?: number | null
    source?: string | null
    year?: number | null
    confidence?: MarketAuditConfidence | null
  }
  ldc_utilisation_rate?: {
    value?: number | null
    source?: string | null
    rationale?: string | null
  }
  licensed_places?: {
    value?: number | null
    source?: string | null
    included_centres?: number | null
  }
  competitor_count?: {
    value?: number | null
    source?: string | null
  }
  competitor_supply?: {
    source?: CompetitorSupplySource | string | null
    confidence?: MarketAuditConfidence | null
    radius_km?: number | null
    competitor_count?: number | null
    total_licensed_places?: number | null
    target_geocode_method?: 'provided_coordinates' | 'supabase_match' | 'google' | 'postcode_fallback' | 'none' | string | null
    exclusion_method?: string | null
    scoring_source?: CompetitorSupplySource | string | null
    scoring_confidence?: MarketAuditConfidence | null
    compared_to_postcode?: {
      competitor_count?: number | null
      total_licensed_places?: number | null
      edr?: number | null
    }
    material_difference?: boolean
    warnings?: string[]
  }
  pipeline_places?: {
    value?: number | null
    source?: string | null
    confidence?: MarketAuditConfidence | null
    approved_places?: number | null
    lodged_places?: number | null
    risk_adjusted_places?: number | null
    search_required?: boolean | null
  }
  edr?: {
    value?: number | null
    formula?: string | null
    interpretation?: MarketAuditInterpretation | null
  }
  warnings?: string[]
}

export interface PipelineProject {
  id: string
  name?: string | null
  address?: string | null
  distance_km?: number | null
  status: PipelineProjectStatus
  proposed_places?: number | null
  source_url?: string | null
  source_file?: string | null
  source_date?: string | null
  confidence?: MarketAuditConfidence | null
  notes?: string | null
  source_type?: PipelineSourceType | string | null
}

export interface PipelineAudit {
  source_type: PipelineSourceType | string
  searched: boolean
  search_required: boolean
  search_radius_km?: number | null
  approved_places: number
  lodged_places: number
  risk_adjusted_places: number
  confidence: MarketAuditConfidence
  warnings: string[]
  lodged_weight?: number | null
}

export interface NarrativeGuard {
  recommendation?: string | null
  analyst_summary?: string | null
  valuation_note?: string | null
  pipeline_note?: string | null
  utilisation_note?: string | null
  market_note?: string | null
  can_use_legacy_valuation_language?: boolean
  legacy_may_conflict?: boolean
  replacement_reasons?: string[]
  warnings?: string[]
}

export interface DealWorkflow {
  run_id?: string | null
  base_run_id?: string | null
  deal_summary?: Record<string, unknown>
  facts: WorkflowFact[]
  extracted_facts?: WorkflowFact[]
  missing_fields: string[]
  risks: Array<{
    id: string
    title: string
    severity: string
    reason?: string | null
    source?: string
  }>
  valuation_gate: ValuationGate
  diligence_checklist: DiligenceItem[]
  diligence_requests?: DiligenceItem[]
  extraction_warnings: ExtractionWarning[]
  evidence: WorkflowEvidence[]
  narrative_guard?: NarrativeGuard | null
  market_audit?: MarketAudit | null
  pipeline_projects?: PipelineProject[]
  pipeline_audit?: PipelineAudit | null
}
