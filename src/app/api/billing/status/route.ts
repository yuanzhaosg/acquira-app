import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserSubscription } from '@/lib/billing/limits'

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const PLAN_LIMITS: Record<string, number | null> = {
  starter:      5,
  professional: 25,
  firm:         null,
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: userData } = await supabaseAuth.auth.getUser(token)
    const user = userData.user
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sub = await getUserSubscription(user.id)

    if (!sub || sub.status !== 'active') {
      return NextResponse.json({
        plan:          null,
        status:        sub?.status ?? null,
        dealsUsed:     0,
        dealsMax:      0,
        dealsRemaining: 0,
      })
    }

    const plan     = sub.plan ?? 'starter'
    const dealsMax = PLAN_LIMITS[plan] ?? 5
    const dealsUsed = sub.deals_used ?? 0
    const dealsRemaining = dealsMax === null ? null : Math.max(0, dealsMax - dealsUsed)

    return NextResponse.json({
      plan,
      status:        sub.status,
      dealsUsed,
      dealsMax,
      dealsRemaining,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
