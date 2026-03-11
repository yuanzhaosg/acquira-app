import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Deal } from '@/types/scored'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client — use in React components
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server client — use in API routes and server components
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {}
      },
    },
  })
}

// ── DEAL HELPERS ──

export async function createDeal(
  supabase: ReturnType<typeof createBrowserClient>,
  data: Partial<Deal>
) {
  const { data: deal, error } = await supabase
    .from('deals')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return deal
}

export async function updateDeal(
  supabase: ReturnType<typeof createBrowserClient>,
  id: string,
  data: Partial<Deal>
) {
  const { data: deal, error } = await supabase
    .from('deals')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return deal
}

export async function getDeal(
  supabase: ReturnType<typeof createBrowserClient>,
  id: string
) {
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      deal_scores(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function listDeals(
  supabase: ReturnType<typeof createBrowserClient>
) {
  const { data, error } = await supabase
    .from('deals')
    .select(`
      id, created_at, centre_name, address, state, status, source_type,
      deal_scores(overall_score, score_capped, hard_flags, overall_verdict)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function saveScore(
  supabase: ReturnType<typeof createBrowserClient>,
  dealId: string,
  scored: object
) {
  const { data, error } = await supabase
    .from('deal_scores')
    .insert({ deal_id: dealId, ...scored })
    .select()
    .single()
  if (error) throw error
  return data
}
