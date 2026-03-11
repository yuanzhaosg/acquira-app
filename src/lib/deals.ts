import { supabase } from './supabase'
import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'

export interface DealRecord {
  id: string
  created_at: string
  centre_name: string | null
  address: string | null
  suburb: string | null
  state: string | null
  licensed_places: number | null
  overall_score: number | null
  verdict: string | null
  occupancy_pct: number | null
  ebitda: number | null
  revenue: number | null
  asking_price: number | null
  labour_ratio_pct: number | null
  rent_ratio_pct: number | null
  extracted: ExtractedDeal
  scored: ScoredDeal
  overrides: Record<string, number>
  source_file: string | null
  data_quality: string | null
  notes: string | null
}

function verdictFromScore(score: number): string {
  if (score >= 7.5) return 'Strong Buy'
  if (score >= 6.5) return 'Attractive'
  if (score >= 5.5) return 'Conditional'
  if (score >= 4.5) return 'Caution'
  if (score >= 3.5) return 'High Risk'
  return 'Avoid'
}

export async function saveDeal(
  extracted: ExtractedDeal,
  scored: ScoredDeal,
  overrides: Record<string, number> = {}
): Promise<{ id: string } | null> {
  const centre = extracted.centre
  const fy25 = extracted.financials?.fy25
  const ratios = extracted.key_ratios
  const occupancy = extracted.occupancy

  const { data, error } = await supabase
    .from('deals')
    .insert({
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
      extracted,
      scored,
      overrides,
      source_file: extracted.meta?.source_files?.[0] ?? null,
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

export async function updateDealScore(
  id: string,
  scored: ScoredDeal,
  overrides: Record<string, number>
): Promise<boolean> {
  const { error } = await supabase
    .from('deals')
    .update({
      overall_score: scored.overall_score,
      verdict: verdictFromScore(scored.overall_score),
      scored,
      overrides,
    })
    .eq('id', id)

  if (error) { console.error('updateDealScore error:', error); return false }
  return true
}

export async function listDeals(): Promise<DealRecord[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) { console.error('listDeals error:', error); return [] }
  return data as DealRecord[]
}

export async function getDeal(id: string): Promise<DealRecord | null> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) { console.error('getDeal error:', error); return null }
  return data as DealRecord
}

export async function deleteDeal(id: string): Promise<boolean> {
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) { console.error('deleteDeal error:', error); return false }
  return true
}
