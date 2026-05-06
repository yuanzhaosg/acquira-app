import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

function migrationMessage(error: { message?: string } | null) {
  if (!error?.message) return null
  if (/evidence_requests|evidence_request_documents|diligence_documents|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Evidence request document linking is not migrated yet. Apply the evidence request document Supabase migration and retry.'
  }
  return error.message
}

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : null
}

function uniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(cleanId).filter((id): id is string => Boolean(id))))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, requestId } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const { data: request, error: requestError } = await supabaseAdmin
      .from('evidence_requests')
      .select('id')
      .eq('id', requestId)
      .eq('deal_id', id)
      .maybeSingle()
    const requestMigrationError = migrationMessage(requestError)
    if (requestMigrationError) return NextResponse.json({ error: requestMigrationError }, { status: 500 })
    if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 })
    if (!request) return NextResponse.json({ error: 'Evidence request not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const documentIds = uniqueIds(body.diligence_document_ids)
    if (!documentIds.length) {
      return NextResponse.json({ error: 'diligence_document_ids must include at least one document id' }, { status: 400 })
    }

    const { data: documents, error: docsError } = await supabaseAdmin
      .from('diligence_documents')
      .select('id, filename, document_type, created_at, file_size')
      .eq('deal_id', id)
      .in('id', documentIds)
    const docsMigrationError = migrationMessage(docsError)
    if (docsMigrationError) return NextResponse.json({ error: docsMigrationError }, { status: 500 })
    if (docsError) return NextResponse.json({ error: docsError.message }, { status: 500 })
    if ((documents ?? []).length !== documentIds.length) {
      return NextResponse.json({ error: 'One or more diligence documents do not belong to this deal' }, { status: 400 })
    }

    const rows = documentIds.map(documentId => ({
      deal_id: id,
      evidence_request_id: requestId,
      diligence_document_id: documentId,
      linked_by: userId,
    }))
    const { error: insertError } = await supabaseAdmin
      .from('evidence_request_documents')
      .upsert(rows, { onConflict: 'evidence_request_id,diligence_document_id', ignoreDuplicates: true })
    const insertMigrationError = migrationMessage(insertError)
    if (insertMigrationError) return NextResponse.json({ error: insertMigrationError }, { status: 500 })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ documents: documents ?? [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to link evidence request documents'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
