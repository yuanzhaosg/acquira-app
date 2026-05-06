import type { SupabaseClient } from '@supabase/supabase-js'
import { buildCanonicalSourcePath, copySourceWithFallback, isSafeSourcePath } from '@/lib/sourceDocuments'

type SupabaseLike = SupabaseClient

export interface MaintenanceRunSummary {
  id: string
  deal_id: string
  run_number?: number | null
  status?: string | null
  run_type?: string | null
  created_at?: string | null
  started_at?: string | null
  error_message?: string | null
}

export interface PendingSourceDocumentSummary {
  id: string
  deal_id: string
  run_id?: string | null
  filename: string
  retained_storage_path: string
  created_at?: string | null
}

export interface CanonicalizePendingSourceResult extends PendingSourceDocumentSummary {
  status: 'would_canonicalize' | 'canonicalized' | 'skipped' | 'failed'
  canonical_path?: string
  reason?: string
}

function cutoffIso(olderThanMinutes: number): string {
  return new Date(Date.now() - Math.max(1, olderThanMinutes) * 60 * 1000).toISOString()
}

function asRunSummary(row: Record<string, unknown>): MaintenanceRunSummary {
  return {
    id: String(row.id),
    deal_id: String(row.deal_id),
    run_number: typeof row.run_number === 'number' ? row.run_number : null,
    status: typeof row.status === 'string' ? row.status : null,
    run_type: typeof row.run_type === 'string' ? row.run_type : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    started_at: typeof row.started_at === 'string' ? row.started_at : null,
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
  }
}

function asPendingSource(row: Record<string, unknown>): PendingSourceDocumentSummary {
  return {
    id: String(row.id),
    deal_id: String(row.deal_id),
    run_id: typeof row.run_id === 'string' ? row.run_id : null,
    filename: String(row.filename ?? 'source_document'),
    retained_storage_path: String(row.retained_storage_path ?? ''),
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
  }
}

export async function markStaleRunningRunsFailed(
  supabase: SupabaseLike,
  params: {
    dealId?: string
    olderThanMinutes?: number
    dryRun?: boolean
  } = {},
): Promise<{ dry_run: boolean; runs: MaintenanceRunSummary[] }> {
  const dryRun = params.dryRun !== false
  const cutoff = cutoffIso(params.olderThanMinutes ?? 60)
  let query = supabase
    .from('underwriting_runs')
    .select('id, deal_id, run_number, status, run_type, created_at, started_at, error_message')
    .in('status', ['running', 'queued'])
    .or(`started_at.lt.${cutoff},and(started_at.is.null,created_at.lt.${cutoff})`)
    .order('created_at', { ascending: true })
  if (params.dealId) query = query.eq('deal_id', params.dealId)

  const { data, error } = await query
  if (error) throw error
  const runs = ((data ?? []) as Record<string, unknown>[]).map(asRunSummary)
  if (!dryRun && runs.length) {
    const now = new Date().toISOString()
    const staleMessage = 'Run was marked failed after exceeding the stale execution threshold.'
    for (const run of runs) {
      const { error: updateError } = await supabase
        .from('underwriting_runs')
        .update({
          status: 'failed',
          completed_at: now,
          last_error_at: now,
          progress_step: 'stale_failed',
          progress_message: staleMessage,
          error_message: run.error_message || staleMessage,
        })
        .eq('id', run.id)
        .in('status', ['running', 'queued'])
      if (updateError) throw updateError
    }
  }
  return { dry_run: dryRun, runs }
}

export async function findPendingSourceDocuments(
  supabase: SupabaseLike,
  params: { dealId?: string } = {},
): Promise<PendingSourceDocumentSummary[]> {
  let query = supabase
    .from('deal_source_documents')
    .select('id, deal_id, run_id, filename, retained_storage_path, created_at')
    .like('retained_storage_path', 'deal-sources/pending/%')
    .order('created_at', { ascending: true })
  if (params.dealId) query = query.eq('deal_id', params.dealId)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(asPendingSource)
}

async function replaceRunSourcePath(
  supabase: SupabaseLike,
  runId: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  const { data: run, error } = await supabase
    .from('underwriting_runs')
    .select('id, input_source_paths')
    .eq('id', runId)
    .maybeSingle()
  if (error) throw error
  const current = Array.isArray(run?.input_source_paths) ? run.input_source_paths as string[] : []
  const next = Array.from(new Set(current.map(path => path === oldPath ? newPath : path)))
  if (!next.includes(newPath)) next.push(newPath)
  const { error: updateError } = await supabase
    .from('underwriting_runs')
    .update({ input_source_paths: next })
    .eq('id', runId)
  if (updateError) throw updateError
}

export async function canonicalizePendingSourceDocumentsForDeal(
  supabase: SupabaseLike,
  params: {
    dealId: string
    dryRun?: boolean
  },
): Promise<{ dry_run: boolean; results: CanonicalizePendingSourceResult[] }> {
  const dryRun = params.dryRun !== false
  const pending = await findPendingSourceDocuments(supabase, { dealId: params.dealId })
  const results: CanonicalizePendingSourceResult[] = []
  for (const [index, doc] of pending.entries()) {
    if (!doc.retained_storage_path.startsWith('deal-sources/pending/')) {
      results.push({ ...doc, status: 'skipped', reason: 'Already canonical or not a pending source path' })
      continue
    }
    if (!doc.run_id) {
      results.push({ ...doc, status: 'skipped', reason: 'No run_id is linked to this source document' })
      continue
    }
    if (!isSafeSourcePath(doc.retained_storage_path)) {
      results.push({ ...doc, status: 'failed', reason: 'Pending retained path is unsafe' })
      continue
    }
    const canonicalPath = buildCanonicalSourcePath(doc.deal_id, doc.run_id, doc.filename, index)
    if (dryRun) {
      results.push({ ...doc, status: 'would_canonicalize', canonical_path: canonicalPath })
      continue
    }
    try {
      await copySourceWithFallback(supabase, doc.retained_storage_path, canonicalPath)
      const { error: docError } = await supabase
        .from('deal_source_documents')
        .update({ retained_storage_path: canonicalPath })
        .eq('id', doc.id)
        .eq('deal_id', params.dealId)
      if (docError) throw docError
      await replaceRunSourcePath(supabase, doc.run_id, doc.retained_storage_path, canonicalPath)
      results.push({ ...doc, status: 'canonicalized', canonical_path: canonicalPath })
    } catch (e) {
      results.push({
        ...doc,
        status: 'failed',
        canonical_path: canonicalPath,
        reason: e instanceof Error ? e.message : 'Canonicalization failed',
      })
    }
  }
  return { dry_run: dryRun, results }
}

export async function dealHealthCheck(
  supabase: SupabaseLike,
  params: { dealId: string; staleOlderThanMinutes?: number },
) {
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, current_run_id')
    .eq('id', params.dealId)
    .maybeSingle()
  if (dealError) throw dealError
  if (!deal) throw new Error('Deal not found')

  const { data: runs, error: runsError } = await supabase
    .from('underwriting_runs')
    .select('id, deal_id, run_number, status, run_type, created_at, started_at, completed_at, is_current, error_message')
    .eq('deal_id', params.dealId)
  if (runsError) throw runsError

  const { data: sourceDocs, error: sourceError } = await supabase
    .from('deal_source_documents')
    .select('id, retained_storage_path')
    .eq('deal_id', params.dealId)
  if (sourceError) throw sourceError

  const { data: diligenceDocs, error: diligenceError } = await supabase
    .from('diligence_documents')
    .select('id, created_at')
    .eq('deal_id', params.dealId)
  if (diligenceError) throw diligenceError

  const { data: evidenceRequests, error: requestError } = await supabase
    .from('evidence_requests')
    .select('id, status')
    .eq('deal_id', params.dealId)
  if (requestError) throw requestError

  const stale = await markStaleRunningRunsFailed(supabase, {
    dealId: params.dealId,
    olderThanMinutes: params.staleOlderThanMinutes ?? 60,
    dryRun: true,
  })
  const runRows = (runs ?? []) as Array<Record<string, unknown>>
  const currentRuns = runRows.filter(run => run.is_current === true)
  const currentRun = runRows.find(run => String(run.id) === String(deal.current_run_id))
  const sourceRows = (sourceDocs ?? []) as Array<{ retained_storage_path?: string | null }>
  const diligenceRows = (diligenceDocs ?? []) as Array<{ created_at?: string | null }>
  const requestRows = (evidenceRequests ?? []) as Array<{ status?: string | null }>
  const currentCompletedAt = typeof currentRun?.completed_at === 'string' ? new Date(currentRun.completed_at).getTime() : NaN
  const newerDocsThanCurrentRun = Number.isFinite(currentCompletedAt)
    ? diligenceRows.filter(doc => doc.created_at && new Date(doc.created_at).getTime() > currentCompletedAt).length
    : 0
  const runsByStatus = runRows.reduce<Record<string, number>>((acc, run) => {
    const status = typeof run.status === 'string' ? run.status : 'unknown'
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
  const evidenceRequestsByStatus = requestRows.reduce<Record<string, number>>((acc, request) => {
    const status = request.status ?? 'unknown'
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
  const pendingSourceDocumentCount = sourceRows.filter(doc => doc.retained_storage_path?.startsWith('deal-sources/pending/')).length
  const warnings: string[] = []
  if (!deal.current_run_id) warnings.push('Deal has no current_run_id.')
  if (deal.current_run_id && !currentRun) warnings.push('deal.current_run_id points to a missing underwriting run.')
  if (currentRuns.length > 1) warnings.push('Multiple underwriting runs are marked current.')
  if (currentRuns.length === 0) warnings.push('No underwriting run is marked current.')
  if (stale.runs.length > 0) warnings.push(`${stale.runs.length} stale running/queued run(s) found.`)
  if (pendingSourceDocumentCount > 0) warnings.push(`${pendingSourceDocumentCount} source document(s) still use pending storage paths.`)
  if (newerDocsThanCurrentRun > 0) warnings.push(`Current report excludes ${newerDocsThanCurrentRun} newer uploaded diligence document(s).`)

  return {
    deal_id: params.dealId,
    current_run_id: deal.current_run_id ?? null,
    current_run_exists: Boolean(currentRun),
    current_is_current_count: currentRuns.length,
    runs_by_status: runsByStatus,
    stale_running_runs: stale.runs,
    source_document_count: sourceRows.length,
    pending_source_document_count: pendingSourceDocumentCount,
    evidence_requests_by_status: evidenceRequestsByStatus,
    diligence_document_count: diligenceRows.length,
    newer_docs_than_current_run_count: newerDocsThanCurrentRun,
    warnings,
  }
}
