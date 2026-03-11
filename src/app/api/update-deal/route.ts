import { NextRequest, NextResponse } from 'next/server'
import { updateDealScore } from '@/lib/deals'
import type { ScoredDeal } from '@/types/scored'

export async function POST(req: NextRequest) {
  try {
    const { id, scored, overrides } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const ok = await updateDealScore(id, scored as ScoredDeal, overrides ?? {})
    if (!ok) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
