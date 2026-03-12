// ─────────────────────────────────────────────────────────────────────────────
// Acquira — Scored Deal Types (v2, full 17-dimension system)
// ─────────────────────────────────────────────────────────────────────────────

import type { ExtractedDeal } from './extracted'

// ─── Dimension IDs ────────────────────────────────────────────────────────────

export type DimensionId =
  | 'occupancy_demand'
  | 'revenue_pricing'
  | 'staffing_resilience'
  | 'profitability_cashflow'
  | 'lease_economics'
  | 'regulatory_quality'
  | 'market_position'
  | 'management_systems'
  | 'valuation_structure'
  | 'upside_levers'
  | 'ccs_risk'
  | 'lease_tail'
  | 'capex_liability'
  | 'staff_qualification_mix'
  | 'fee_benchmarking'
  | 'operator_quality'
  | 'enrolment_trend'

// ─── Base dimension ───────────────────────────────────────────────────────────

export interface BaseDimension {
  score: number
  weight?: number
  label: string
  summary: string
  data_used: string[]
}

// ─── Sprint 3 dimensions with detail blocks ───────────────────────────────────

export interface CCSRiskDimension extends BaseDimension {
  detail: {
    estimated_ccs_dependent_pct: number | null
    activity_test_exposure: 'low' | 'medium' | 'high' | 'unknown'
    subsidy_cliff_note: string
  }
}

export interface LeaseTailDimension extends BaseDimension {
  detail: {
    years_remaining: number | null
    options_available: number | null
    option_years_each: number | null
    total_potential_tenure: number | null
    landlord_obligations_noted: boolean | null
  }
}

export interface CapexDimension extends BaseDimension {
  detail: {
    fit_out_age_years: number | null
    capex_mentioned_in_im: boolean
    estimated_capex_risk: 'low' | 'medium' | 'high' | 'unknown'
    notes: string
  }
}

export interface StaffQualificationDimension extends BaseDimension {
  detail: {
    degree_qualified_pct: number | null
    certificate_pct: number | null
    diploma_pct: number | null
    wage_trajectory_risk: 'low' | 'medium' | 'high' | 'unknown'
  }
}

export interface FeeBenchmarkingDimension extends BaseDimension {
  detail: {
    centre_daily_fee: number | null
    suburb_median_fee: number | null
    fee_position: 'below_market' | 'at_market' | 'above_market' | 'unknown'
    pricing_power_note: string
  }
}

export interface OperatorQualityDimension extends BaseDimension {
  detail: {
    nqs_rating: 'Exceeding NQS' | 'Meeting NQS' | 'Working Towards NQS' | 'Significant Improvement Required' | 'unknown'
    last_assessment_date: string | null
    months_since_assessment: number | null
    exceeding_areas_count: number | null
    active_conditions: boolean | null
    active_notices: boolean | null
    compliance_note: string
  }
}

export interface EnrolmentTrendDimension extends BaseDimension {
  detail: {
    current_occupancy_pct: number | null
    trend_direction: 'improving' | 'stable' | 'declining' | 'unknown'
    waitlist_depth: 'strong' | 'moderate' | 'none' | 'unknown'
    occupancy_snapshot_date: string | null
    trend_note: string
  }
}

// ─── Deal-breaker flags ───────────────────────────────────────────────────────

export type DealBreakerFlagId =
  | 'occupancy_critical'
  | 'occupancy_warning'
  | 'rent_ratio_danger'
  | 'labour_ratio_danger'
  | 'ebitda_negative'
  | 'lease_short_no_options'
  | 'lease_short_with_options'
  | 'owner_operator_dependency'
  | 'nqs_working_towards'
  | 'capex_high'
  | 'ccs_exposure_high'
  | 'valuation_premium'

export interface DealBreakerFlag {
  id: DealBreakerFlagId | string
  triggered: boolean
  severity: 'critical' | 'high'
  label: string
  reason: string
}

// ─── Audit trail ──────────────────────────────────────────────────────────────

export interface AuditTrail {
  weights_applied?: Record<string, number>
  fields_missing: string[]
  confidence: 'high' | 'medium' | 'low'
  confidence_note: string
  conditionals?: Conditional[]
}

// ─── Conditionals ─────────────────────────────────────────────────────────────

export interface Conditional {
  id?: string
  dimension: DimensionId | string
  description: string
  score_impact: string
  resolved?: boolean
  resolved_at?: string
  resolved_by?: string
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

export interface Verdict {
  category: 'passive_hold' | 'turnaround' | 'distressed' | 'pass'
  one_liner: string
  recommended_buyer_profile: string
}

// ─── ScoredDeal ───────────────────────────────────────────────────────────────

export interface ScoredDeal {
  // Metadata
  scoring_version: string
  scoring_timestamp: string       // ISO 8601 — guard before passing to Date()
  scoring_model?: string
  had_overrides?: boolean

  // Identity
  centre_name: string

  // Score
  total_score: number             // 0–100, server-calculated
  overall_score?: number          // legacy alias — some frontend refs may use this

  // Legacy v1 fields — kept for backward compat with existing frontend components
  overall_verdict?: string
  hard_flags_triggered?: string[]
  score_capped?: boolean
  score_cap_reason?: string
  analyst_summary?: string
  conditionals?: Conditional[]

  // Dimensions
  dimensions: {
    occupancy_demand:        BaseDimension
    revenue_pricing:         BaseDimension
    staffing_resilience:     BaseDimension
    profitability_cashflow:  BaseDimension
    lease_economics:         BaseDimension
    regulatory_quality:      BaseDimension
    market_position:         BaseDimension
    management_systems:      BaseDimension
    valuation_structure:     BaseDimension
    upside_levers:           BaseDimension
    ccs_risk:                CCSRiskDimension
    lease_tail:              LeaseTailDimension
    capex_liability:         CapexDimension
    staff_qualification_mix: StaffQualificationDimension
    fee_benchmarking:        FeeBenchmarkingDimension
    operator_quality:        OperatorQualityDimension
    enrolment_trend:         EnrolmentTrendDimension
  }

  // Deal-breaker flags
  deal_breaker_flags?: {
    any_triggered: boolean
    flags: DealBreakerFlag[]
  }

  // Audit trail
  audit_trail?: AuditTrail

  // Verdict
  verdict?: Verdict
}

// ─── Deal record (Supabase) ───────────────────────────────────────────────────

export interface Deal {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  org_id?: string | null
  centre_name: string
  address: string
  state: string
  status: 'processing' | 'scored' | 'error'
  extracted: ExtractedDeal | null
  scored: ScoredDeal | null
  confirmed_overrides: Record<string, unknown>
  file_urls: string[]
  source_type: string
  pipeline_version: string
  error_message?: string | null
}
