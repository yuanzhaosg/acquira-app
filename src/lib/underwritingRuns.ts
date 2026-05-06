import type { SupabaseClient } from '@supabase/supabase-js'
import type { UnderwritingRun } from '@/types/runs'

type SupabaseLike = SupabaseClient

interface InitialRunParams {
  deal_id: string
  created_by?: string | null
  extracted: unknown
  scored: unknown
  workflow?: unknown | null
  input_source_paths?: string[]
  completed_at?: string
}

interface ReunderwriteRunParams {
  deal_id: string
  base_run_id: string
  created_by?: string | null
  input_source_paths?: string[]
  input_diligence_document_ids: string[]
  input_document_count?: number | null
  input_total_bytes?: number | null
  started_at?: string
  progress_step?: string | null
  progress_message?: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> {
  return asRecord(asRecord(value)[key])
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function resolveScore(scored: Record<string, unknown>): number {
  const totalScore = numberValue(scored.total_score)
  if (totalScore != null) return totalScore
  const overallScore = numberValue(scored.overall_score)
  if (overallScore != null) return overallScore * 10
  return 0
}

function verdictFromScore(score: number): string {
  if (score >= 75) return 'Strong Buy'
  if (score >= 65) return 'Attractive'
  if (score >= 55) return 'Conditional'
  if (score >= 45) return 'Caution'
  if (score >= 35) return 'High Risk'
  return 'Avoid'
}

function countCriticalFlags(scored: Record<string, unknown>): { hasCritical: boolean; count: number } {
  const dealBreakerFlags = nestedRecord(scored, 'deal_breaker_flags')
  const rawFlags = Array.isArray(dealBreakerFlags.flags) ? dealBreakerFlags.flags : []
  const flags = rawFlags.filter((flag): flag is Record<string, unknown> => Boolean(flag) && typeof flag === 'object')
  const triggered = flags.filter(flag => flag.triggered === true)
  const critical = triggered.filter(flag => flag.severity === 'critical')
  const legacyCritical = ['occupancy_critical', 'labour_ratio_critical', 'ebitda_negative_no_ramp', 'lease_expired']
  const legacyFlags = Array.isArray(scored.hard_flags_triggered) ? scored.hard_flags_triggered : []
  const legacyCount = legacyFlags.filter(flag => legacyCritical.includes(String(flag))).length
  return {
    hasCritical: critical.length + legacyCount > 0 || triggered.length > 0,
    count: critical.length + legacyCount,
  }
}

function assignIfPresent(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== null && value !== undefined) target[key] = value
}

export function deriveDealSummaryFromRun(run: UnderwritingRun): Record<string, unknown> {
  const extracted = asRecord(run.extracted)
  const scored = asRecord(run.scored)
  const centre = nestedRecord(extracted, 'centre')
  const financials = nestedRecord(extracted, 'financials')
  const fy25 = nestedRecord(financials, 'fy25')
  const ratios = nestedRecord(extracted, 'key_ratios')
  const occupancy = nestedRecord(extracted, 'occupancy')
  const meta = nestedRecord(extracted, 'meta')
  const canonicalScore = resolveScore(scored)
  const criticalFlags = countCriticalFlags(scored)
  const update: Record<string, unknown> = {
    current_run_id: run.id,
    extracted: run.extracted,
    scored: run.scored,
    workflow: run.workflow,
    total_score: canonicalScore,
    overall_score: canonicalScore,
    verdict: verdictFromScore(canonicalScore),
    has_critical_flags: criticalFlags.hasCritical,
    critical_flag_count: criticalFlags.count,
  }

  assignIfPresent(update, 'centre_name', centre.name ?? scored.centre_name)
  assignIfPresent(update, 'address', centre.address)
  assignIfPresent(update, 'suburb', centre.suburb)
  assignIfPresent(update, 'state', centre.state)
  assignIfPresent(update, 'licensed_places', centre.licensed_places)
  assignIfPresent(update, 'verdict_category', nestedRecord(scored, 'verdict').category)
  assignIfPresent(update, 'occupancy_pct', occupancy.current_month_pct ?? occupancy.latest_week_pct ?? occupancy.avg_4wk_pct)
  assignIfPresent(update, 'ebitda', fy25.ebitda ?? ratios.ebitda_fy25)
  assignIfPresent(update, 'revenue', fy25.revenue ?? ratios.revenue_fy25)
  assignIfPresent(update, 'asking_price', financials.asking_price ?? ratios.asking_price)
  assignIfPresent(update, 'labour_ratio_pct', fy25.labour_ratio_pct ?? ratios.labour_ratio_fy25_pct)
  assignIfPresent(update, 'rent_ratio_pct', fy25.rent_ratio_pct ?? ratios.rent_ratio_fy25_pct)
  assignIfPresent(update, 'scoring_version', scored.scoring_version)
  const sourceFiles = meta.source_files
  assignIfPresent(update, 'source_file', Array.isArray(sourceFiles) ? sourceFiles[0] : null)
  assignIfPresent(update, 'data_quality', meta.data_quality)

  return update
}

export async function getNextRunNumber(
  supabase: SupabaseLike,
  dealId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('underwriting_runs')
    .select('run_number')
    .eq('deal_id', dealId)
    .order('run_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (typeof data?.run_number === 'number' ? data.run_number : 0) + 1
}

export async function getActiveRunForDeal(
  supabase: SupabaseLike,
  dealId: string,
  createdSince: string,
): Promise<UnderwritingRun | null> {
  const { data, error } = await supabase
    .from('underwriting_runs')
    .select('*')
    .eq('deal_id', dealId)
    .eq('run_type', 'reunderwrite')
    .in('status', ['queued', 'running'])
    .gte('created_at', createdSince)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as UnderwritingRun | null
}

export async function createInitialUnderwritingRunForDeal(
  supabase: SupabaseLike,
  params: InitialRunParams,
): Promise<UnderwritingRun> {
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, current_run_id')
    .eq('id', params.deal_id)
    .maybeSingle()

  if (dealError) throw dealError
  if (!deal) throw new Error('Deal not found for underwriting run snapshot')

  if (deal.current_run_id) {
    const { data: currentRun, error: currentRunError } = await supabase
      .from('underwriting_runs')
      .select('*')
      .eq('id', deal.current_run_id)
      .maybeSingle()
    if (currentRunError) throw currentRunError
    if (currentRun) return currentRun as UnderwritingRun
  }

  const { data: existingCurrent, error: existingCurrentError } = await supabase
    .from('underwriting_runs')
    .select('*')
    .eq('deal_id', params.deal_id)
    .eq('is_current', true)
    .maybeSingle()
  if (existingCurrentError) throw existingCurrentError
  if (existingCurrent) {
    await updateDealCurrentRunId(supabase, params.deal_id, existingCurrent.id)
    return existingCurrent as UnderwritingRun
  }

  const { data: existingInitial, error: existingInitialError } = await supabase
    .from('underwriting_runs')
    .select('*')
    .eq('deal_id', params.deal_id)
    .eq('run_type', 'initial')
    .eq('run_number', 1)
    .maybeSingle()
  if (existingInitialError) throw existingInitialError
  if (existingInitial) {
    const { data: updatedInitial, error: updateError } = await supabase
      .from('underwriting_runs')
      .update({
        is_current: true,
        promoted_at: existingInitial.promoted_at ?? params.completed_at ?? new Date().toISOString(),
      })
      .eq('id', existingInitial.id)
      .select('*')
      .single()
    if (updateError) throw updateError
    await updateDealCurrentRunId(supabase, params.deal_id, updatedInitial.id)
    return updatedInitial as UnderwritingRun
  }

  const completedAt = params.completed_at ?? new Date().toISOString()
  const runNumber = await getNextRunNumber(supabase, params.deal_id)
  const insertPayload = {
    deal_id: params.deal_id,
    run_number: runNumber,
    run_type: 'initial',
    status: 'completed',
    trigger: 'manual',
    input_source_paths: params.input_source_paths ?? [],
    input_diligence_document_ids: [],
    extracted: params.extracted,
    scored: params.scored,
    workflow: params.workflow ?? null,
    diff: null,
    created_by: params.created_by ?? null,
    completed_at: completedAt,
    promoted_at: completedAt,
    is_current: true,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('underwriting_runs')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertError) {
    const { data: retryRun, error: retryError } = await supabase
      .from('underwriting_runs')
      .select('*')
      .eq('deal_id', params.deal_id)
      .eq('run_type', 'initial')
      .eq('run_number', 1)
      .maybeSingle()
    if (retryError) throw retryError
    if (retryRun) {
      await updateDealCurrentRunId(supabase, params.deal_id, retryRun.id)
      return retryRun as UnderwritingRun
    }
    throw insertError
  }

  await updateDealCurrentRunId(supabase, params.deal_id, inserted.id)
  return inserted as UnderwritingRun
}

export async function createReunderwriteRun(
  supabase: SupabaseLike,
  params: ReunderwriteRunParams,
): Promise<UnderwritingRun> {
  return createRunningReunderwriteRun(supabase, params)
}

export async function createRunningReunderwriteRun(
  supabase: SupabaseLike,
  params: ReunderwriteRunParams,
): Promise<UnderwritingRun> {
  const runNumber = await getNextRunNumber(supabase, params.deal_id)
  const startedAt = params.started_at ?? new Date().toISOString()
  const { data, error } = await supabase
    .from('underwriting_runs')
    .insert({
      deal_id: params.deal_id,
      run_number: runNumber,
      run_type: 'reunderwrite',
      status: 'running',
      trigger: 'user_requested',
      base_run_id: params.base_run_id,
      input_source_paths: params.input_source_paths ?? [],
      input_diligence_document_ids: params.input_diligence_document_ids,
      extracted: null,
      scored: null,
      workflow: null,
      diff: null,
      error_message: null,
      created_by: params.created_by ?? null,
      started_at: startedAt,
      completed_at: null,
      promoted_at: null,
      execution_mode: 'sync',
      input_document_count: params.input_document_count ?? (params.input_source_paths ?? []).length + params.input_diligence_document_ids.length,
      input_total_bytes: params.input_total_bytes ?? null,
      progress_step: params.progress_step ?? 'backend_request',
      progress_message: params.progress_message ?? 'Sending selected documents for re-underwriting',
      retry_count: 0,
      last_error_at: null,
      is_current: false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as UnderwritingRun
}

export async function createQueuedReunderwriteRun(
  supabase: SupabaseLike,
  params: ReunderwriteRunParams,
): Promise<UnderwritingRun> {
  const runNumber = await getNextRunNumber(supabase, params.deal_id)
  const queuedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('underwriting_runs')
    .insert({
      deal_id: params.deal_id,
      run_number: runNumber,
      run_type: 'reunderwrite',
      status: 'queued',
      trigger: 'user_requested',
      base_run_id: params.base_run_id,
      input_source_paths: params.input_source_paths ?? [],
      input_diligence_document_ids: params.input_diligence_document_ids,
      extracted: null,
      scored: null,
      workflow: null,
      diff: null,
      error_message: null,
      created_by: params.created_by ?? null,
      queued_at: queuedAt,
      started_at: null,
      completed_at: null,
      promoted_at: null,
      claimed_at: null,
      claim_token: null,
      worker_id: null,
      cancel_requested_at: null,
      execution_mode: 'async_placeholder',
      input_document_count: params.input_document_count ?? (params.input_source_paths ?? []).length + params.input_diligence_document_ids.length,
      input_total_bytes: params.input_total_bytes ?? null,
      progress_step: params.progress_step ?? 'queued',
      progress_message: params.progress_message ?? 'Run queued for re-underwriting',
      retry_count: 0,
      last_error_at: null,
      is_current: false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as UnderwritingRun
}

export async function completeUnderwritingRun(
  supabase: SupabaseLike,
  runId: string,
  payload: {
    extracted: unknown
    scored: unknown
    workflow: unknown
    diff?: unknown | null
    completed_at?: string
    progress_step?: string
    progress_message?: string
  },
): Promise<UnderwritingRun> {
  const { data, error } = await supabase
    .from('underwriting_runs')
    .update({
      status: 'completed',
      extracted: payload.extracted,
      scored: payload.scored,
      workflow: payload.workflow,
      diff: payload.diff ?? null,
      error_message: null,
      completed_at: payload.completed_at ?? new Date().toISOString(),
      progress_step: payload.progress_step ?? 'completed',
      progress_message: payload.progress_message ?? 'Run completed',
      last_error_at: null,
    })
    .eq('id', runId)
    .select('*')
    .single()

  if (error) throw error
  return data as UnderwritingRun
}

export async function failUnderwritingRun(
  supabase: SupabaseLike,
  runId: string,
  errorMessage: string,
  options?: {
    progress_step?: string
    progress_message?: string
  },
): Promise<UnderwritingRun | null> {
  const failedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('underwriting_runs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: failedAt,
      last_error_at: failedAt,
      progress_step: options?.progress_step ?? 'failed',
      progress_message: options?.progress_message ?? errorMessage.slice(0, 500),
    })
    .eq('id', runId)
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data as UnderwritingRun | null
}

export async function promoteUnderwritingRun(
  supabase: SupabaseLike,
  run: UnderwritingRun,
): Promise<UnderwritingRun> {
  if (run.status !== 'completed') throw new Error('Only completed underwriting runs can be promoted')
  if (!run.extracted || !run.scored || !run.workflow) {
    throw new Error('Cannot promote a run without extracted, scored, and workflow snapshots')
  }
  const promotedAt = new Date().toISOString()
  const { data: previousCurrentRuns, error: previousCurrentError } = await supabase
    .from('underwriting_runs')
    .select('id')
    .eq('deal_id', run.deal_id)
    .eq('is_current', true)
  if (previousCurrentError) throw previousCurrentError

  const { data: previousDeal, error: previousDealError } = await supabase
    .from('deals')
    .select('*')
    .eq('id', run.deal_id)
    .maybeSingle()
  if (previousDealError) throw previousDealError

  const { error: clearError } = await supabase
    .from('underwriting_runs')
    .update({ is_current: false })
    .eq('deal_id', run.deal_id)
  if (clearError) throw clearError

  try {
    const dealUpdate = deriveDealSummaryFromRun(run)
    const { error: dealError } = await supabase
      .from('deals')
      .update(dealUpdate)
      .eq('id', run.deal_id)
    if (dealError) throw dealError

    const { data: promotedRun, error: promoteError } = await supabase
      .from('underwriting_runs')
      .update({ is_current: true, promoted_at: promotedAt })
      .eq('id', run.id)
      .eq('deal_id', run.deal_id)
      .select('*')
      .single()
    if (promoteError) throw promoteError
    return promotedRun as UnderwritingRun
  } catch (error) {
    await restorePromotionState(supabase, run.deal_id, previousDeal, previousCurrentRuns ?? [])
    throw error
  }
}

async function restorePromotionState(
  supabase: SupabaseLike,
  dealId: string,
  previousDeal: Record<string, unknown> | null,
  previousCurrentRuns: Array<{ id: string }>,
): Promise<void> {
  try {
    await supabase
      .from('underwriting_runs')
      .update({ is_current: false })
      .eq('deal_id', dealId)
    const previousIds = previousCurrentRuns.map(row => row.id).filter(Boolean)
    if (previousIds.length) {
      await supabase
        .from('underwriting_runs')
        .update({ is_current: true })
        .eq('deal_id', dealId)
        .in('id', previousIds)
    }
    if (previousDeal?.id) {
      await supabase
        .from('deals')
        .update(previousDeal)
        .eq('id', dealId)
    }
  } catch (restoreError) {
    const message = restoreError instanceof Error ? restoreError.message : String(restoreError)
    console.error('Failed to restore underwriting promotion state:', message)
  }
}

async function updateDealCurrentRunId(
  supabase: SupabaseLike,
  dealId: string,
  runId: string,
): Promise<void> {
  const { error } = await supabase
    .from('deals')
    .update({ current_run_id: runId })
    .eq('id', dealId)

  if (error) throw error
}
