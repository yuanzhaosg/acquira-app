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
  if (/deal_source_documents|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Source document storage is not migrated yet. Apply the deal_source_documents Supabase migration and retry.'
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

    const { data: sourceDocuments, error } = await supabaseAdmin
      .from('deal_source_documents')
      .select('id, deal_id, run_id, filename, content_type, file_size, source_kind, retained_storage_path, created_at')
      .eq('deal_id', id)
      .order('created_at', { ascending: false })

    const sourceDocsMigrationError = migrationMessage(error)
    if (sourceDocsMigrationError) return NextResponse.json({ error: sourceDocsMigrationError }, { status: 500 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ source_documents: sourceDocuments ?? [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load source documents'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
