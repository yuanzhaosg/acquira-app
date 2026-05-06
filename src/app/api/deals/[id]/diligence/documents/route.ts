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
  if (/diligence_documents|evidence_links|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Diligence document storage is not migrated yet. Apply the diligence_documents Supabase migration and retry.'
  }
  return error.message
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

function isValidDiligencePath(storagePath: string, dealId: string): boolean {
  const prefix = `diligence/${dealId}/`
  if (!storagePath.startsWith(prefix)) return false
  const filename = storagePath.slice(prefix.length)
  if (!filename || filename.length > 280) return false
  if (filename.includes('/') || filename.includes('\\')) return false
  if (filename === '.' || filename === '..' || filename.includes('..')) return false
  if (/[\u0000-\u001f\u007f]/.test(filename)) return false
  return true
}

function parseFileSize(value: unknown): number | null | 'invalid' {
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'invalid'
  return Math.round(value)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const { data: documents, error: docsError } = await supabaseAdmin
      .from('diligence_documents')
      .select('*')
      .eq('deal_id', id)
      .order('created_at', { ascending: false })
    const docsMigrationError = migrationMessage(docsError)
    if (docsMigrationError) return NextResponse.json({ error: docsMigrationError }, { status: 500 })
    if (docsError) return NextResponse.json({ error: docsError.message }, { status: 500 })

    const { data: links, error: linksError } = await supabaseAdmin
      .from('evidence_links')
      .select('*')
      .eq('deal_id', id)
      .order('created_at', { ascending: false })
    const linksMigrationError = migrationMessage(linksError)
    if (linksMigrationError) return NextResponse.json({ error: linksMigrationError }, { status: 500 })
    if (linksError) return NextResponse.json({ error: linksError.message }, { status: 500 })

    return NextResponse.json({ documents: documents ?? [], links: links ?? [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load diligence documents'
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

    const body = await req.json()
    const storagePath = cleanText(body.storage_path)
    const filename = cleanFilename(body.filename)
    if (!storagePath || !filename) {
      return NextResponse.json({ error: 'storage_path and filename are required' }, { status: 400 })
    }
    if (!isValidDiligencePath(storagePath, id)) {
      return NextResponse.json({ error: 'storage_path must be a sanitized file under the deal diligence prefix' }, { status: 400 })
    }

    const sourceItemId = cleanText(body.source_item_id)
    if (sourceItemId) {
      const { data: item, error: itemError } = await supabaseAdmin
        .from('diligence_items')
        .select('id, linked_document_ids')
        .eq('id', sourceItemId)
        .eq('deal_id', id)
        .maybeSingle()
      if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })
      if (!item) return NextResponse.json({ error: 'source_item_id does not belong to this deal' }, { status: 400 })
    }

    const fileSize = parseFileSize(body.file_size)
    if (fileSize === 'invalid') {
      return NextResponse.json({ error: 'file_size must be a non-negative number when provided' }, { status: 400 })
    }
    const insertDoc = {
      deal_id: id,
      uploaded_by: userId,
      storage_path: storagePath,
      filename,
      mime_type: cleanText(body.mime_type),
      file_size: fileSize,
      document_type: cleanText(body.document_type),
      source_item_id: sourceItemId,
      extraction_status: 'uploaded',
      metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {},
    }

    const { data: document, error: docError } = await supabaseAdmin
      .from('diligence_documents')
      .insert(insertDoc)
      .select('*')
      .single()
    const docMigrationError = migrationMessage(docError)
    if (docMigrationError) return NextResponse.json({ error: docMigrationError }, { status: 500 })
    if (docError) return NextResponse.json({ error: docError.message }, { status: 500 })

    let link = null
    if (sourceItemId && document) {
      const { data: insertedLink, error: linkError } = await supabaseAdmin
        .from('evidence_links')
        .insert({
          deal_id: id,
          diligence_item_id: sourceItemId,
          document_id: document.id,
          run_id: deal.current_run_id ?? null,
          link_type: 'supports',
        })
        .select('*')
        .single()
      const linkMigrationError = migrationMessage(linkError)
      if (linkMigrationError) {
        await supabaseAdmin.from('diligence_documents').delete().eq('id', document.id).eq('deal_id', id)
        return NextResponse.json({ error: linkMigrationError }, { status: 500 })
      }
      if (linkError) {
        await supabaseAdmin.from('diligence_documents').delete().eq('id', document.id).eq('deal_id', id)
        return NextResponse.json({ error: linkError.message }, { status: 500 })
      }
      link = insertedLink

      const { data: item } = await supabaseAdmin
        .from('diligence_items')
        .select('linked_document_ids')
        .eq('id', sourceItemId)
        .eq('deal_id', id)
        .maybeSingle()
      const linkedIds = Array.isArray(item?.linked_document_ids) ? item.linked_document_ids : []
      await supabaseAdmin
        .from('diligence_items')
        .update({ linked_document_ids: Array.from(new Set([...linkedIds, document.id])) })
        .eq('id', sourceItemId)
        .eq('deal_id', id)
    }

    return NextResponse.json({ document, link })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save diligence document'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
