import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { EvidenceRequestPriority, EvidenceRequestStatus, EvidenceRequestType } from '@/types/evidenceRequests'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const REQUEST_TYPES: EvidenceRequestType[] = ['valuation_blocker', 'diligence_item', 'market_gap', 'pipeline_gap', 'other']
const PRIORITIES: EvidenceRequestPriority[] = ['high', 'medium', 'low']
const STATUS_ORDER: Record<EvidenceRequestStatus, number> = {
  draft: 0,
  sent: 1,
  received: 2,
  waived: 3,
  closed: 4,
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

function migrationMessage(error: { message?: string } | null) {
  if (!error?.message) return null
  if (/evidence_requests|evidence_request_documents|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Evidence request tracking is not migrated yet. Apply the evidence_requests Supabase migration and retry.'
  }
  return error.message
}

function cleanText(value: unknown, maxLength = 4000): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return trimmed ? trimmed.slice(0, maxLength) : null
}

function cleanDate(value: unknown): string | null | 'invalid' {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'invalid'
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) ? value : 'invalid'
}

function cleanUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : null
}

function bodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function sortRequests<T extends { status?: string | null; created_at?: string | null }>(requests: T[]): T[] {
  return [...requests].sort((a, b) => {
    const sa = STATUS_ORDER[(a.status ?? 'draft') as EvidenceRequestStatus] ?? 99
    const sb = STATUS_ORDER[(b.status ?? 'draft') as EvidenceRequestStatus] ?? 99
    if (sa !== sb) return sa - sb
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  })
}

function withLinkedDocuments(
  requests: Record<string, unknown>[],
  links: Record<string, unknown>[],
  documents: Record<string, unknown>[],
): Array<Record<string, unknown> & { status?: string | null; created_at?: string | null }> {
  const documentsById = new Map(documents.map(doc => [String(doc.id), doc]))
  const linksByRequest = new Map<string, Record<string, unknown>[]>()
  for (const link of links) {
    const requestId = String(link.evidence_request_id)
    linksByRequest.set(requestId, [...(linksByRequest.get(requestId) ?? []), link])
  }
  return requests.map(request => {
    const requestLinks = linksByRequest.get(String(request.id)) ?? []
    const linkedDocuments = requestLinks
      .map(link => documentsById.get(String(link.diligence_document_id)))
      .filter((doc): doc is Record<string, unknown> => Boolean(doc))
      .map(doc => ({
        id: String(doc.id),
        filename: String(doc.filename ?? 'Untitled document'),
        document_type: typeof doc.document_type === 'string' ? doc.document_type : null,
        created_at: typeof doc.created_at === 'string' ? doc.created_at : null,
        file_size: typeof doc.file_size === 'number' ? doc.file_size : null,
      }))
    return {
      ...request,
      linked_document_ids: linkedDocuments.map(doc => doc.id),
      linked_document_count: linkedDocuments.length,
      linked_documents: linkedDocuments,
    }
  })
}

async function validateRunForDeal(runId: string | null, dealId: string) {
  if (!runId) return true
  const { data, error } = await supabaseAdmin
    .from('underwriting_runs')
    .select('id')
    .eq('id', runId)
    .eq('deal_id', dealId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

async function validateDiligenceItemForDeal(itemId: string | null, dealId: string) {
  if (!itemId) return true
  const { data, error } = await supabaseAdmin
    .from('diligence_items')
    .select('id')
    .eq('id', itemId)
    .eq('deal_id', dealId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const { data: requests, error: requestsError } = await supabaseAdmin
      .from('evidence_requests')
      .select('*')
      .eq('deal_id', id)
      .order('created_at', { ascending: false })
    const requestMigrationError = migrationMessage(requestsError)
    if (requestMigrationError) return NextResponse.json({ error: requestMigrationError }, { status: 500 })
    if (requestsError) return NextResponse.json({ error: requestsError.message }, { status: 500 })

    const { data: links, error: linksError } = await supabaseAdmin
      .from('evidence_request_documents')
      .select('evidence_request_id, diligence_document_id')
      .eq('deal_id', id)
    const linksMigrationError = migrationMessage(linksError)
    if (linksMigrationError) return NextResponse.json({ error: linksMigrationError }, { status: 500 })
    if (linksError) return NextResponse.json({ error: linksError.message }, { status: 500 })

    const documentIds = Array.from(new Set((links ?? []).map(link => String(link.diligence_document_id)).filter(Boolean)))
    let documents: Record<string, unknown>[] = []
    if (documentIds.length) {
      const { data: docs, error: docsError } = await supabaseAdmin
        .from('diligence_documents')
        .select('id, filename, document_type, created_at, file_size')
        .eq('deal_id', id)
        .in('id', documentIds)
      const docsMigrationError = migrationMessage(docsError)
      if (docsMigrationError) return NextResponse.json({ error: docsMigrationError }, { status: 500 })
      if (docsError) return NextResponse.json({ error: docsError.message }, { status: 500 })
      documents = (docs ?? []) as Record<string, unknown>[]
    }

    return NextResponse.json({
      requests: sortRequests(withLinkedDocuments(
        (requests ?? []) as Record<string, unknown>[],
        (links ?? []) as Record<string, unknown>[],
        documents,
      )),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load evidence requests'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const body = bodyRecord(await req.json().catch(() => ({})))
    const title = cleanText(body.title, 240)
    const requestBody = cleanText(body.body, 6000)
    const requestType = REQUEST_TYPES.includes(body.request_type as EvidenceRequestType)
      ? body.request_type as EvidenceRequestType
      : null
    const priority = PRIORITIES.includes(body.priority as EvidenceRequestPriority)
      ? body.priority as EvidenceRequestPriority
      : 'medium'
    const runId = cleanUuid(body.run_id)
    const diligenceItemId = cleanUuid(body.diligence_item_id)
    const dueDate = cleanDate(body.due_date)

    if (!title || !requestBody || !requestType) {
      return NextResponse.json({ error: 'title, body, and valid request_type are required' }, { status: 400 })
    }
    if (body.run_id && !runId) return NextResponse.json({ error: 'run_id must be a valid UUID' }, { status: 400 })
    if (body.diligence_item_id && !diligenceItemId) return NextResponse.json({ error: 'diligence_item_id must be a valid UUID' }, { status: 400 })
    if (dueDate === 'invalid') return NextResponse.json({ error: 'due_date must be YYYY-MM-DD' }, { status: 400 })
    if (!(await validateRunForDeal(runId, id))) return NextResponse.json({ error: 'run_id does not belong to this deal' }, { status: 400 })
    if (!(await validateDiligenceItemForDeal(diligenceItemId, id))) {
      return NextResponse.json({ error: 'diligence_item_id does not belong to this deal' }, { status: 400 })
    }

    const { data: request, error: insertError } = await supabaseAdmin
      .from('evidence_requests')
      .insert({
        deal_id: id,
        run_id: runId,
        diligence_item_id: diligenceItemId,
        request_type: requestType,
        title,
        body: requestBody,
        status: 'draft',
        priority,
        requested_from: cleanText(body.requested_from, 240),
        due_date: dueDate,
        created_by: userId,
      })
      .select('*')
      .single()
    const insertMigrationError = migrationMessage(insertError)
    if (insertMigrationError) return NextResponse.json({ error: insertMigrationError }, { status: 500 })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ request })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create evidence request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
