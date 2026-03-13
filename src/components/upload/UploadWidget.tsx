import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ReportView from '@/components/report/ReportView'
import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'

export const dynamic = 'force-dynamic'

// Anon client — reads from public_deal_shares view, no auth required
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  params: { token: string }
}

export default async function SharePage({ params }: Props) {
  const { data, error } = await anonClient
    .from('public_deal_shares')
    .select('id, share_token, centre_name, address, total_score, status, created_at, extracted, scored')
    .eq('share_token', params.token)
    .single()

  if (error || !data) notFound()

  const extracted = data.extracted as ExtractedDeal
  const scored    = data.scored    as ScoredDeal

  if (!extracted || !scored) notFound()

  return (
    <div style={{ background: '#0d1b2a', minHeight: '100vh' }}>
      {/* Read-only banner */}
      <div style={{
        background: 'rgba(0,180,160,0.1)',
        borderBottom: '1px solid rgba(0,180,160,0.2)',
        padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13,
      }}>
        <span style={{ color: '#00b4a0', fontWeight: 600 }}>
          🔗 Shared Report — read only
        </span>
        <a
          href="/"
          style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 12 }}
        >
          Score your own deal →
        </a>
      </div>

      {/* ReportView — correct props, no onBack/onNew (read-only context) */}
      <ReportView
        extracted={extracted}
        scored={scored}
        dealId={data.id}
      />
    </div>
  )
}
