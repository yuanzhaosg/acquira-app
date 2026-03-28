import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

const PLAN_LIMITS: Record<string, number | null> = {
  starter:      5,
  professional: 25,
  firm:         null, // unlimited
}

export interface Subscription {
  id: string
  user_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  plan: string | null
  status: string | null
  current_period_end: string | null
  deals_used: number
  deals_period_start: string | null
  cancel_at_period_end: boolean
}

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('getUserSubscription error:', error.message)
    return null
  }
  return data as Subscription | null
}

/**
 * Reset deals_used if we've rolled into a new billing period.
 * Called before every canCreateDeal check.
 */
async function resetIfNewPeriod(sub: Subscription): Promise<Subscription> {
  if (!sub.current_period_end) return sub

  const periodEnd = new Date(sub.current_period_end)
  const now = new Date()

  // If current_period_end is in the past, Stripe should have updated it via webhook.
  // As a safety net: if deals_period_start is older than 32 days, reset.
  const periodStart = sub.deals_period_start ? new Date(sub.deals_period_start) : null
  const daysSincePeriodStart = periodStart
    ? (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    : 999

  if (daysSincePeriodStart > 32) {
    const updated = {
      deals_used: 0,
      deals_period_start: now.toISOString(),
      updated_at: now.toISOString(),
    }
    await supabaseAdmin
      .from('user_subscriptions')
      .update(updated)
      .eq('id', sub.id)
    return { ...sub, deals_used: 0, deals_period_start: now.toISOString() }
  }

  return sub
}

export interface DealLimitResult {
  allowed: boolean
  reason?: string
  dealsUsed: number
  dealsMax: number | null
}

export async function canCreateDeal(userId: string): Promise<DealLimitResult> {
  let sub = await getUserSubscription(userId)

  // No subscription → block
  if (!sub || !sub.status || sub.status !== 'active') {
    return {
      allowed: false,
      reason: 'No active subscription. Please subscribe to create deals.',
      dealsUsed: 0,
      dealsMax: 0,
    }
  }

  // Reset monthly if needed
  sub = await resetIfNewPeriod(sub)

  const plan      = sub.plan ?? 'starter'
  const dealsMax  = PLAN_LIMITS[plan] ?? 5
  const dealsUsed = sub.deals_used ?? 0

  if (dealsMax === null) {
    return { allowed: true, dealsUsed, dealsMax: null }
  }

  if (dealsUsed >= dealsMax) {
    return {
      allowed: false,
      reason: `You've used all ${dealsMax} deal${dealsMax === 1 ? '' : 's'} this month on your ${plan} plan. Upgrade or wait until next billing cycle.`,
      dealsUsed,
      dealsMax,
    }
  }

  return { allowed: true, dealsUsed, dealsMax }
}

export async function incrementDealsUsed(userId: string): Promise<void> {
  const sub = await getUserSubscription(userId)
  if (!sub) return

  const now = new Date().toISOString()
  await supabaseAdmin
    .from('user_subscriptions')
    .update({
      deals_used: (sub.deals_used ?? 0) + 1,
      deals_period_start: sub.deals_period_start ?? now,
      updated_at: now,
    })
    .eq('user_id', userId)
}
