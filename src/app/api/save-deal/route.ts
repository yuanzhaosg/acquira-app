import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ScoredDeal } from '@/types/scored'
import type { RetainedSourceFile } from '@/types/runs'
import { canCreateDeal, incrementDealsUsed } from '@/lib/billing/limits'
import { createInitialUnderwritingRunForDeal } from '@/lib/underwritingRuns'
import { canonicalizeRetainedSourceFiles } from '@/lib/sourceDocuments'

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

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cleanFilename(value: unknown): string | null {
  const text = cleanText(value)
  if (!text) return null
  return text
    .replace(/[\\/]+/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 240) || null
}

function isValidRetainedSourcePath(path: string): boolean {
  if (!path.startsWith('deal-sources/')) return false
  if (path.includes('..') || path.includes('\\')) return false
  if (/[\u0000-\u001f\u007f]/.test(path)) return false
  const parts = path.split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) return false
  return parts.length >= 4
}

function parseFileSize(value: unknown): number | null {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

function parseRetainedSourceFiles(value: unknown): RetainedSourceFile[] {
  if (!Array.isArray(value)) return []
  const retained: RetainedSourceFile[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const record = raw as Record<string, unknown>
    const retainedPath = cleanText(record.retained_storage_path)
    const filename = cleanFilename(record.filename)
    if (!retainedPath || !filename || !isValidRetainedSourcePath(retainedPath)) continue
    if (seen.has(retainedPath)) continue
    seen.add(retainedPath)
    retained.push({
      original_storage_path: cleanText(record.original_storage_path),
      retained_storage_path: retainedPath,
      filename,
      content_type: cleanText(record.content_type),
      file_size: parseFileSize(record.file_size),
    })
  }
  return retained
}

export async function POST(req: NextRequest) {
  try {
    const { extracted, scored, workflow = null, overrides = {}, retained_source_files } = await req.json()
    const retainedSourceFiles = parseRetainedSourceFiles(retained_source_files)
    const retainedSourcePaths = retainedSourceFiles.map(file => file.retained_storage_path)

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

    const insertPayload = {
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

      occupancy_pct:    occupancy?.current_month_pct ?? occupancy?.latest_week_pct ?? occupancy?.avg_4wk_pct ?? null,
      ebitda:           fy25?.ebitda ?? ratios?.ebitda_fy25 ?? null,
      revenue:          fy25?.revenue ?? ratios?.revenue_fy25 ?? null,
      asking_price:     extracted.financials?.asking_price ?? ratios?.asking_price ?? null,
      labour_ratio_pct: fy25?.labour_ratio_pct ?? ratios?.labour_ratio_fy25_pct ?? null,
      rent_ratio_pct:   fy25?.rent_ratio_pct ?? ratios?.rent_ratio_fy25_pct ?? null,

      has_critical_flags:  hasCritical,
      critical_flag_count: criticalCount,
      scoring_version:     scored.scoring_version ?? null,

      extracted, scored, workflow, overrides,
      source_file:  extracted.meta?.source_files?.[0] ?? null,
      data_quality: extracted.meta?.data_quality ?? null,
    }

    let { data, error } = await supabase.from('deals').insert(insertPayload).select('id').single()

    // Backwards-compatible deploy path: if the workflow column has not been
    // migrated yet, keep uploads working and persist the legacy report shape.
    if (error && /workflow/i.test(error.message)) {
      const legacyPayload = { ...insertPayload }
      delete (legacyPayload as { workflow?: unknown }).workflow
      const retry = await supabase.from('deals').insert(legacyPayload).select('id').single()
      data = retry.data
      error = retry.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Deal save failed' }, { status: 500 })

    let current_run_id: string | null = null
    try {
      const run = await createInitialUnderwritingRunForDeal(supabase, {
        deal_id: data.id,
        created_by: user_id,
        extracted,
        scored,
        workflow,
        input_source_paths: retainedSourcePaths,
      })
      current_run_id = run.id

      if (retainedSourceFiles.length) {
        const finalSourceFiles = await canonicalizeRetainedSourceFiles(supabase, {
          deal_id: data.id,
          run_id: run.id,
          retained_source_files: retainedSourceFiles,
        })
        const finalSourcePaths = finalSourceFiles.map(file => file.retained_storage_path)

        const { error: sourceDocsError } = await supabase
          .from('deal_source_documents')
          .insert(finalSourceFiles.map(file => ({
            deal_id: data.id,
            run_id: run.id,
            original_storage_path: file.original_storage_path ?? null,
            retained_storage_path: file.retained_storage_path,
            filename: file.filename,
            content_type: file.content_type ?? null,
            file_size: file.file_size ?? null,
            source_kind: 'retained_pipeline_source',
            created_by: user_id,
          })))
        if (sourceDocsError) throw sourceDocsError

        const { error: runUpdateError } = await supabase
          .from('underwriting_runs')
          .update({ input_source_paths: finalSourcePaths })
          .eq('id', run.id)
          .eq('deal_id', data.id)
        if (runUpdateError) throw runUpdateError

        for (const file of finalSourceFiles) {
          if (file.canonicalization_warning) {
            console.warn(`source canonicalization fallback for ${file.filename}: ${file.canonicalization_warning}`)
          }
        }
      }
    } catch (runError) {
      try {
        const { error: rollbackError } = await supabase.from('deals').delete().eq('id', data.id)
        if (rollbackError) console.error('save-deal rollback failed:', rollbackError.message)
      } catch (rollbackError) {
        const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        console.error('save-deal rollback failed:', rollbackMessage)
      }
      const message = runError instanceof Error ? runError.message : 'Failed to create underwriting run snapshot'
      return NextResponse.json({ error: `Deal save rolled back: ${message}` }, { status: 500 })
    }

    // Increment deals_used after successful insert
    if (user_id) {
      await incrementDealsUsed(user_id).catch(e => console.error('incrementDealsUsed error:', e.message))
    }

    return NextResponse.json({ id: data.id, current_run_id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Deal save failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
