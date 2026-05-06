import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dealHealthCheck } from '@/lib/dealOps'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function getUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')
  const { data } = await supabaseAuth.auth.getUser(token)
  return data.user?.id ?? null
}

async function getAccessibleDeal(id: string, userId: string) {
  const { data: profile } = await supabaseAdmin.from('profiles').select('org_id').eq('id', userId).maybeSingle()
  let query = supabaseAdmin.from('deals').select('id').eq('id', id)
  if (profile?.org_id) query = query.or(`user_id.eq.${userId},org_id.eq.${profile.org_id}`)
  else query = query.eq('user_id', userId)
  return query.maybeSingle()
}

function migrationMessage(error: { message?: string } | null) {
  if (!error?.message) return null
  if (/underwriting_runs|deal_source_documents|diligence_documents|evidence_requests|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Deal operations tables are not migrated yet. Apply the run/source/diligence/evidence request migrations and retry.'
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
    const health = await dealHealthCheck(supabaseAdmin, { dealId: id })
    return NextResponse.json({ health })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to run deal health check'
    const migration = migrationMessage(e instanceof Error ? e : null)
    return NextResponse.json({ error: migration ?? message }, { status: 500 })
  }
}
