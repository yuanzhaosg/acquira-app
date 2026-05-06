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
  if (/underwriting_runs|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Underwriting run history is not migrated yet. Apply the underwriting_runs Supabase migration and retry.'
  }
  return error.message
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, runId } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const { data: run, error: runError } = await supabaseAdmin
      .from('underwriting_runs')
      .select('*')
      .eq('id', runId)
      .eq('deal_id', id)
      .maybeSingle()

    const runMigrationError = migrationMessage(runError)
    if (runMigrationError) return NextResponse.json({ error: runMigrationError }, { status: 500 })
    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })
    if (!run) return NextResponse.json({ error: 'Underwriting run not found' }, { status: 404 })

    return NextResponse.json({ run })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load underwriting run'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
