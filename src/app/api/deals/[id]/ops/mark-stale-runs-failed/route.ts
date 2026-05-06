import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { markStaleRunningRunsFailed } from '@/lib/dealOps'

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

function bodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function minuteValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 60
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
    const dryRun = body.dry_run !== false || body.confirm !== true
    const result = await markStaleRunningRunsFailed(supabaseAdmin, {
      dealId: id,
      olderThanMinutes: minuteValue(body.older_than_minutes),
      dryRun,
    })
    return NextResponse.json({ ...result, mutated: !dryRun })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to mark stale runs failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
