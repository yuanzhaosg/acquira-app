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
  if (/evidence_request_documents|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Evidence request document linking is not migrated yet. Apply the evidence request document Supabase migration and retry.'
  }
  return error.message
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; requestId: string; documentId: string }> }) {
  try {
    const userId = await getUserId(_req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, requestId, documentId } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const { error: deleteError } = await supabaseAdmin
      .from('evidence_request_documents')
      .delete()
      .eq('deal_id', id)
      .eq('evidence_request_id', requestId)
      .eq('diligence_document_id', documentId)
    const deleteMigrationError = migrationMessage(deleteError)
    if (deleteMigrationError) return NextResponse.json({ error: deleteMigrationError }, { status: 500 })
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to unlink evidence request document'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
