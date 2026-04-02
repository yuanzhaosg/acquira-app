/**
 * valuationEngine.ts — Acquira Investment Committee Valuation Engine
 *
 * Converts market demand data + centre specifics into forward earnings,
 * valuation range, scenario analysis, and absorption modelling.
 *
 * Python is authoritative for market scoring (demand_service.py).
 * This file is authoritative for financial modelling.
 *
 * Data sources:
 *   - Participation rates: DoE CCS Quarterly Report March 2024
 *   - Operating days: 260 (52 weeks × 5 days, standard LDC)
 *   - Multiple ranges: CBRE/JLL childcare transaction data 2023–2024
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ValuationInputs {
  // Demand (from demand_context / map-data)
  kids_0_to_4: number                // ABS 2021 Census, catchment-adjusted
  total_licensed_places: number      // ACECQA, catchment total
  pipeline_approved_places: number   // approved DA places in catchment
  pipeline_lodged_places: number     // lodged DA places in catchment

  // Centre specifics (from IM / extraction)
  centre_licensed_places: number
  centre_current_occupancy?: number  // 0–1, from IM (e.g. 0.71)
  centre_avg_daily_fee?: number      // AUD, from IM (default: 155)
  centre_asking_price?: number       // AUD, for return calcs

  // Market type (drives participation rate & margin assumptions)
  is_regional?: boolean

  // Optional overrides (advanced users)
  participation_rate_override?: number
  margin_override?: number
  growth_rate_override?: number
  // From demand_context.growth_factor (ABS corridor-specific, e.g. 1.18 outer VIC)
  // Pass as a factor (e.g. 1.04), engine converts to rate (0.04)
  demand_growth_factor?: number
  // Actual IM data — anchors base scenario when available
  actual_ebitda?: number
  actual_revenue?: number
  // Acquira 17-dimension score — used to align recommendation
  acquira_score?: number
}

export interface ScenarioOutput {
  label: 'Upside' | 'Base' | 'Downside'
  participation_rate: number
  avg_daily_fee: number
  margin: number
  effective_kids: number
  base_occupancy: number       // current catchment supply, no pipeline
  stabilised_occupancy: number // after pipeline absorbed
  annual_revenue: number
  ebitda: number
  ebitda_margin_pct: number
  valuation_multiple: number
  valuation_point: number
  valuation_low: number
  valuation_high: number
  cash_on_cash_return: number | null  // unlevered, null if no asking price
  risk_flags: string[]
}

export interface PipelineModel {
  risk_adjusted_places: number   // approved×1.0 + lodged×0.5
  supply_shock_pct: number       // risk_adjusted / existing_supply
  annual_demand_growth: number
  years_to_absorb: number
  risk_level: 'low' | 'moderate' | 'high'
}

export interface ICValuationResult {
  inputs_used: {
    participation_rate: number
    avg_daily_fee: number
    margin: number
    growth_rate: number
    is_regional: boolean
  }
  pipeline: PipelineModel
  scenarios: {
    upside: ScenarioOutput
    base: ScenarioOutput
    downside: ScenarioOutput
  }
  sensitivity: SensitivityCell[][]  // [fee_delta_rows][occ_delta_cols]
  recommendation: 'proceed' | 'proceed_with_caution' | 'do_not_proceed'
  recommendation_rationale: string
}

export interface SensitivityCell {
  fee_delta: number     // e.g. -0.10 = -10%
  occ_delta: number
  ebitda: number
  valuation: number
  multiple: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

// LDC participation rates by market type
// Source: DoE CCS Quarterly Report March 2024
const PARTICIPATION = {
  metro:    { low: 0.40, mid: 0.475, high: 0.55 },
  regional: { low: 0.35, mid: 0.40,  high: 0.45 },
}

// EBITDA margin benchmarks
// Source: CBRE childcare sector report 2024
const MARGINS = {
  metro:    { upside: 0.27, base: 0.23, downside: 0.18 },
  regional: { upside: 0.24, base: 0.20, downside: 0.15 },
}

// EBITDA multiples — calibrated to Australian childcare transactions 2022–2024
// Source: JLL, CBRE, Burgess Rawson auction results
const MULTIPLES = {
  premium:  { point: 7.2, low: 6.8, high: 7.5 },  // occ >90%, pipeline <2yr
  strong:   { point: 6.5, low: 6.0, high: 7.0 },  // occ >85%, pipeline <3yr
  average:  { point: 6.0, low: 5.5, high: 6.5 },  // occ >80%
  soft:     { point: 5.5, low: 5.0, high: 6.0 },  // occ >75%
  distressed:{ point: 5.0, low: 4.5, high: 5.5 }, // occ <75%
}

const OPERATING_DAYS = 260  // 52 weeks × 5 days
const DEFAULT_FEE_METRO    = 155  // AUD/day
const DEFAULT_FEE_REGIONAL = 130  // AUD/day

// ── Helpers ────────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function getMultiple(occupancy: number, yearsToAbsorb: number) {
  if (occupancy > 0.90 && yearsToAbsorb < 2) return MULTIPLES.premium
  if (occupancy > 0.85 && yearsToAbsorb < 3) return MULTIPLES.strong
  if (occupancy > 0.80) return MULTIPLES.average
  if (occupancy > 0.75) return MULTIPLES.soft
  return MULTIPLES.distressed
}

function computePipeline(
  approvedPlaces: number,
  lodgedPlaces: number,
  existingSupply: number,
  effectiveKids: number,
  growthRate: number,
): PipelineModel {
  const riskAdjusted = approvedPlaces * 1.0 + lodgedPlaces * 0.5
  const supplyShockPct = existingSupply > 0 ? riskAdjusted / existingSupply : 0
  const annualDemandGrowth = effectiveKids * growthRate
  const yearsToAbsorb = annualDemandGrowth > 0
    ? riskAdjusted / annualDemandGrowth
    : riskAdjusted > 0 ? 99 : 0

  return {
    risk_adjusted_places: Math.round(riskAdjusted),
    supply_shock_pct: parseFloat((supplyShockPct * 100).toFixed(1)),
    annual_demand_growth: Math.round(annualDemandGrowth),
    years_to_absorb: parseFloat(yearsToAbsorb.toFixed(1)),
    risk_level: yearsToAbsorb < 2 ? 'low' : yearsToAbsorb < 4 ? 'moderate' : 'high',
  }
}

function computeScenario(
  label: 'Upside' | 'Base' | 'Downside',
  inputs: ValuationInputs,
  participationRate: number,
  avgDailyFee: number,
  margin: number,
  pipeline: PipelineModel,
  growthRate: number,
): ScenarioOutput {
  const effectiveKids = inputs.kids_0_to_4 * participationRate

  // Base occupancy: current supply only
  const baseOcc = clamp(effectiveKids / inputs.total_licensed_places, 0.30, 0.98)

  // Future supply: existing + risk-adjusted pipeline
  const futureSupply = inputs.total_licensed_places + pipeline.risk_adjusted_places

  // Stabilised occupancy: after pipeline absorbed
  // Downside stresses pipeline by adding 30% more approved supply
  const pipelineMultiplier = label === 'Downside' ? 1.30 : 1.0
  const stressedFutureSupply = inputs.total_licensed_places
    + pipeline.risk_adjusted_places * pipelineMultiplier
  const futureOccRaw = stressedFutureSupply > 0
    ? effectiveKids / stressedFutureSupply
    : 0.70
  const stabilisedOcc = clamp(futureOccRaw, 0.55, 0.98)

  // Revenue: stabilised occupancy × places × fee × operating days
  // Note: no separate utilisation multiplier — stabilised_occ already IS utilisation
  const modelledRevenue = stabilisedOcc * inputs.centre_licensed_places * avgDailyFee * OPERATING_DAYS

  // Anchor base scenario to actual IM data when available
  // Upside/downside scale from actual using scenario multipliers
  let annualRevenue: number
  let ebitda: number
  if (inputs.actual_ebitda && inputs.actual_revenue && label === 'Base') {
    annualRevenue = inputs.actual_revenue
    ebitda = inputs.actual_ebitda
  } else if (inputs.actual_ebitda && label === 'Upside') {
    annualRevenue = modelledRevenue
    ebitda = inputs.actual_ebitda * (1 + (margin - (inputs.margin_override ?? margin)) + 0.04)
  } else if (inputs.actual_ebitda && label === 'Downside') {
    annualRevenue = modelledRevenue
    ebitda = inputs.actual_ebitda * 0.75  // 25% EBITDA compression in downside
  } else {
    annualRevenue = modelledRevenue
    ebitda = annualRevenue * margin
  }
  const ebitdaMarginPct = parseFloat((margin * 100).toFixed(1))

  const multiples = getMultiple(stabilisedOcc, pipeline.years_to_absorb)

  const valuationPoint = ebitda * multiples.point
  const valuationLow   = ebitda * multiples.low
  const valuationHigh  = ebitda * multiples.high

  // Unlevered cash-on-cash return (5yr hold, ~3% annual EBITDA growth)
  let cashOnCash: number | null = null
  if (inputs.centre_asking_price && inputs.centre_asking_price > 0) {
    const exitEbitda = ebitda * Math.pow(1 + growthRate, 5)
    const exitValue = exitEbitda * multiples.point
    cashOnCash = parseFloat(((exitValue / inputs.centre_asking_price - 1) * 100).toFixed(1))
  }

  // Risk flags
  const riskFlags: string[] = []
  if (stabilisedOcc < 0.75) riskFlags.push('Occupancy below 75% threshold')
  if (pipeline.years_to_absorb > 4) riskFlags.push(`Pipeline takes ${pipeline.years_to_absorb}yr to absorb (high risk)`)
  if (pipeline.supply_shock_pct > 50) riskFlags.push(`Supply shock: +${pipeline.supply_shock_pct}% new places`)
  if (margin < 0.18) riskFlags.push('EBITDA margin below 18% — limited buffer')

  return {
    label,
    participation_rate: participationRate,
    avg_daily_fee: avgDailyFee,
    margin,
    effective_kids: Math.round(effectiveKids),
    base_occupancy: parseFloat((baseOcc * 100).toFixed(1)),
    stabilised_occupancy: parseFloat((stabilisedOcc * 100).toFixed(1)),
    annual_revenue: Math.round(annualRevenue),
    ebitda: Math.round(ebitda),
    ebitda_margin_pct: ebitdaMarginPct,
    valuation_multiple: multiples.point,
    valuation_point: Math.round(valuationPoint),
    valuation_low: Math.round(valuationLow),
    valuation_high: Math.round(valuationHigh),
    cash_on_cash_return: cashOnCash,
    risk_flags: riskFlags,
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

export function calculateICValuation(inputs: ValuationInputs): ICValuationResult {
  const isRegional = inputs.is_regional ?? false
  // Use corridor-specific ABS growth factor from demand_context if available
  // demand_context.growth_factor is a multiplier (e.g. 1.04 = 4%/yr, 1.18 = 18% over census period ~5yr)
  // Convert 5yr census factor to annual: (factor^(1/5)) - 1
  // Inner metro VIC (1.04) → 0.8%/yr | Growth corridor (1.18) → 3.4%/yr
  let growthRate: number
  if (inputs.growth_rate_override != null) {
    growthRate = inputs.growth_rate_override
  } else if (inputs.demand_growth_factor != null && inputs.demand_growth_factor > 1) {
    // Convert census-period factor to annual compound rate
    growthRate = parseFloat((Math.pow(inputs.demand_growth_factor, 1 / 5) - 1).toFixed(4))
  } else {
    // Fallback: ABS national average for 0-4 cohort
    growthRate = inputs.is_regional ? 0.010 : 0.008
  }
  const participation = inputs.participation_rate_override
    ?? (isRegional ? PARTICIPATION.regional.mid : PARTICIPATION.metro.mid)
  const defaultFee = isRegional ? DEFAULT_FEE_REGIONAL : DEFAULT_FEE_METRO
  const avgFee = inputs.centre_avg_daily_fee ?? defaultFee
  const margins = isRegional ? MARGINS.regional : MARGINS.metro
  const baseMargin = inputs.margin_override ?? margins.base

  // Base effective kids (for pipeline model)
  const baseEffectiveKids = inputs.kids_0_to_4 * participation
  const pipeline = computePipeline(
    inputs.pipeline_approved_places,
    inputs.pipeline_lodged_places,
    inputs.total_licensed_places,
    baseEffectiveKids,
    growthRate,
  )

  // ── Three scenarios ──────────────────────────────────────────────────────
  const upside = computeScenario(
    'Upside',
    inputs,
    isRegional ? PARTICIPATION.regional.high : PARTICIPATION.metro.high,
    avgFee * 1.05,
    margins.upside,
    pipeline,
    growthRate,
  )

  const base = computeScenario(
    'Base',
    inputs,
    participation,
    avgFee,
    baseMargin,
    pipeline,
    growthRate,
  )

  const downside = computeScenario(
    'Downside',
    inputs,
    isRegional ? PARTICIPATION.regional.low : PARTICIPATION.metro.low,
    avgFee * 0.95,
    margins.downside,
    pipeline,
    growthRate,
  )

  // ── Sensitivity grid (3×3: fee ±10%, occupancy ±10%) ────────────────────
  const feeDeltas  = [-0.10, 0, 0.10]
  const occDeltas  = [-0.10, 0, 0.10]
  const sensitivity: SensitivityCell[][] = feeDeltas.map(fd =>
    occDeltas.map(od => {
      const fee = avgFee * (1 + fd)
      const occ = clamp(base.stabilised_occupancy / 100 * (1 + od), 0.40, 0.98)
      const rev = occ * inputs.centre_licensed_places * fee * OPERATING_DAYS
      const ebitda = rev * baseMargin
      const mult = getMultiple(occ, pipeline.years_to_absorb)
      return {
        fee_delta: fd,
        occ_delta: od,
        ebitda: Math.round(ebitda),
        valuation: Math.round(ebitda * mult.point),
        multiple: mult.point,
      }
    })
  )

  // ── Recommendation ───────────────────────────────────────────────────────
  let recommendation: ICValuationResult['recommendation']
  let rationale: string

  const absYears = pipeline.years_to_absorb
  const baseOcc  = base.stabilised_occupancy
  const score    = inputs.acquira_score
  const fv = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}m` : `$${(n/1_000).toFixed(0)}k`

  // Recommendation aligned with Acquira 17-dim score when available
  if (score != null) {
    if (score >= 62 && absYears < 4) {
      recommendation = 'proceed'
      rationale = `Acquira score ${score.toFixed(0)}/100 (Attractive+). `
        + `Pipeline absorbs in ${absYears < 99 ? absYears + 'yr' : 'unknown time'}. `
        + `Base valuation ${fv(base.valuation_point)} at ${base.valuation_multiple}× EBITDA.`
    } else if (score >= 52 || absYears < 5) {
      recommendation = 'proceed_with_caution'
      rationale = `Acquira score ${score.toFixed(0)}/100 (Worth Investigating). `
        + (absYears >= 3 && absYears < 99 ? `Pipeline takes ${absYears}yr to absorb. ` : '')
        + `Downside valuation ${fv(downside.valuation_low)} — ensure price reflects risk.`
    } else {
      recommendation = 'do_not_proceed'
      rationale = `Acquira score ${score.toFixed(0)}/100 (High Scrutiny or below). `
        + `Downside EBITDA ${fv(downside.ebitda)} with ${absYears < 99 ? absYears + 'yr' : 'extended'} pipeline absorption.`
    }
  } else {
    // Fallback: demand model only (no Acquira score)
    if (baseOcc >= 80 && absYears < 3) {
      recommendation = 'proceed'
      rationale = `Demand model: ${baseOcc}% stabilised occupancy, pipeline absorbs in ${absYears}yr. `
        + `Base valuation ${fv(base.valuation_point)} at ${base.valuation_multiple}× EBITDA.`
    } else if (baseOcc >= 70 || absYears < 4) {
      recommendation = 'proceed_with_caution'
      rationale = `Viable but risk-aware: ${baseOcc}% modelled occupancy. `
        + (absYears >= 3 && absYears < 99 ? `Pipeline takes ${absYears}yr to absorb. ` : '')
        + `Downside valuation ${fv(downside.valuation_low)} — ensure price reflects risk.`
    } else {
      recommendation = 'do_not_proceed'
      rationale = `Weak demand model: ${baseOcc}% stabilised occupancy `
        + `with ${absYears < 99 ? absYears + 'yr' : 'extended'} pipeline absorption. `
        + `Downside EBITDA ${fv(downside.ebitda)} — insufficient margin of safety.`
    }
  }

  return {
    inputs_used: {
      participation_rate: participation,
      avg_daily_fee: avgFee,
      margin: baseMargin,
      growth_rate: growthRate,
      is_regional: isRegional,
    },
    pipeline,
    scenarios: { upside, base, downside },
    sensitivity,
    recommendation,
    recommendation_rationale: rationale,
  }
}
