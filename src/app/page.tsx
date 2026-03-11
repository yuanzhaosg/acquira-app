'use client'

import { useState } from 'react'
import LandingPage from '@/components/landing/LandingPage'
import UnifiedNav from '@/components/nav/UnifiedNav'
import UploadWidget from '@/components/upload/UploadWidget'
import ReportView from '@/components/report/ReportView'
import DealList from '@/components/deals/DealList'
import { getDeal } from '@/lib/deals'
import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'

type View = 'landing' | 'upload' | 'report' | 'list'

export default function Home() {
  const [view, setView] = useState<View>('landing')
  const [extracted, setExtracted] = useState<ExtractedDeal | null>(null)
  const [scored, setScored] = useState<ScoredDeal | null>(null)
  const [dealId, setDealId] = useState<string | null>(null)

  // ── Landing ────────────────────────────────────────────
  if (view === 'landing') {
    return <LandingPage onGoToApp={() => setView('upload')} />
  }

  // ── Report ─────────────────────────────────────────────
  // ReportView has its own sticky header with logo + ← Pipeline + New Deal.
  if (view === 'report' && extracted && scored) {
    return (
      <ReportView
        extracted={extracted}
        scored={scored}
        dealId={dealId}
        onBack={() => setView('list')}
        onNew={() => setView('upload')}
      />
    )
  }

  // ── Pipeline / Deal List ───────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1b2a' }}>
        <UnifiedNav
          mode="app"
          activeAppTab="list"
          onLogoClick={() => setView('landing')}
          onUpload={() => setView('upload')}
          onPipeline={() => setView('list')}
          onHome={() => setView('landing')}
        />
        <DealList
          onOpen={async (id: string) => {
            const deal = await getDeal(id)
            if (deal) {
              setExtracted(deal.extracted as ExtractedDeal)
              setScored(deal.scored as ScoredDeal)
              setDealId(id)
              setView('report')
            }
          }}
          onNew={() => setView('upload')}
        />
      </div>
    )
  }

  // ── Upload ─────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', background: '#0d1b2a', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <UnifiedNav
        mode="app"
        activeAppTab="upload"
        onLogoClick={() => setView('landing')}
        onUpload={() => setView('upload')}
        onPipeline={() => setView('list')}
        onHome={() => setView('landing')}
      />

      {/* Upload hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 560 }}>
          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700, letterSpacing: '-0.02em',
            lineHeight: 1.1, marginBottom: 16,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Analyse a deal
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            Upload an IM or data room. Acquira extracts every metric and scores it across 10 dimensions in about 60 seconds.
          </p>
        </div>

        <UploadWidget
          onResult={(ext, sc, id) => {
            setExtracted(ext as ExtractedDeal)
            setScored(sc as ScoredDeal)
            setDealId(id || null)
            setView('report')
          }}
        />

        <div style={{ display: 'flex', gap: 20, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['PDF Information Memorandum', 'ZIP data room', 'Max 50MB', '~60 seconds'].map(t => (
            <span key={t} style={{
              fontSize: 11, color: 'rgba(255,255,255,0.2)',
              fontFamily: "'DM Mono', monospace",
            }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </main>
  )
}
