import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { UnderwritingRunSummary } from '@/types/runs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

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
    .select('id')
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

function nestedRecord(value: unknown, key: string): Record<string, unknown> {
  return asRecord(asRecord(value)[key])
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function runSummary(row: Record<string, unknown>): UnderwritingRunSummary {
  const scored = asRecord(row.scored)
  const workflow = asRecord(row.workflow)
  const valuationGate = nestedRecord(workflow, 'valuation_gate')
  const narrativeGuard = nestedRecord(workflow, 'narrative_guard')
  const nextSteps = nestedRecord(scored, 'next_steps')
  const verdict = nestedRecord(scored, 'verdict')
  const totalScore = numberValue(scored.total_score) ?? (
    numberValue(scored.overall_score) != null ? numberValue(scored.overall_score)! * 10 : null
  )

  return {
    id: String(row.id),
    deal_id: String(row.deal_id),
    run_number: Number(row.run_number),
    run_type: row.run_type as UnderwritingRunSummary['run_type'],
    status: row.status as UnderwritingRunSummary['status'],
    trigger: row.trigger as UnderwritingRunSummary['trigger'],
    base_run_id: stringValue(row.base_run_id),
    created_at: String(row.created_at),
    queued_at: stringValue(row.queued_at),
    claimed_at: stringValue(row.claimed_at),
    worker_id: stringValue(row.worker_id),
    cancel_requested_at: stringValue(row.cancel_requested_at),
    completed_at: stringValue(row.completed_at),
    started_at: stringValue(row.started_at),
    promoted_at: stringValue(row.promoted_at),
    is_current: row.is_current === true,
    error_message: stringValue(row.error_message),
    input_source_count: Array.isArray(row.input_source_paths) ? row.input_source_paths.length : 0,
    input_diligence_document_count: Array.isArray(row.input_diligence_document_ids) ? row.input_diligence_document_ids.length : 0,
    input_document_count: numberValue(row.input_document_count),
    input_total_bytes: numberValue(row.input_total_bytes),
    progress_message: stringValue(row.progress_message),
    progress_step: stringValue(row.progress_step),
    execution_mode: stringValue(row.execution_mode) as UnderwritingRunSummary['execution_mode'],
    retry_count: numberValue(row.retry_count) ?? 0,
    last_error_at: stringValue(row.last_error_at),
    total_score: totalScore,
    valuation_gate_status: stringValue(valuationGate.status),
    recommendation:
      stringValue(narrativeGuard.recommendation)
      ?? stringValue(nextSteps.verdict_plain)
      ?? stringValue(verdict.one_liner),
  }
}

function migrationMessage(error: { message?: string } | null) {
  if (!error?.message) return null
  if (/underwriting_runs|current_run_id|queued_at|claimed_at|worker_id|cancel_requested_at|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Underwriting run history is not migrated yet. Apply the underwriting_runs Supabase migration and retry.'
  }
  return error.message
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const { data: runs, error: runsError } = await supabaseAdmin
      .from('underwriting_runs')
      .select('id, deal_id, run_number, run_type, status, trigger, base_run_id, input_source_paths, input_diligence_document_ids, scored, workflow, error_message, created_at, queued_at, claimed_at, worker_id, cancel_requested_at, started_at, completed_at, promoted_at, is_current, execution_mode, input_document_count, input_total_bytes, progress_message, progress_step, retry_count, last_error_at')
      .eq('deal_id', id)
      .order('run_number', { ascending: false })
      .order('created_at', { ascending: false })

    const runMigrationError = migrationMessage(runsError)
    if (runMigrationError) return NextResponse.json({ error: runMigrationError }, { status: 500 })
    if (runsError) return NextResponse.json({ error: runsError.message }, { status: 500 })

    return NextResponse.json({ runs: (runs ?? []).map(row => runSummary(row as Record<string, unknown>)) })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load underwriting runs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
