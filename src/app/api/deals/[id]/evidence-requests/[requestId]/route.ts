import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { EvidenceRequestPriority, EvidenceRequestStatus } from '@/types/evidenceRequests'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const STATUSES: EvidenceRequestStatus[] = ['draft', 'sent', 'received', 'waived', 'closed']
const PRIORITIES: EvidenceRequestPriority[] = ['high', 'medium', 'low']

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

function migrationMessage(error: { message?: string } | null) {
  if (!error?.message) return null
  if (/evidence_requests|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Evidence request tracking is not migrated yet. Apply the evidence_requests Supabase migration and retry.'
  }
  return error.message
}

function bodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function cleanText(value: unknown, maxLength = 4000): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return trimmed ? trimmed.slice(0, maxLength) : null
}

function cleanOptionalText(value: unknown, maxLength = 4000): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return cleanText(value, maxLength)
}

function cleanDate(value: unknown): string | null | undefined | 'invalid' {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'invalid'
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) ? value : 'invalid'
}

function cleanTimestamp(value: unknown): string | null | undefined | 'invalid' {
  if (value === undefined) return undefined
  if (value === true) return new Date().toISOString()
  if (value === null || value === '') return null
  if (typeof value !== 'string') return 'invalid'
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : 'invalid'
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, requestId } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('evidence_requests')
      .select('*')
      .eq('id', requestId)
      .eq('deal_id', id)
      .maybeSingle()
    const existingMigrationError = migrationMessage(existingError)
    if (existingMigrationError) return NextResponse.json({ error: existingMigrationError }, { status: 500 })
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'Evidence request not found' }, { status: 404 })

    const body = bodyRecord(await req.json().catch(() => ({})))
    const update: Record<string, string | null> = {}

    if ('title' in body) {
      const title = cleanOptionalText(body.title, 240)
      if (title === undefined) {
        // no-op
      } else if (!title) {
        return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
      } else {
        update.title = title
      }
    }
    if ('body' in body) {
      const requestBody = cleanOptionalText(body.body, 6000)
      if (requestBody === undefined) {
        // no-op
      } else if (!requestBody) {
        return NextResponse.json({ error: 'body cannot be empty' }, { status: 400 })
      } else {
        update.body = requestBody
      }
    }
    if ('status' in body) {
      if (!STATUSES.includes(body.status as EvidenceRequestStatus)) {
        return NextResponse.json({ error: 'status is invalid' }, { status: 400 })
      }
      update.status = body.status as EvidenceRequestStatus
      if (body.status === 'sent' && !existing.requested_at && !('requested_at' in body)) {
        update.requested_at = new Date().toISOString()
      }
    }
    if ('priority' in body) {
      if (!PRIORITIES.includes(body.priority as EvidenceRequestPriority)) {
        return NextResponse.json({ error: 'priority is invalid' }, { status: 400 })
      }
      update.priority = body.priority as EvidenceRequestPriority
    }
    if ('requested_from' in body) {
      const requestedFrom = cleanOptionalText(body.requested_from, 240)
      if (requestedFrom !== undefined) update.requested_from = requestedFrom
    }
    if ('requested_at' in body) {
      const requestedAt = cleanTimestamp(body.requested_at)
      if (requestedAt === 'invalid') return NextResponse.json({ error: 'requested_at must be a valid timestamp' }, { status: 400 })
      if (requestedAt !== undefined) update.requested_at = requestedAt
    }
    if ('due_date' in body) {
      const dueDate = cleanDate(body.due_date)
      if (dueDate === 'invalid') return NextResponse.json({ error: 'due_date must be YYYY-MM-DD' }, { status: 400 })
      if (dueDate !== undefined) update.due_date = dueDate
    }
    if ('copied_to_clipboard_at' in body) {
      const copiedAt = cleanTimestamp(body.copied_to_clipboard_at)
      if (copiedAt === 'invalid') {
        return NextResponse.json({ error: 'copied_to_clipboard_at must be a valid timestamp' }, { status: 400 })
      }
      if (copiedAt !== undefined) update.copied_to_clipboard_at = copiedAt
    }

    update.updated_at = new Date().toISOString()

    const { data: request, error: updateError } = await supabaseAdmin
      .from('evidence_requests')
      .update(update)
      .eq('id', requestId)
      .eq('deal_id', id)
      .select('*')
      .single()
    const updateMigrationError = migrationMessage(updateError)
    if (updateMigrationError) return NextResponse.json({ error: updateMigrationError }, { status: 500 })
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ request })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update evidence request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
