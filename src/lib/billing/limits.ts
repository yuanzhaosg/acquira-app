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
  cancel_at_period_end: boolean
  deals_used: number
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

export interface DealLimitResult {
  allowed: boolean
  reason?: string
  dealsUsed: number
  dealsMax: number | null
}

export async function canCreateDeal(userId: string): Promise<DealLimitResult> {
  const sub = await getUserSubscription(userId)

  // No subscription → treat as free / no deals
  if (!sub || !sub.status || sub.status !== 'active') {
    return {
      allowed: false,
      reason: 'No active subscription. Please subscribe to create deals.',
      dealsUsed: 0,
      dealsMax: 0,
    }
  }

  const plan      = sub.plan ?? 'starter'
  const dealsMax  = PLAN_LIMITS[plan] ?? 5
  const dealsUsed = sub.deals_used ?? 0

  if (dealsMax === null) {
    // Unlimited plan
    return { allowed: true, dealsUsed, dealsMax: null }
  }

  if (dealsUsed >= dealsMax) {
    return {
      allowed: false,
      reason: `You have used all ${dealsMax} deal${dealsMax === 1 ? '' : 's'} on your ${plan} plan. Upgrade to continue.`,
      dealsUsed,
      dealsMax,
    }
  }

  return { allowed: true, dealsUsed, dealsMax }
}

export async function incrementDealsUsed(userId: string): Promise<void> {
  const sub = await getUserSubscription(userId)
  if (!sub) return

  await supabaseAdmin
    .from('user_subscriptions')
    .update({ deals_used: (sub.deals_used ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
}
