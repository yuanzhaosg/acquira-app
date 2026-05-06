import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { DealWorkflow } from '@/types/workflow'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

async function getUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')
  const { data } = await supabaseAuth.auth.getUser(token)
  return data.user?.id ?? null
}

async function getAccessibleDeal(id: string, userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .maybeSingle()
  let query = supabaseAdmin
    .from('deals')
    .select('id, workflow')
    .eq('id', id)
  if (profile?.org_id) {
    query = query.or(`user_id.eq.${userId},org_id.eq.${profile.org_id}`)
  } else {
    query = query.eq('user_id', userId)
  }
  return query.maybeSingle()
}

function sortItems<T extends { priority?: string | null; category?: string | null; created_at?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority ?? 'medium'] ?? 1
    const pb = PRIORITY_ORDER[b.priority ?? 'medium'] ?? 1
    if (pa !== pb) return pa - pb
    const category = String(a.category ?? '').localeCompare(String(b.category ?? ''))
    if (category !== 0) return category
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
  })
}

function checklistFromWorkflow(workflow: DealWorkflow | null | undefined) {
  const items = workflow?.diligence_checklist ?? workflow?.diligence_requests ?? []
  return items.map((item, index) => ({
    workflow_item_id: item.id || `generated_${index + 1}`,
    category: item.category || 'diligence',
    question: item.question || item.request || 'Diligence request',
    request: item.request || item.question || null,
    why_it_matters: item.why_it_matters || null,
    priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
    status: ['not_requested', 'requested', 'received', 'verified', 'waived', 'rejected'].includes(item.status) ? item.status : 'not_requested',
    linked_fact_ids: item.linked_fact_ids ?? [],
    linked_evidence_ids: item.linked_evidence_ids ?? [],
  }))
}

function migrationMessage(error: { message?: string } | null) {
  if (!error?.message) return null
  if (/diligence_items|relation .* does not exist|schema cache/i.test(error.message)) {
    return 'Diligence workspace is not migrated yet. Apply the diligence_items Supabase migration and retry.'
  }
  return error.message
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { data: deal, error: dealError } = await getAccessibleDeal(id, userId)

    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const seedRows = checklistFromWorkflow(deal.workflow as DealWorkflow | null).map(item => ({
      ...item,
      deal_id: id,
    }))
    let seeded = false
    if (seedRows.length > 0) {
      const { error: seedError } = await supabaseAdmin
        .from('diligence_items')
        .upsert(seedRows, { onConflict: 'deal_id,workflow_item_id', ignoreDuplicates: true })
      const seedMigrationError = migrationMessage(seedError)
      if (seedMigrationError) return NextResponse.json({ error: seedMigrationError }, { status: 500 })
      if (seedError) return NextResponse.json({ error: seedError.message }, { status: 500 })
      seeded = true
    }

    const refreshed = await supabaseAdmin
      .from('diligence_items')
      .select('*')
      .eq('deal_id', id)

    const refreshedMigrationError = migrationMessage(refreshed.error)
    if (refreshedMigrationError) return NextResponse.json({ error: refreshedMigrationError }, { status: 500 })
    if (refreshed.error) return NextResponse.json({ error: refreshed.error.message }, { status: 500 })

    const items = refreshed.data ?? []
    return NextResponse.json({ items: sortItems(items), seeded })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load diligence items'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
