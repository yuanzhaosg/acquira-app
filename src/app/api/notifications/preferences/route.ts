/**
 * Notification preferences stub.
 * TODO: Store in Supabase user_preferences table when created.
 * Migration SQL:
 *   CREATE TABLE IF NOT EXISTS user_preferences (
 *     user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *     preferences JSONB DEFAULT '{}',
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Users manage own prefs" ON user_preferences USING (auth.uid() = user_id);
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

async function getUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')
  const { data } = await supabaseAuth.auth.getUser(token)
  return data.user?.id ?? null
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // TODO: fetch from user_preferences table
  // const { data } = await supabaseAdmin.from('user_preferences').select('preferences').eq('user_id', userId).maybeSingle()
  // return NextResponse.json(data?.preferences ?? {})

  return NextResponse.json({
    weekly_digest:     true,
    competitor_alerts: false,
    deal_score_updates: true,
    new_deal_reminders: false,
    _stub: true,
    _note: 'TODO: Implement user_preferences Supabase table to persist these server-side.',
  })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prefs = await req.json()

  // TODO: upsert to user_preferences table
  // await supabaseAdmin.from('user_preferences').upsert({ user_id: userId, preferences: prefs, updated_at: new Date().toISOString() })

  void supabaseAdmin // keep import used for when this is wired up
  void prefs

  return NextResponse.json({ ok: true, _stub: true, _note: 'Preferences received but not persisted. Add user_preferences table to activate.' })
}
