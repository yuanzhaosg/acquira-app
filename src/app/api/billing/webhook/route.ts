import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/server'
import Stripe from 'stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

// GET — Stripe URL validation
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const sig  = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret)
  } catch (e: any) {
    console.error('Webhook signature verification failed:', e.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await upsertSubscription(sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.user_id
        if (userId) {
          await supabaseAdmin
            .from('user_subscriptions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', sub.id)
        }
        break
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null }
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription)
          await upsertSubscription(sub)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null }
        if (invoice.subscription) {
          await supabaseAdmin
            .from('user_subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription)
        }
        break
      }
      default:
        // Unhandled event — return 200 anyway
        break
    }
  } catch (e: any) {
    console.error('Webhook handler error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function upsertSubscription(sub: Stripe.Subscription & { current_period_end?: number }) {
  const userId   = sub.metadata?.user_id
  const plan     = sub.metadata?.plan ?? sub.items.data[0]?.price?.nickname ?? null
  const rawPeriodEnd = (sub as any).current_period_end as number | undefined
  const periodEnd = rawPeriodEnd
    ? new Date(rawPeriodEnd * 1000).toISOString()
    : null

  if (!userId) {
    console.error('No user_id in subscription metadata', sub.id)
    return
  }

  await supabaseAdmin.from('user_subscriptions').upsert(
    {
      user_id:                 userId,
      stripe_subscription_id:  sub.id,
      stripe_customer_id:      sub.customer as string,
      plan,
      status:                  sub.status,
      current_period_end:      periodEnd,
      cancel_at_period_end:    (sub as any).cancel_at_period_end ?? false,
      updated_at:              new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' },
  )
}
