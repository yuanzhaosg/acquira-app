// valuationMultiple.ts — leasehold business-sale multiple (frontend port).
// Mirrors acquira-api/valuation_multiple.py. Leasehold going-concern ONLY;
// freehold is intentionally out of scope (valued on a yield, not a multiple).
//
// Comp set: single leasehold centre, adjusted EBITDA, 3.0x–5.0x.
// Sources (2025–26): Benchmark Business S&V, Miro Capital, ChildcareLink,
// Business-Sales.info. Last reviewed 2026-06-02; re-validate every 6 months.

export const COMP_BAND = { floor: 3.0, ceiling: 5.0 }
export const COMP_LAST_REVIEWED = '2026-06-02'
const COMP_MIDPOINT = (COMP_BAND.floor + COMP_BAND.ceiling) / 2 // 4.0

export type FactorDirection = 'up' | 'down' | 'neutral'
export interface MultipleFactor {
  name: string
  delta: number
  direction: FactorDirection
  rationale: string
}

export interface LeaseholdInputs {
  licensedPlaces?: number | null
  occupancyPct?: number | null
  occupancyDeclining?: boolean | null
  nqsRating?: string | null            // 'Exceeding NQS' | 'Meeting NQS' | 'Working Towards NQS' | ...
  leaseYearsRemaining?: number | null
  leaseOptionsYears?: number | null
  ownerOperated?: boolean | null
  rentToRevenuePct?: number | null
  growthCorridor?: boolean | null
}

export interface MultipleResult {
  band: [number, number]
  midpoint: number
  netDelta: number
  recommended: { low: number; mid: number; high: number }
  factors: MultipleFactor[]
  interpretation: string
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)
const round2 = (n: number) => Math.round(n * 100) / 100

function fSize(p?: number | null): MultipleFactor {
  if (p == null) return { name: 'size', delta: 0, direction: 'neutral', rationale: 'Licensed places unknown — no size adjustment.' }
  if (p >= 100) return { name: 'size', delta: +0.5, direction: 'up', rationale: `${p} places — large centre; supports upper band.` }
  if (p >= 80) return { name: 'size', delta: +0.25, direction: 'up', rationale: `${p} places — meets the 80+ that earns 4.5–5x at strong occupancy.` }
  if (p >= 60) return { name: 'size', delta: 0, direction: 'neutral', rationale: `${p} places — mid-size; neutral.` }
  return { name: 'size', delta: -0.25, direction: 'down', rationale: `${p} places — below the 80+ that earns the top of the band.` }
}

function fOccupancy(occ?: number | null, declining?: boolean | null): MultipleFactor {
  if (occ == null) return { name: 'occupancy', delta: 0, direction: 'neutral', rationale: 'Occupancy unknown — verify before relying on the multiple.' }
  if (occ >= 90) return { name: 'occupancy', delta: +0.5, direction: 'up', rationale: `${occ.toFixed(0)}% occupancy — at/above the 85%+ that earns the top of the band.` }
  if (occ >= 85) return { name: 'occupancy', delta: +0.25, direction: 'up', rationale: `${occ.toFixed(0)}% occupancy — meets the 85%+ threshold for the upper band.` }
  let base = occ >= 75 ? -0.1 : occ >= 65 ? -0.35 : -0.6
  let label = `${occ.toFixed(0)}% occupancy — below the 85% that earns the top of the band.`
  if (declining) { base -= 0.25; label += ' Trend is DECLINING (extra discount; underwrite off the recent run, not the peak).' }
  return { name: 'occupancy', delta: round2(base), direction: 'down', rationale: label }
}

function fNqs(nqs?: string | null): MultipleFactor {
  const n = (nqs || '').toLowerCase().replace(/[\s-]+/g, '_').replace('_nqs', '')
  if (n === 'excellent' || n === 'exceeding') return { name: 'nqs', delta: +0.4, direction: 'up', rationale: `NQS ${nqs} — premium rating; commands more than Meeting/Working Towards.` }
  if (n === 'meeting') return { name: 'nqs', delta: 0, direction: 'neutral', rationale: 'NQS Meeting — neutral (the market baseline).' }
  if (n === 'working_towards' || n === 'significant_improvement' || n === 'significant_improvement_required')
    return { name: 'nqs', delta: -0.4, direction: 'down', rationale: `NQS ${nqs} — discounts vs Meeting/Exceeding; buyers price in remediation.` }
  return { name: 'nqs', delta: 0, direction: 'neutral', rationale: 'NQS rating unknown — no adjustment.' }
}

function fLease(yrs?: number | null, opts?: number | null): MultipleFactor {
  if (yrs == null) return { name: 'lease', delta: 0, direction: 'neutral', rationale: 'Lease tail unknown — confirm before relying on the multiple.' }
  const eff = yrs + (opts || 0)
  if (yrs < 3 && (opts || 0) > 0)
    return { name: 'lease', delta: -0.35, direction: 'down', rationale: `Lease ~${yrs}yr to expiry before options (${eff}yr incl options) — options MUST be confirmed/renewed pre-sale; a short pre-option tail spooks buyers and lenders.` }
  if (eff < 10) return { name: 'lease', delta: -0.5, direction: 'down', rationale: `~${eff}yr total incl options — under 10yr; materially discounts value.` }
  if (eff >= 15) return { name: 'lease', delta: +0.15, direction: 'up', rationale: `~${eff}yr total incl options — long secure tail; supports value.` }
  return { name: 'lease', delta: 0, direction: 'neutral', rationale: `~${eff}yr total incl options — adequate; neutral.` }
}

function fRent(pct?: number | null): MultipleFactor {
  if (pct == null) return { name: 'rent', delta: 0, direction: 'neutral', rationale: 'Rent-to-revenue unknown — no adjustment.' }
  if (pct <= 9) return { name: 'rent', delta: +0.2, direction: 'up', rationale: `Rent ~${pct.toFixed(0)}% of revenue — low occupancy cost; supports value.` }
  if (pct <= 13) return { name: 'rent', delta: 0, direction: 'neutral', rationale: `Rent ~${pct.toFixed(0)}% of revenue — within normal range.` }
  if (pct <= 15) return { name: 'rent', delta: -0.2, direction: 'down', rationale: `Rent ~${pct.toFixed(0)}% of revenue — elevated; pressures margin.` }
  return { name: 'rent', delta: -0.45, direction: 'down', rationale: `Rent ~${pct.toFixed(0)}% of revenue — above the 15% danger line; significant discount.` }
}

function fManagement(owner?: boolean | null): MultipleFactor {
  if (owner == null) return { name: 'management', delta: 0, direction: 'neutral', rationale: 'Management depth unknown — no adjustment.' }
  if (owner) return { name: 'management', delta: -0.3, direction: 'down', rationale: 'Owner-operated / owner-dependent — sells on PEBITDA (lower); the buyer must fund a replacement manager.' }
  return { name: 'management', delta: +0.2, direction: 'up', rationale: 'Standalone management layer in place — supports the EBITDA (not PEBITDA) multiple.' }
}

function fLocation(growth?: boolean | null): MultipleFactor {
  if (growth == null) return { name: 'location', delta: 0, direction: 'neutral', rationale: 'Location/demand context unknown — no adjustment.' }
  if (growth) return { name: 'location', delta: +0.15, direction: 'up', rationale: 'High-growth catchment — sustained demand supports value.' }
  return { name: 'location', delta: 0, direction: 'neutral', rationale: 'Location neutral for the multiple.' }
}

export function computeLeaseholdMultiple(inp: LeaseholdInputs): MultipleResult {
  const factors: MultipleFactor[] = [
    fSize(inp.licensedPlaces),
    fOccupancy(inp.occupancyPct, inp.occupancyDeclining),
    fNqs(inp.nqsRating),
    fLease(inp.leaseYearsRemaining, inp.leaseOptionsYears),
    fRent(inp.rentToRevenuePct),
    fManagement(inp.ownerOperated),
    fLocation(inp.growthCorridor),
  ]
  const netDelta = round2(factors.reduce((s, f) => s + f.delta, 0))
  const recMid = round2(clamp(COMP_MIDPOINT + netDelta, COMP_BAND.floor, COMP_BAND.ceiling))
  const recLo = round2(clamp(recMid - 0.375, COMP_BAND.floor, COMP_BAND.ceiling))
  const recHi = round2(clamp(recMid + 0.375, COMP_BAND.floor, COMP_BAND.ceiling))
  const downs = factors.filter(f => f.direction === 'down').length
  const ups = factors.filter(f => f.direction === 'up').length
  const pos = recMid < COMP_MIDPOINT - 0.25 ? 'bottom of the 3–5x band'
    : recMid > COMP_MIDPOINT + 0.25 ? 'upper part of the 3–5x band' : 'middle of the 3–5x band'
  return {
    band: [COMP_BAND.floor, COMP_BAND.ceiling],
    midpoint: COMP_MIDPOINT,
    netDelta,
    recommended: { low: recLo, mid: recMid, high: recHi },
    factors,
    interpretation: `~${recMid}x adjusted EBITDA — ${pos}. ${downs} factor(s) push down, ${ups} push up. Apply to a buyer-normalised EBITDA.`,
  }
}

// ── Upside / Base / Downside scenarios ──────────────────────────────────────
// Base = the recommended multiple on the current EBITDA.
// Upside/Downside perturb BOTH the multiple (±0.5x within the band) and the
// earnings (occupancy-led ± swing) to bracket the valuation.
export interface Scenario {
  key: 'upside' | 'base' | 'downside'
  label: string
  multiple: number
  ebitda: number
  valuation: number
  basis: string
}

export function buildScenarios(
  base: MultipleResult,
  ebitda: number | null | undefined,
): Scenario[] | null {
  if (ebitda == null || ebitda <= 0) return null
  const m = base.recommended
  const up = round2(clamp(m.mid + 0.5, COMP_BAND.floor, COMP_BAND.ceiling))
  const down = round2(clamp(m.mid - 0.5, COMP_BAND.floor, COMP_BAND.ceiling))
  // Earnings swing: occupancy/cost upside vs downside, ±12% on EBITDA.
  const ebitdaUp = Math.round(ebitda * 1.12)
  const ebitdaDown = Math.round(ebitda * 0.88)
  return [
    { key: 'upside', label: 'Upside', multiple: up, ebitda: ebitdaUp, valuation: Math.round(up * ebitdaUp),
      basis: 'Occupancy recovers + costs hold; upper-band multiple.' },
    { key: 'base', label: 'Base', multiple: m.mid, ebitda: Math.round(ebitda), valuation: Math.round(m.mid * ebitda),
      basis: 'Recommended multiple on current normalised EBITDA.' },
    { key: 'downside', label: 'Downside', multiple: down, ebitda: ebitdaDown, valuation: Math.round(down * ebitdaDown),
      basis: 'Occupancy slide / cost reset on rehire; lower-band multiple.' },
  ]
}

// ── Re-valuation triggers ───────────────────────────────────────────────────
// Inputs whose change should force the user to re-check the valuation.
export interface RevalTrigger { field: string; label: string; fires: boolean; reason: string }

export function revaluationTriggers(args: {
  occupancyPct?: number | null
  occupancyDeclining?: boolean | null
  leaseYearsRemaining?: number | null
  leaseOptionsConfirmed?: boolean | null
  compLastReviewed?: string
  today?: Date
}): RevalTrigger[] {
  const t: RevalTrigger[] = []
  const occ = args.occupancyPct
  t.push({
    field: 'occupancy', label: 'Occupancy moved',
    fires: occ != null && (occ < 75 || Boolean(args.occupancyDeclining)),
    reason: occ == null ? 'Occupancy not set.'
      : occ < 75 ? `Occupancy ${occ.toFixed(0)}% is below 75% — re-value; it drives both the multiple and the EBITDA.`
      : args.occupancyDeclining ? 'Occupancy trend is declining — re-value off the recent run, not the peak.'
      : 'Occupancy stable.',
  })
  const yrs = args.leaseYearsRemaining
  t.push({
    field: 'lease', label: 'Lease / options',
    fires: yrs != null && yrs < 3 && !args.leaseOptionsConfirmed,
    reason: yrs == null ? 'Lease tail not set.'
      : yrs < 3 && !args.leaseOptionsConfirmed ? `~${yrs}yr to expiry and options NOT confirmed — confirm options, then re-value.`
      : 'Lease tail adequate or options confirmed.',
  })
  const reviewed = args.compLastReviewed || COMP_LAST_REVIEWED
  const today = args.today || new Date()
  const ageDays = Math.floor((today.getTime() - new Date(reviewed).getTime()) / 86400000)
  t.push({
    field: 'comps', label: 'Comp set freshness',
    fires: ageDays > 182,
    reason: ageDays > 182
      ? `Comp set last reviewed ${reviewed} (${ageDays}d ago) — stale; re-validate multiples before relying on this valuation.`
      : `Comp set current (reviewed ${reviewed}).`,
  })
  return t
}
