import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/server'

const supabaseAuth  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: userData } = await supabaseAuth.auth.getUser(token)
    const user = userData.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get stripe customer id from subscription record
    const { data: sub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }

    const origin = req.headers.get('origin') ?? 'https://acquira.com.au'

    const session = await stripe.billingPortal.sessions.create({
      customer:   sub.stripe_customer_id,
      return_url: `${origin}/pricing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error('portal error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
