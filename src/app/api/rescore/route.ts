import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SCORING_SYSTEM_PROMPT } from '@/lib/prompts/scoring-v2'
import type { ScoredDeal } from '@/types/scored'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'
export const maxDuration = 60

// ─── Dimension weights (single source of truth) ──────────────────────────────
// IMPORTANT: Must sum to 1.0. Server recalculates total_score — never trust Claude's sum.
const DIMENSION_WEIGHTS: Record<string, number> = {
  occupancy_demand:        0.15,
  revenue_pricing:         0.08,
  staffing_resilience:     0.08,
  profitability_cashflow:  0.15,
  lease_economics:         0.08,
  regulatory_quality:      0.05,
  market_position:         0.07,
  management_systems:      0.06,
  valuation_structure:     0.08,
  upside_levers:           0.05,
  // ── Sprint 3 additions ──────────────────────────────────────────────────────
  ccs_risk:                0.03,
  lease_tail:              0.03,
  capex_liability:         0.02,
  staff_qualification_mix: 0.02,
  fee_benchmarking:        0.02,
  operator_quality:        0.02,
  enrolment_trend:         0.01,
}

// ─── Deal-breaker flag scaffolding ───────────────────────────────────────────
// Claude populates triggered + reason. We ensure all IDs always exist in output.
const DEFAULT_FLAGS = [
  { id: 'occupancy_critical',        severity: 'critical', label: 'Critical Occupancy (<50%)',         triggered: false, reason: '' },
  { id: 'occupancy_warning',         severity: 'high',     label: 'Low Occupancy (50–65%)',            triggered: false, reason: '' },
  { id: 'rent_ratio_danger',         severity: 'high',     label: 'Rent >15% of Revenue',             triggered: false, reason: '' },
  { id: 'labour_ratio_danger',       severity: 'high',     label: 'Labour >65% of Revenue',           triggered: false, reason: '' },
  { id: 'ebitda_negative',           severity: 'high',     label: 'Negative EBITDA',                  triggered: false, reason: '' },
  { id: 'lease_short_no_options',    severity: 'critical', label: 'Short Lease, No Options (<3yr)',    triggered: false, reason: '' },
  { id: 'lease_short_with_options',  severity: 'high',     label: 'Short Lease With Options (<3yr)',   triggered: false, reason: '' },
  { id: 'owner_operator_dependency', severity: 'high',     label: 'Owner-Operator Dependency',        triggered: false, reason: '' },
  { id: 'nqs_working_towards',       severity: 'high',     label: 'NQS: Working Towards Standard',    triggered: false, reason: '' },
  { id: 'capex_high',                severity: 'high',     label: 'High CAPEX Liability',             triggered: false, reason: '' },
  { id: 'ccs_exposure_high',         severity: 'high',     label: 'High CCS Subsidy Cliff Exposure',  triggered: false, reason: '' },
  { id: 'valuation_premium',         severity: 'high',     label: 'Premium Valuation (>4× EBITDA)',   triggered: false, reason: '' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

function buildOverrideNote(overrides: Record<string, unknown>): string {
  if (!Object.keys(overrides).length) return ''
  return `\n\nMANUAL OVERRIDES APPLIED BY ANALYST:\n${
    Object.entries(overrides).map(([k, v]) => `- ${k}: ${v}`).join('\n')
  }\nTreat these values as confirmed facts. Do not flag them as missing or uncertain.`
}

// ─── Scoring prompt ───────────────────────────────────────────────────────────
// Explicit JSON schema is critical — without it Claude invents structure and
// detail blocks (CCS, lease tail, operator quality) will be empty or missing.
function buildScoringPrompt(extracted: unknown, overrideNote: string): string {
  return `
Score this childcare centre acquisition based on the extracted data below.${overrideNote}

Return ONLY a single valid JSON object. No markdown fences, no text outside the JSON.

The JSON must conform to this exact schema (use null for unknown values, never omit keys):

{
  "centre_name": string,
  "total_score": number,

  "dimensions": {
    "occupancy_demand":        { "score": 0-10, "label": string, "summary": string, "data_used": string[] },
    "revenue_pricing":         { "score": 0-10, "label": string, "summary": string, "data_used": string[] },
    "staffing_resilience":     { "score": 0-10, "label": string, "summary": string, "data_used": string[] },
    "profitability_cashflow":  { "score": 0-10, "label": string, "summary": string, "data_used": string[] },
    "lease_economics":         { "score": 0-10, "label": string, "summary": string, "data_used": string[] },
    "regulatory_quality":      { "score": 0-10, "label": string, "summary": string, "data_used": string[] },
    "market_position":         { "score": 0-10, "label": string, "summary": string, "data_used": string[] },
    "management_systems":      { "score": 0-10, "label": string, "summary": string, "data_used": string[] },
    "valuation_structure":     { "score": 0-10, "label": string, "summary": string, "data_used": string[] },
    "upside_levers":           { "score": 0-10, "label": string, "summary": string, "data_used": string[] },

    "ccs_risk": {
      "score": 0-10,
      "label": "CCS / Subsidy Risk",
      "summary": string,
      "data_used": string[],
      "detail": {
        "estimated_ccs_dependent_pct": number | null,
        "activity_test_exposure": "low" | "medium" | "high" | "unknown",
        "subsidy_cliff_note": string
      }
    },

    "lease_tail": {
      "score": 0-10,
      "label": "Lease Tail",
      "summary": string,
      "data_used": string[],
      "detail": {
        "years_remaining": number | null,
        "options_available": number | null,
        "option_years_each": number | null,
        "total_potential_tenure": number | null,
        "landlord_obligations_noted": boolean | null
      }
    },

    "capex_liability": {
      "score": 0-10,
      "label": "Renovation / CAPEX Liability",
      "summary": string,
      "data_used": string[],
      "detail": {
        "fit_out_age_years": number | null,
        "capex_mentioned_in_im": boolean,
        "estimated_capex_risk": "low" | "medium" | "high" | "unknown",
        "notes": string
      }
    },

    "staff_qualification_mix": {
      "score": 0-10,
      "label": "Staff Qualification Mix",
      "summary": string,
      "data_used": string[],
      "detail": {
        "degree_qualified_pct": number | null,
        "certificate_pct": number | null,
        "diploma_pct": number | null,
        "wage_trajectory_risk": "low" | "medium" | "high" | "unknown"
      }
    },

    "fee_benchmarking": {
      "score": 0-10,
      "label": "Fee Benchmarking",
      "summary": string,
      "data_used": string[],
      "detail": {
        "centre_daily_fee": number | null,
        "suburb_median_fee": number | null,
        "fee_position": "below_market" | "at_market" | "above_market" | "unknown",
        "pricing_power_note": string
      }
    },

    "operator_quality": {
      "score": 0-10,
      "label": "Operator Quality Signal",
      "summary": string,
      "data_used": string[],
      "detail": {
        "nqs_rating": "Exceeding NQS" | "Meeting NQS" | "Working Towards NQS" | "Significant Improvement Required" | "unknown",
        "last_assessment_date": string | null,
        "months_since_assessment": number | null,
        "exceeding_areas_count": number | null,
        "active_conditions": boolean | null,
        "active_notices": boolean | null,
        "compliance_note": string
      }
    },

    "enrolment_trend": {
      "score": 0-10,
      "label": "Enrolment Trend & Waitlist",
      "summary": string,
      "data_used": string[],
      "detail": {
        "current_occupancy_pct": number | null,
        "trend_direction": "improving" | "stable" | "declining" | "unknown",
        "waitlist_depth": "strong" | "moderate" | "none" | "unknown",
        "occupancy_snapshot_date": string | null,
        "trend_note": string
      }
    }
  },

  "deal_breaker_flags": {
    "any_triggered": boolean,
    "flags": [
      {
        "id": string,
        "triggered": boolean,
        "severity": "critical" | "high",
        "label": string,
        "reason": string
      }
    ]
  },

  "audit_trail": {
    "fields_missing": string[],
    "confidence": "high" | "medium" | "low",
    "confidence_note": string
  },

  "verdict": {
    "category": "passive_hold" | "turnaround" | "distressed" | "pass",
    "one_liner": string,
    "recommended_buyer_profile": string
  }
}

Deal-breaker flag IDs to evaluate (set triggered: true/false based on data):
  occupancy_critical        → occupancy < 50%
  occupancy_warning         → occupancy 50–65%
  rent_ratio_danger         → rent > 15% of revenue
  labour_ratio_danger       → labour > 65% of revenue
  ebitda_negative           → EBITDA is negative or break-even
  lease_short_no_options    → < 3 years remaining with no options
  lease_short_with_options  → < 3 years remaining but options exist
  owner_operator_dependency → owner is acting director/operator with no management layer
  nqs_working_towards       → NQS rating is Working Towards NQS or below
  capex_high                → significant capex/renovation liability detected
  ccs_exposure_high         → high proportion of families on maximum CCS subsidy
  valuation_premium         → asking price > 4× stabilised EBITDA on a turnaround asset

Dimension weights (for scoring reference — do NOT include in output, server applies them):
${Object.entries(DIMENSION_WEIGHTS).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

EXTRACTED DATA:
${JSON.stringify(extracted, null, 2)}
  `.trim()
}

// ─── Server-side score recalculation ─────────────────────────────────────────
// Never trust Claude's total_score arithmetic. Always recompute from dimensions + weights.
function recalculateTotalScore(dimensions: Record<string, { score: number }>): number {
  let total = 0
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    const score = dimensions[key]?.score ?? 0
    total += clamp(score, 0, 10) * weight
  }
  // Scale 0–10 → 0–100, round to 1 decimal
  return Math.round(total * 10 * 10) / 10
}

// ─── Output hardening ─────────────────────────────────────────────────────────
// Fills gaps Claude missed, clamps out-of-range scores, stamps audit metadata.
function correctScored(scored: any): void {
  scored.dimensions = scored.dimensions || {}

  // Ensure every expected dimension exists with a valid score
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    if (!scored.dimensions[key]) {
      scored.dimensions[key] = { score: 0, weight, label: key, summary: 'Not extracted.', data_used: [] }
    } else {
      const dim = scored.dimensions[key]
      dim.score     = typeof dim.score === 'number' ? clamp(dim.score, 0, 10) : 0
      dim.weight    = weight   // always enforce server-side weight, never Claude's
      dim.label     = dim.label     || key
      dim.summary   = dim.summary   || ''
      dim.data_used = dim.data_used || []
    }
  }

  // Recalculate total score deterministically
  scored.total_score = recalculateTotalScore(scored.dimensions)

  // Merge Claude's populated flags with default scaffolding so all IDs always present
  scored.deal_breaker_flags = scored.deal_breaker_flags || { any_triggered: false, flags: [] }
  const claudeFlags: any[]  = scored.deal_breaker_flags.flags || []
  const claudeFlagIds       = new Set(claudeFlags.map((f: any) => f.id))
  scored.deal_breaker_flags.flags = [
    ...claudeFlags,
    ...DEFAULT_FLAGS.filter(f => !claudeFlagIds.has(f.id)),
  ]
  scored.deal_breaker_flags.any_triggered = scored.deal_breaker_flags.flags.some((f: any) => f.triggered)

  // Stamp weights into audit trail
  scored.audit_trail                   = scored.audit_trail || {}
  scored.audit_trail.weights_applied   = DIMENSION_WEIGHTS
  scored.audit_trail.fields_missing    = scored.audit_trail.fields_missing || []
  scored.audit_trail.confidence        = scored.audit_trail.confidence     || 'medium'
  scored.audit_trail.confidence_note   = scored.audit_trail.confidence_note || ''

  // Ensure verdict block always exists
  scored.verdict = scored.verdict || {
    category: 'pass',
    one_liner: '',
    recommended_buyer_profile: '',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { extracted, overrides = {} } = await req.json()

    const overrideNote  = buildOverrideNote(overrides as Record<string, unknown>)
    const scoringPrompt = buildScoringPrompt(extracted, overrideNote)

    // temperature: 0 — same IM always produces identical scores
    const scoringResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      temperature: 0,
      system: SCORING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: scoringPrompt }],
    })

    const rawText = scoringResponse.content[0].type === 'text'
      ? scoringResponse.content[0].text
          .replace(/:\s*\+([0-9])/g, ': $1')  // strip leading + from numbers (existing fix)
          .replace(/```(?:json)?\n?/g, '')      // strip any markdown fences
          .trim()
      : ''

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in scoring response')

    const scored: ScoredDeal = JSON.parse(jsonMatch[0])

    // Stamp metadata
    scored.scoring_timestamp = new Date().toISOString()
    scored.scoring_model     = MODEL
    scored.had_overrides     = Object.keys(overrides).length > 0

    // Harden output — correct missing/invalid fields, recalculate total score
    correctScored(scored)

    return NextResponse.json(scored)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Rescore failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
