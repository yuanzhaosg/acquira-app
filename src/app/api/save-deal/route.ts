import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ScoredDeal } from '@/types/scored'
import { canCreateDeal, incrementDealsUsed } from '@/lib/billing/limits'

// Service key client — bypasses RLS for writes, but we stamp user_id manually
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// User-scoped client — used to verify the session from the request cookie
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function verdictFromScore(score: number): string {
  if (score >= 75) return 'Strong Buy'
  if (score >= 65) return 'Attractive'
  if (score >= 55) return 'Conditional'
  if (score >= 45) return 'Caution'
  if (score >= 35) return 'High Risk'
  return 'Avoid'
}

function resolveScore(scored: ScoredDeal): number {
  if (typeof scored.total_score === 'number') return scored.total_score
  if (typeof scored.overall_score === 'number') return scored.overall_score * 10
  return 0
}

function countCriticalFlags(scored: ScoredDeal): { hasCritical: boolean; count: number } {
  const flags      = scored.deal_breaker_flags?.flags ?? []
  const triggered  = flags.filter(f => f.triggered)
  const critical   = triggered.filter(f => f.severity === 'critical')
  const legacyCritical = ['occupancy_critical','labour_ratio_critical','ebitda_negative_no_ramp','lease_expired']
  const legacyCount = (scored.hard_flags_triggered ?? []).filter(id => legacyCritical.includes(id)).length
  return {
    hasCritical: critical.length + legacyCount > 0 || triggered.length > 0,
    count: critical.length + legacyCount,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { extracted, scored, overrides = {} } = await req.json()

    // ── Resolve user_id from Authorization header ──────────────────────────
    let user_id: string | null = null
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data } = await supabaseAuth.auth.getUser(token)
      user_id = data.user?.id ?? null
    }

    // ── Paywall check ─────────────────────────────────────────────────────────
    if (user_id) {
      const limitResult = await canCreateDeal(user_id)
      if (!limitResult.allowed) {
        return NextResponse.json(
          { error: limitResult.reason ?? 'Deal limit reached', code: 'DEAL_LIMIT_REACHED', dealsUsed: limitResult.dealsUsed, dealsMax: limitResult.dealsMax },
          { status: 402 }
        )
      }
    }

    const centre    = extracted.centre
    const fy25      = extracted.financials?.fy25
    const ratios    = extracted.key_ratios
    const occupancy = extracted.occupancy

    const canonicalScore = resolveScore(scored as ScoredDeal)
    const { hasCritical, count: criticalCount } = countCriticalFlags(scored as ScoredDeal)

    const { data, error } = await supabase.from('deals').insert({
      user_id,   // ← stamped on every insert

      centre_name:     centre?.name ?? scored.centre_name ?? null,
      address:         centre?.address ?? null,
      suburb:          centre?.suburb ?? null,
      state:           centre?.state ?? null,
      licensed_places: centre?.licensed_places ?? null,

      total_score:      canonicalScore,
      overall_score:    canonicalScore,
      verdict:          verdictFromScore(canonicalScore),
      verdict_category: scored.verdict?.category ?? null,

      occupancy_pct:    occupancy?.avg_4wk_pct ?? occupancy?.current_month_pct ?? null,
      ebitda:           fy25?.ebitda ?? ratios?.ebitda_fy25 ?? null,
      revenue:          fy25?.revenue ?? ratios?.revenue_fy25 ?? null,
      asking_price:     extracted.financials?.asking_price ?? ratios?.asking_price ?? null,
      labour_ratio_pct: fy25?.labour_ratio_pct ?? ratios?.labour_ratio_fy25_pct ?? null,
      rent_ratio_pct:   fy25?.rent_ratio_pct ?? ratios?.rent_ratio_fy25_pct ?? null,

      has_critical_flags:  hasCritical,
      critical_flag_count: criticalCount,
      scoring_version:     scored.scoring_version ?? null,

      extracted, scored, overrides,
      source_file:  extracted.meta?.source_files?.[0] ?? null,
      data_quality: extracted.meta?.data_quality ?? null,
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Increment deals_used after successful insert
    if (user_id) {
      await incrementDealsUsed(user_id).catch(e => console.error('incrementDealsUsed error:', e.message))
    }

    return NextResponse.json({ id: data.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
