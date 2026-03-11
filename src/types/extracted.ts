// ─────────────────────────────────────────────
// Acquira — Extracted Deal Data Types
// Matches the output of all extraction paths:
//   PDF IM → extraction prompt
//   ZIP data room → Excel + lease extractors
// ─────────────────────────────────────────────

export type SourceType = 'pdf_im' | 'data_room_excel_pdf' | 'zip_mixed'
export type OperatorType = 'owner_operator' | 'corporate_chain' | 'franchise' | 'unknown'
export type LeaseStatus = 'ACTIVE' | 'EXPIRED' | 'UNKNOWN'
export type RentReviewType = 'CPI' | 'Fixed %' | 'Market' | 'Mixed' | null
export type NQSRating = 'Exceeding NQS' | 'Meeting NQS' | 'Working Towards NQS' | 'Significant Improvement Required' | null

export interface ExtractionMeta {
  extraction_version: string
  extraction_date: string
  source_type: SourceType
  source_files: string[]
  data_quality: 'HIGH' | 'MEDIUM' | 'LOW'
  missing_fields_count: number
  missing_fields: string[]
  confirmed_facts?: string[]
  confirmed_overrides?: Record<string, ConfirmedOverride>
}

export interface ConfirmedOverride {
  value: unknown
  confirmed_by: string
  confirmed_at: string
  original_value: unknown
}

export interface CentreInfo {
  name: string
  trading_name?: string | null
  address: string
  suburb: string
  state: 'VIC' | 'NSW' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT'
  postcode: string
  lga?: string | null
  operator: string
  operator_type: OperatorType
  licensed_places: number | null
  licensed_places_source?: string
  nqs_rating: NQSRating
  nqs_date?: string | null
  nqs_source?: string
  service_approval_number?: string | null
  outdoor_space_waiver?: boolean
}

export interface OccupancyData {
  latest_week_label?: string
  latest_week_pct?: number | null
  avg_4wk_pct: number | null
  avg_13wk_pct?: number | null
  avg_52wk_pct?: number | null
  peak_pct: number | null
  peak_week?: string | null
  trough_pct?: number | null
  fy23_avg_pct?: number | null
  fy24_avg_pct?: number | null
  fy25_avg_pct?: number | null
  current_month_pct?: number | null   // from PDF IM path
  trend_fy23_to_fy25?: 'improving' | 'declining' | 'stable' | null
  total_weeks_data?: number
  waitlist_depth?: number | null
  waitlist_notes?: string | null
}

export interface AnnualFinancials {
  revenue: number | null
  fee_revenue?: number | null
  kinder_funding?: number | null
  total_labour_cost: number | null
  payroll_base?: number | null
  payroll_oncosts?: number | null
  agency_cost?: number | null
  rent_pa: number | null
  total_rent_property?: number | null
  depreciation?: number | null
  ebitda: number | null
  net_profit?: number | null
  labour_ratio_pct: number | null
  rent_ratio_pct: number | null
  ebitda_margin_pct: number | null
  is_provisional?: boolean
  provisional_reason?: string | null
}

export interface FinancialData {
  primary_year: string
  fy23?: AnnualFinancials
  fy24?: AnnualFinancials
  fy25?: AnnualFinancials
  fy26_ytd?: Partial<AnnualFinancials>
  ebitda_3yr_average?: number | null
  revenue_trend?: 'growing' | 'declining' | 'stable' | null
  labour_trend?: 'improving' | 'worsening' | 'stable' | null
  asking_price?: number | null
  asking_price_ebitda_multiple?: number | null
  asking_price_per_place?: number | null
  vendor_excess_wages_claim?: number | null
  addbacks_total?: number | null
  normalised_ebitda?: number | null
  data_quality_notes?: string[]
}

export interface LeaseData {
  commencement_date: string | null
  expiry_date: string | null
  expiry_date_source?: string
  days_remaining?: number
  status: LeaseStatus
  term_years: number | null
  options: string | null
  option_exercise_deadline?: string | null
  option_status?: string
  option_exercise_detail?: string
  remaining_term_years?: number | null
  new_expiry_approx?: string | null
  base_rent_pa_original?: number | null
  base_rent_pa_fy25?: number | null
  rent_review_type: RentReviewType
  rent_review_detail: string | null
  turnover_rent_clause: boolean | null
  turnover_rent_detail?: string | null
  assignment_clause: string | null
  demolition_redevelopment_clause: boolean | null
  demolition_clause_detail?: string | null
  make_good_obligations: string | null
  outgoings_type: string | null
  permitted_use: string | null
  lessor: string | null
  lessee: string | null
  premises?: string | null
  security_deposit_note?: string | null
  covid_variation_note?: string | null
  extraction_notes?: string | null
}

export interface HardFlag {
  id: string
  severity: 'critical' | 'warning'
  dimension: string
  description: string
}

export interface KeyRatios {
  occupancy_latest_4wk_pct: number | null
  occupancy_fy25_avg_pct?: number | null
  occupancy_peak_pct: number | null
  revenue_fy25: number | null
  ebitda_fy25: number | null
  ebitda_margin_fy25_pct: number | null
  labour_ratio_fy25_pct: number | null
  rent_ratio_fy25_pct: number | null
  ebitda_3yr_avg: number | null
  rent_pa_fy25: number | null
  licensed_places: number | null
  revenue_per_place_fy25?: number | null
  ebitda_per_place_fy25?: number | null
  asking_price?: number | null
  ebitda_multiple?: number | null
}

export interface ExtractedDeal {
  meta: ExtractionMeta
  centre: CentreInfo
  occupancy: OccupancyData
  financials: FinancialData
  lease: LeaseData
  hard_flags: HardFlag[]
  key_ratios: KeyRatios
  anomalies?: string[]
}
