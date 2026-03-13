import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// Service-role client — bypasses RLS for server-side reads/writes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Helper: verify the bearer token and return the user id, or null
async function getUserId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user.id
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dealId } = await req.json()
  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })

  // Verify this deal belongs to the calling user
  const { data: deal, error: fetchErr } = await supabaseAdmin
    .from('deals')
    .select('id, share_token')
    .eq('id', dealId)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Return existing token or mint a new one
  const token = deal.share_token ?? randomBytes(18).toString('base64url')

  if (!deal.share_token) {
    const { error: updateErr } = await supabaseAdmin
      .from('deals')
      .update({ share_token: token })
      .eq('id', dealId)

    if (updateErr) return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}`
  return NextResponse.json({ shareUrl, token })
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dealId } = await req.json()
  if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('deals')
    .update({ share_token: null })
    .eq('id', dealId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
