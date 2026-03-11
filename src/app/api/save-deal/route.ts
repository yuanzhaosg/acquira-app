import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

function verdictFromScore(score: number): string {
  if (score >= 7.5) return 'Strong Buy'
  if (score >= 6.5) return 'Attractive'
  if (score >= 5.5) return 'Conditional'
  if (score >= 4.5) return 'Caution'
  if (score >= 3.5) return 'High Risk'
  return 'Avoid'
}

export async function POST(req: NextRequest) {
  try {
    const { extracted, scored, overrides = {} } = await req.json()
    const centre = extracted.centre
    const fy25 = extracted.financials?.fy25
    const ratios = extracted.key_ratios
    const occupancy = extracted.occupancy

    const { data, error } = await supabase.from('deals').insert({
      centre_name: centre?.name ?? scored.centre_name ?? null,
      address: centre?.address ?? null,
      suburb: centre?.suburb ?? null,
      state: centre?.state ?? null,
      licensed_places: centre?.licensed_places ?? null,
      overall_score: scored.overall_score,
      verdict: verdictFromScore(scored.overall_score),
      occupancy_pct: occupancy?.avg_4wk_pct ?? occupancy?.current_month_pct ?? null,
      ebitda: fy25?.ebitda ?? ratios?.ebitda_fy25 ?? null,
      revenue: fy25?.revenue ?? ratios?.revenue_fy25 ?? null,
      asking_price: extracted.financials?.asking_price ?? ratios?.asking_price ?? null,
      labour_ratio_pct: fy25?.labour_ratio_pct ?? ratios?.labour_ratio_fy25_pct ?? null,
      rent_ratio_pct: fy25?.rent_ratio_pct ?? ratios?.rent_ratio_fy25_pct ?? null,
      extracted, scored, overrides,
      source_file: extracted.meta?.source_files?.[0] ?? null,
      data_quality: extracted.meta?.data_quality ?? null,
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
