// deals.ts: reads use anon key (safe client-side), writes use service key (server-side API routes only)
import { createClient } from '@supabase/supabase-js'

// Read client — anon key, safe to use client-side and server-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// Write client — service key, bypasses RLS. ONLY used in server-side API routes.
// Never import writeSupabase in client components.
const writeSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'

// ─── DealRecord ───────────────────────────────────────────────────────────────
// Mirrors the Supabase `deals` table columns.
// NOTE: `verdict` here is a plain text label (e.g. "Strong Buy") — NOT the
// ScoredDeal.verdict object. Keep these two things distinct.

export interface DealRecord {
  id: string
  created_at: string
  centre_name: string | null
  address: string | null
  suburb: string | null
  state: string | null
  licensed_places: number | null

  // v2: total_score is 0–100 (server-calculated weighted sum)
  // v1 legacy column was overall_score (0–10) — keep both for backward compat
  total_score: number | null
  overall_score: number | null       // legacy — may be null for new deals

  verdict: string | null             // plain text label: "Strong Buy", "Avoid" etc.
  verdict_category: string | null    // v2: "passive_hold" | "turnaround" | "distressed" | "pass"

  occupancy_pct: number | null
  ebitda: number | null
  revenue: number | null
  asking_price: number | null
  labour_ratio_pct: number | null
  rent_ratio_pct: number | null

  // Sprint 3 additions — allow filtering deals list without loading full JSON
  has_critical_flags: boolean | null
  critical_flag_count: number | null
  scoring_version: string | null

  extracted: ExtractedDeal
  scored: ScoredDeal
  overrides: Record<string, number | string>
  source_file: string | null
  data_quality: string | null
  notes: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Resolve canonical score from ScoredDeal regardless of v1/v2
function resolveScore(scored: ScoredDeal): number {
  if (typeof scored.total_score === 'number') return scored.total_score
  if (typeof scored.overall_score === 'number') return scored.overall_score * 10
  return 0
}

// v2 thresholds: score is 0–100
function verdictFromScore(score: number): string {
  if (score >= 75) return 'Strong Buy'
  if (score >= 65) return 'Attractive'
  if (score >= 55) return 'Conditional'
  if (score >= 45) return 'Caution'
  if (score >= 35) return 'High Risk'
  return 'Avoid'
}

function countCriticalFlags(scored: ScoredDeal): { hasCritical: boolean; count: number } {
  const flags = scored.deal_breaker_flags?.flags ?? []
  const triggered = flags.filter(f => f.triggered)
  const critical  = triggered.filter(f => f.severity === 'critical')
  // Also count v1 legacy hard flags
  const legacyCritical = ['occupancy_critical','labour_ratio_critical','ebitda_negative_no_ramp','lease_expired']
  const legacyCount = (scored.hard_flags_triggered ?? []).filter(id => legacyCritical.includes(id)).length
  const totalCritical = critical.length + legacyCount
  return { hasCritical: totalCritical > 0 || triggered.length > 0, count: totalCritical }
}

// ─── saveDeal ─────────────────────────────────────────────────────────────────

export async function saveDeal(
  extracted: ExtractedDeal,
  scored: ScoredDeal,
  overrides: Record<string, number | string> = {}
): Promise<{ id: string } | null> {
  const centre   = extracted.centre
  const fy25     = extracted.financials?.fy25
  const ratios   = extracted.key_ratios
  const occupancy = extracted.occupancy

  const canonicalScore   = resolveScore(scored)
  const { hasCritical, count: criticalCount } = countCriticalFlags(scored)

  const { data, error } = await writeSupabase
    .from('deals')
    .insert({
      centre_name:    centre?.name ?? scored.centre_name ?? null,
      address:        centre?.address ?? null,
      suburb:         centre?.suburb ?? null,
      state:          centre?.state ?? null,
      licensed_places: centre?.licensed_places ?? null,

      // v2 score fields
      total_score:    canonicalScore,
      overall_score:  canonicalScore,                      // keep column populated for legacy queries
      verdict:        verdictFromScore(canonicalScore),
      verdict_category: scored.verdict?.category ?? null,

      occupancy_pct:   occupancy?.avg_4wk_pct ?? occupancy?.current_month_pct ?? null,
      ebitda:          fy25?.ebitda ?? ratios?.ebitda_fy25 ?? null,
      revenue:         fy25?.revenue ?? ratios?.revenue_fy25 ?? null,
      asking_price:    extracted.financials?.asking_price ?? ratios?.asking_price ?? null,
      labour_ratio_pct: fy25?.labour_ratio_pct ?? ratios?.labour_ratio_fy25_pct ?? null,
      rent_ratio_pct:  fy25?.rent_ratio_pct ?? ratios?.rent_ratio_fy25_pct ?? null,

      // Sprint 3 flag columns
      has_critical_flags: hasCritical,
      critical_flag_count: criticalCount,
      scoring_version: scored.scoring_version ?? null,

      extracted,
      scored,
      overrides,
      source_file:  extracted.meta?.source_files?.[0] ?? null,
      data_quality: extracted.meta?.data_quality ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('saveDeal error:', error)
    return null
  }
  return data
}

// ─── updateDealScore ──────────────────────────────────────────────────────────

export async function updateDealScore(
  id: string,
  scored: ScoredDeal,
  overrides: Record<string, number | string>
): Promise<boolean> {
  const canonicalScore = resolveScore(scored)
  const { hasCritical, count: criticalCount } = countCriticalFlags(scored)

  const { error } = await writeSupabase
    .from('deals')
    .update({
      total_score:      canonicalScore,
      overall_score:    canonicalScore,
      verdict:          verdictFromScore(canonicalScore),
      verdict_category: scored.verdict?.category ?? null,
      has_critical_flags:  hasCritical,
      critical_flag_count: criticalCount,
      scoring_version:  scored.scoring_version ?? null,
      scored,
      overrides,
    })
    .eq('id', id)

  if (error) { console.error('updateDealScore error:', error); return false }
  return true
}

// ─── listDeals ────────────────────────────────────────────────────────────────

export async function listDeals(): Promise<DealRecord[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) { console.error('listDeals error:', error); return [] }
  return data as DealRecord[]
}

// ─── getDeal ──────────────────────────────────────────────────────────────────

export async function getDeal(id: string): Promise<DealRecord | null> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) { console.error('getDeal error:', error); return null }
  return data as DealRecord
}

// ─── deleteDeal ───────────────────────────────────────────────────────────────

export async function deleteDeal(id: string): Promise<boolean> {
  const { error } = await writeSupabase.from('deals').delete().eq('id', id)
  if (error) { console.error('deleteDeal error:', error); return false }
  return true
}
