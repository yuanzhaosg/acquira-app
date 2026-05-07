import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  completeUnderwritingRun,
  createQueuedReunderwriteRun,
  createRunningReunderwriteRun,
  failUnderwritingRun,
  getActiveRunForDeal,
} from '@/lib/underwritingRuns'
import { getServerBackendUrl } from '@/lib/serverBackendUrl'

const MAX_SELECTED_DOCUMENTS = 10
const MAX_SELECTED_BYTES = 75 * 1024 * 1024
const ACTIVE_RUN_WINDOW_MS = 15 * 60 * 1000
const BACKEND_REUNDERWRITE_TIMEOUT_MS = 240 * 1000

export const maxDuration = 300

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface DiligenceDocumentRow {
  id: string
  deal_id: string
  storage_path: string
  filename: string
  document_type?: string | null
  source_item_id?: string | null
  file_size?: number | null
}

interface SourceDocumentRow {
  id: string
  deal_id: string
  run_id?: string | null
  retained_storage_path: string
  filename: string
  content_type?: string | null
  source_kind?: string | null
  file_size?: number | null
}

interface ManualEvidenceNote {
  source_type: 'manual_user_note'
  source_label: string
  diligence_item_id?: string | null
  status?: string | null
  category?: string | null
  question?: string | null
  notes?: string | null
  confidence: 'low'
}

async function getUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')
  const { data } = await supabaseAuth.auth.getUser(token)
  return data.user?.id ?? null
}

async function getAccessibleDeal(id: string, userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .maybeSingle()
  let query = supabaseAdmin
    .from('deals')
    .select('id, current_run_id')
    .eq('id', id)
  if (profile?.org_id) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${profile.org_id}`)
  } else {
    query = query.eq('user_id', userId)
  }
  return query.maybeSingle()
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function isValidDiligencePath(storagePath: string, dealId: string): boolean {
  const prefix = `diligence/${dealId}/`
  if (!storagePath.startsWith(prefix)) return false
  const rest = storagePath.slice(prefix.length)
  if (!rest) return false
  if (rest.includes('..') || rest.includes('\\')) return false
  if (rest.split('/').some(part => !part)) return false
  if (/[\u0000-\u001f\u007f]/.test(rest)) return false
  return true
}

function isValidSourcePath(storagePath: string): boolean {
  if (!storagePath.startsWith('deal-sources/')) return false
  if (storagePath.includes('..') || storagePath.includes('\\')) return false
  if (/[\u0000-\u001f\u007f]/.test(storagePath)) return false
  if (storagePath.split('/').some(part => !part || part === '.' || part === '..')) return false
  return true
}

function cleanId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function uniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(cleanId).filter((id): id is string => Boolean(id))))
}

function numericBytes(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function migrationMessage(error: { message?: string } | null) {
  if (!error?.message) return null
  if (/underwriting_runs|diligence_documents|deal_source_documents|current_run_id|started_at|execution_mode|input_document_count|input_total_bytes|progress_|queued_at|claimed_at|claim_token|worker_id|cancel_requested_at|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Re-underwrite storage is not migrated yet. Apply the underwriting_runs, diligence_documents, and source document Supabase migrations and retry.'
  }
  return error.message
}

function executionMode(value: unknown): 'async' | 'sync' {
  return value === 'sync' ? 'sync' : 'async'
}

async function resolveBaseRun(dealId: string, requestedBaseRunId?: string | null) {
  if (requestedBaseRunId) {
    return supabaseAdmin
      .from('underwriting_runs')
      .select('*')
      .eq('id', requestedBaseRunId)
      .eq('deal_id', dealId)
      .maybeSingle()
  }

  return supabaseAdmin
    .from('underwriting_runs')
    .select('*')
    .eq('deal_id', dealId)
    .eq('status', 'completed')
    .order('is_current', { ascending: false })
    .order('run_number', { ascending: false })
    .limit(1)
    .maybeSingle()
}

async function rejectedSourceItemIds(dealId: string, sourceItemIds: string[]): Promise<Set<string>> {
  if (!sourceItemIds.length) return new Set()
  const { data, error } = await supabaseAdmin
    .from('diligence_items')
    .select('id, status')
    .eq('deal_id', dealId)
    .in('id', sourceItemIds)
  if (error) throw error
  return new Set((data ?? []).filter(row => row.status === 'rejected').map(row => row.id as string))
}

async function manualEvidenceForSelectedDocuments(dealId: string, documents: DiligenceDocumentRow[]): Promise<ManualEvidenceNote[]> {
  const sourceItemIds = Array.from(new Set(documents.map(doc => doc.source_item_id).filter((id): id is string => Boolean(id))))
  if (!sourceItemIds.length) return []
  const { data, error } = await supabaseAdmin
    .from('diligence_items')
    .select('id, category, question, request, status, notes')
    .eq('deal_id', dealId)
    .in('id', sourceItemIds)
  if (error) throw error
  const notesByItem: ManualEvidenceNote[] = []
  for (const row of data ?? []) {
    const notes = typeof row.notes === 'string' ? row.notes.trim() : ''
    const status = typeof row.status === 'string' ? row.status.trim() : ''
    if (!notes && !status) continue
    const question = typeof row.question === 'string' && row.question.trim()
      ? row.question.trim()
      : typeof row.request === 'string' ? row.request.trim() : ''
    notesByItem.push({
      source_type: 'manual_user_note',
      source_label: `Diligence item ${row.id}`,
      diligence_item_id: String(row.id),
      status,
      category: typeof row.category === 'string' ? row.category : null,
      question,
      notes,
      confidence: 'low',
    })
  }
  return notesByItem
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let runId: string | null = null
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const requestedBaseRunId = cleanId(body.base_run_id) ?? cleanId(deal.current_run_id)
    const selectedDiligenceIds = uniqueIds(body.diligence_document_ids)
    const selectedSourceIds = uniqueIds(body.source_document_ids)
    const allowRejectedItems = body.allow_rejected_items === true
    const requestedExecutionMode = executionMode(body.execution_mode)
    if (!selectedDiligenceIds.length && !selectedSourceIds.length) {
      return NextResponse.json({ error: 'Select at least one diligence document or retained source document' }, { status: 400 })
    }
    const inputDocumentCount = selectedDiligenceIds.length + selectedSourceIds.length
    if (inputDocumentCount > MAX_SELECTED_DOCUMENTS) {
      return NextResponse.json({ error: `Select ${MAX_SELECTED_DOCUMENTS} or fewer documents for one re-underwrite run.` }, { status: 400 })
    }

    const activeSince = new Date(Date.now() - ACTIVE_RUN_WINDOW_MS).toISOString()
    const activeRun = await getActiveRunForDeal(supabaseAdmin, id, activeSince)
    if (activeRun) {
      return NextResponse.json({
        error: 'A re-underwrite run is already in progress for this deal.',
        run_id: activeRun.id,
        existing_run_id: activeRun.id,
      }, { status: 409 })
    }

    let baseRunResult = await resolveBaseRun(id, requestedBaseRunId)
    let baseRunError = migrationMessage(baseRunResult.error)
    if (baseRunError) return NextResponse.json({ error: baseRunError }, { status: 500 })
    if (baseRunResult.error) return NextResponse.json({ error: baseRunResult.error.message }, { status: 500 })
    if (!baseRunResult.data && requestedBaseRunId !== deal.current_run_id) {
      baseRunResult = await resolveBaseRun(id, null)
      baseRunError = migrationMessage(baseRunResult.error)
      if (baseRunError) return NextResponse.json({ error: baseRunError }, { status: 500 })
      if (baseRunResult.error) return NextResponse.json({ error: baseRunResult.error.message }, { status: 500 })
    }
    const baseRun = baseRunResult.data
    if (!baseRun) return NextResponse.json({ error: 'No completed base underwriting run found for this deal' }, { status: 400 })
    if (baseRun.status !== 'completed') return NextResponse.json({ error: 'Base run must be completed before re-underwriting' }, { status: 400 })

    const baseExtracted = asRecord(baseRun.extracted)
    const baseScored = asRecord(baseRun.scored)
    const baseWorkflow = asRecord(baseRun.workflow)
    if (!Object.keys(baseExtracted).length || !Object.keys(baseScored).length || !Object.keys(baseWorkflow).length) {
      return NextResponse.json({ error: 'Base run is missing extracted, scored, or workflow snapshots' }, { status: 400 })
    }

    let selectedDocuments: DiligenceDocumentRow[] = []
    if (selectedDiligenceIds.length) {
      const { data: documents, error: docsError } = await supabaseAdmin
        .from('diligence_documents')
        .select('id, deal_id, storage_path, filename, document_type, source_item_id, file_size')
        .eq('deal_id', id)
        .in('id', selectedDiligenceIds)
      const docsMigrationError = migrationMessage(docsError)
      if (docsMigrationError) return NextResponse.json({ error: docsMigrationError }, { status: 500 })
      if (docsError) return NextResponse.json({ error: docsError.message }, { status: 500 })
      selectedDocuments = (documents ?? []) as DiligenceDocumentRow[]
    }

    if (selectedDocuments.length !== selectedDiligenceIds.length) {
      return NextResponse.json({ error: 'One or more diligence_document_ids do not belong to this deal' }, { status: 400 })
    }

    const invalidPath = selectedDocuments.find(doc => !isValidDiligencePath(doc.storage_path, id))
    if (invalidPath) {
      return NextResponse.json({ error: `Document ${invalidPath.id} has an invalid diligence storage path` }, { status: 400 })
    }

    if (!allowRejectedItems) {
      const sourceItemIds = selectedDocuments.map(doc => doc.source_item_id).filter((itemId): itemId is string => Boolean(itemId))
      const rejectedIds = await rejectedSourceItemIds(id, sourceItemIds)
      const rejectedDoc = selectedDocuments.find(doc => doc.source_item_id && rejectedIds.has(doc.source_item_id))
      if (rejectedDoc) {
        return NextResponse.json({ error: 'Selected documents linked to rejected diligence items require allow_rejected_items=true' }, { status: 400 })
      }
    }
    const manualEvidenceNotes = await manualEvidenceForSelectedDocuments(id, selectedDocuments)

    let selectedSourceDocuments: SourceDocumentRow[] = []
    if (selectedSourceIds.length) {
      const { data: sourceDocuments, error: sourceDocsError } = await supabaseAdmin
        .from('deal_source_documents')
        .select('id, deal_id, run_id, retained_storage_path, filename, content_type, source_kind, file_size')
        .eq('deal_id', id)
        .in('id', selectedSourceIds)
      const sourceDocsMigrationError = migrationMessage(sourceDocsError)
      if (sourceDocsMigrationError) return NextResponse.json({ error: sourceDocsMigrationError }, { status: 500 })
      if (sourceDocsError) return NextResponse.json({ error: sourceDocsError.message }, { status: 500 })
      selectedSourceDocuments = (sourceDocuments ?? []) as SourceDocumentRow[]
    }
    if (selectedSourceDocuments.length !== selectedSourceIds.length) {
      return NextResponse.json({ error: 'One or more source_document_ids do not belong to this deal' }, { status: 400 })
    }
    const invalidSourcePath = selectedSourceDocuments.find(doc => !isValidSourcePath(doc.retained_storage_path))
    if (invalidSourcePath) {
      return NextResponse.json({ error: `Source document ${invalidSourcePath.id} has an invalid retained storage path` }, { status: 400 })
    }
    const selectedSourcePaths = selectedSourceDocuments.map(doc => doc.retained_storage_path)
    const inputTotalBytes = [
      ...selectedDocuments.map(doc => numericBytes(doc.file_size)),
      ...selectedSourceDocuments.map(doc => numericBytes(doc.file_size)),
    ].reduce((sum, bytes) => sum + bytes, 0)
    if (inputTotalBytes > MAX_SELECTED_BYTES) {
      return NextResponse.json({
        error: `Selected documents are too large for one re-underwrite run. Limit is ${(MAX_SELECTED_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
      }, { status: 400 })
    }

    if (requestedExecutionMode === 'async') {
      const queuedRun = await createQueuedReunderwriteRun(supabaseAdmin, {
        deal_id: id,
        base_run_id: baseRun.id,
        created_by: userId,
        input_source_paths: selectedSourcePaths,
        input_diligence_document_ids: selectedDiligenceIds,
        input_document_count: inputDocumentCount,
        input_total_bytes: inputTotalBytes,
        progress_step: 'queued',
        progress_message: 'Run queued for re-underwriting. It will remain queued until the Phase 8B worker is deployed.',
      })
      return NextResponse.json({
        status: 'queued',
        run_id: queuedRun.id,
        run: queuedRun,
        message: 'Run queued for re-underwriting',
      }, { status: 202 })
    }

    const railwayUrl = getServerBackendUrl()
    const run = await createRunningReunderwriteRun(supabaseAdmin, {
      deal_id: id,
      base_run_id: baseRun.id,
      created_by: userId,
      input_source_paths: selectedSourcePaths,
      input_diligence_document_ids: selectedDiligenceIds,
      input_document_count: inputDocumentCount,
      input_total_bytes: inputTotalBytes,
      progress_step: 'backend_request',
      progress_message: 'Sending selected documents for re-underwriting',
    })
    runId = run.id

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), BACKEND_REUNDERWRITE_TIMEOUT_MS)
    let backendRes: Response
    try {
      backendRes = await fetch(`${railwayUrl}/pipeline/reunderwrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          deal_id: id,
          run_id: run.id,
          base_run_id: baseRun.id,
          base: {
            extracted: baseRun.extracted,
            scored: baseRun.scored,
            workflow: baseRun.workflow,
          },
          selected_diligence_documents: selectedDocuments.map(doc => ({
            id: doc.id,
            storage_path: doc.storage_path,
            filename: doc.filename,
            document_type: doc.document_type,
            source_item_id: doc.source_item_id,
            file_size: doc.file_size,
          })),
          selected_source_documents: selectedSourceDocuments.map(doc => ({
            id: doc.id,
            storage_path: doc.retained_storage_path,
            filename: doc.filename,
            content_type: doc.content_type,
            source_kind: doc.source_kind,
            run_id: doc.run_id,
            file_size: doc.file_size,
          })),
          manual_evidence_notes: manualEvidenceNotes,
          input_document_count: inputDocumentCount,
          input_total_bytes: inputTotalBytes,
          pipeline_projects: Array.isArray(baseWorkflow.pipeline_projects) ? baseWorkflow.pipeline_projects : [],
          mode: 'reunderwrite',
        }),
      })
    } catch (fetchError) {
      const timedOut = fetchError instanceof Error && fetchError.name === 'AbortError'
      const detail = timedOut
        ? 'Backend re-underwrite timed out before completion. The candidate run was marked failed; try fewer documents or smaller files.'
        : fetchError instanceof Error ? fetchError.message : 'Backend re-underwrite request failed'
      await failUnderwritingRun(supabaseAdmin, run.id, detail, {
        progress_step: timedOut ? 'timeout' : 'failed',
        progress_message: detail,
      })
      return NextResponse.json({ error: detail, run_id: run.id }, { status: timedOut ? 504 : 502 })
    } finally {
      clearTimeout(timeout)
    }
    const backendBody = await backendRes.json().catch(() => ({}))
    if (!backendRes.ok) {
      const detail = typeof backendBody.detail === 'string' ? backendBody.detail : `Backend re-underwrite failed with HTTP ${backendRes.status}`
      await failUnderwritingRun(supabaseAdmin, run.id, detail, {
        progress_step: 'failed',
        progress_message: detail,
      })
      return NextResponse.json({ error: detail, run_id: run.id }, { status: backendRes.status })
    }

    const completed = await completeUnderwritingRun(supabaseAdmin, run.id, {
      extracted: backendBody.extracted,
      scored: backendBody.scored,
      workflow: backendBody.workflow,
      diff: backendBody.diff ?? null,
      progress_step: 'completed',
      progress_message: 'Run completed',
    })

    return NextResponse.json({ run: completed })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to re-underwrite deal'
    if (runId) {
      try {
        await failUnderwritingRun(supabaseAdmin, runId, message)
      } catch (failError) {
        const failMessage = failError instanceof Error ? failError.message : String(failError)
        console.error('Failed to mark underwriting run failed:', failMessage)
      }
    }
    return NextResponse.json({ error: message, run_id: runId }, { status: 500 })
  }
}
