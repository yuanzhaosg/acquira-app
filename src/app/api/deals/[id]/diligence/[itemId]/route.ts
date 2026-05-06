import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { DealWorkflow } from '@/types/workflow'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const VALID_STATUSES = ['not_requested', 'requested', 'received', 'verified', 'waived', 'rejected'] as const

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
    .select('id, workflow')
    .eq('id', id)
  if (profile?.org_id) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${profile.org_id}`)
  } else {
    query = query.eq('user_id', userId)
  }
  return query.maybeSingle()
}

function hasAllowedKey(body: Record<string, unknown>) {
  const allowed = new Set(['status', 'notes', 'owner', 'due_date', 'waiver_reason', 'rejection_reason'])
  return Object.keys(body).every(key => allowed.has(key))
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isLinkedToValuationBlocker(workflow: DealWorkflow | null | undefined, workflowItemId?: string | null) {
  if (!workflow || !workflowItemId) return false
  const checklist = workflow.diligence_checklist ?? workflow.diligence_requests ?? []
  const generated = checklist.find(item => item.id === workflowItemId)
  if (!generated) return false
  const blockerFields = new Set((workflow.valuation_gate?.blockers ?? []).map(blocker => blocker.field))
  return (generated.linked_fields ?? []).some(field => blockerFields.has(field))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, itemId } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)

    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const { data: item, error: itemError } = await supabaseAdmin
      .from('diligence_items')
      .select('*')
      .eq('id', itemId)
      .eq('deal_id', id)
      .maybeSingle()

    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })
    if (!item) return NextResponse.json({ error: 'Diligence item not found' }, { status: 404 })

    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 })
    }
    if (!hasAllowedKey(body as Record<string, unknown>)) {
      return NextResponse.json({ error: 'Only status, notes, owner, due_date, waiver_reason, and rejection_reason can be updated' }, { status: 400 })
    }
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No supported fields provided' }, { status: 400 })
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if ('status' in body) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
      }
      update.status = body.status
    }
    if ('notes' in body) update.notes = typeof body.notes === 'string' ? body.notes : null
    if ('owner' in body) {
      if (body.owner == null || body.owner === '') {
        update.owner = null
      } else if (body.owner === userId) {
        update.owner = userId
      } else {
        return NextResponse.json({ error: 'Owner must be the current user or null.' }, { status: 400 })
      }
    }
    if ('due_date' in body) {
      if (body.due_date == null || body.due_date === '') {
        update.due_date = null
      } else if (typeof body.due_date === 'string' && isValidDateString(body.due_date)) {
        update.due_date = body.due_date
      } else {
        return NextResponse.json({ error: 'due_date must be YYYY-MM-DD or null.' }, { status: 400 })
      }
    }
    if ('waiver_reason' in body) update.waiver_reason = typeof body.waiver_reason === 'string' ? body.waiver_reason : null
    if ('rejection_reason' in body) update.rejection_reason = typeof body.rejection_reason === 'string' ? body.rejection_reason : null

    const nextStatus = String(update.status ?? item.status)
    const nextWaiverReason = String(update.waiver_reason ?? item.waiver_reason ?? '').trim()
    const requiresWaiverReason =
      nextStatus === 'waived'
      && (item.priority === 'high' || isLinkedToValuationBlocker(deal.workflow as DealWorkflow | null, item.workflow_item_id))

    if (requiresWaiverReason && !nextWaiverReason) {
      return NextResponse.json({ error: 'Waiver reason is required for high-priority or valuation-blocking diligence items.' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('diligence_items')
      .update(update)
      .eq('id', itemId)
      .eq('deal_id', id)
      .select('*')
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json({ item: updated })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update diligence item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
