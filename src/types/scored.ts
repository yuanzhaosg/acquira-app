// ─────────────────────────────────────────────────────────────────────────────
// Acquira — Scored Deal Types
// Output of the scoring prompt + scoring engine
// ─────────────────────────────────────────────────────────────────────────────

// Import at top — not at bottom (avoids hoisting issue)
import type { ExtractedDeal } from './extracted'

export type DimensionId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8' | 'D9' | 'D10'

export interface ScoreSignal {
  id: string
  pts: number
  reasoning: string
}

export interface ScoredDimension {
  name: string
  weight: number
  raw_score: number
  weighted_score: number
  signals: ScoreSignal[]
  summary: string
}

export interface Conditional {
  id?: string                 // optional — scoring prompt doesn't always include it
  dimension: DimensionId
  description: string
  score_impact: string
  resolved?: boolean
  resolved_at?: string
  resolved_by?: string
}

export interface ScoredDeal {
  scoring_version: string
  scoring_timestamp: string   // may be empty string "" — guard before passing to Date()
  centre_name: string
  overall_score: number
  overall_verdict: string
  hard_flags_triggered: string[]
  score_capped: boolean
  score_cap_reason: string    // may be empty string "" when not capped
  dimensions: Record<DimensionId, ScoredDimension>
  conditionals: Conditional[]
  analyst_summary: string
}

// Combined deal record as stored in Supabase
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
