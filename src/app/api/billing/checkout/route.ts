import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, PLANS, type PlanKey } from '@/lib/stripe/server'

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: userData } = await supabaseAuth.auth.getUser(token)
    const user = userData.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { plan } = await req.json() as { plan: PlanKey }
    const planConfig = PLANS[plan]
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const origin = req.headers.get('origin') ?? 'https://acquira.com.au'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.priceId(), quantity: 1 }],
      customer_email: user.email,
      metadata: { user_id: user.id, plan },
      success_url: `${origin}/pricing?success=1&plan=${plan}`,
      cancel_url:  `${origin}/pricing?cancelled=1`,
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error('checkout error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
