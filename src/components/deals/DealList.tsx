'use client'

import { useEffect, useState } from 'react'
import { listDeals, deleteDeal, type DealRecord } from '@/lib/deals'

// ── HELPERS ───────────────────────────────────────────────────────────────────
// v2: scores are 0–100

function resolveDisplayScore(deal: DealRecord): number | null {
  if (deal.total_score != null) return deal.total_score
  if (deal.overall_score != null) return deal.overall_score * 10  // v1 backfill
  return null
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 55) return '#00b4a0'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function scoreBg(score: number): string {
  if (score >= 70) return 'rgba(34,197,94,0.08)'
  if (score >= 55) return 'rgba(0,180,160,0.08)'
  if (score >= 40) return 'rgba(245,158,11,0.08)'
  return 'rgba(239,68,68,0.08)'
}

function fmtM(n: number | null | undefined): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function fmt(n: number | null | undefined, suffix = ''): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}${suffix}`
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────

export default function DealList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [deals, setDeals]     = useState<DealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [hovered, setHovered]   = useState<string | null>(null)

  useEffect(() => {
    listDeals().then(d => { setDeals(d); setLoading(false) })
  }, [])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this deal?')) return
    setDeleting(id)
    await deleteDeal(id)
    setDeals(prev => prev.filter(d => d.id !== id))
    setDeleting(null)
  }

  if (loading) return (
    <div style={{ padding: '80px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, letterSpacing: '0.1em' }}>
      LOADING DEALS…
    </div>
  )

  if (deals.length === 0) return (
    <div style={{ padding: '80px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.15 }}>📋</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No deals yet</div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, marginBottom: 28 }}>Upload an Information Memorandum to get started</div>
      <button onClick={onNew} style={{
        background: '#00b4a0', border: 'none', borderRadius: 8,
        padding: '10px 24px', color: '#0d1b2a', fontWeight: 700,
        fontSize: 14, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif'
      }}>+ Analyse Your First Deal</button>
    </div>
  )

  return (
    <div>
      <style>{`
        @media (max-width: 640px) {
          .deal-list-header { display: none !important; }
          .deal-list-row    { grid-template-columns: 1fr auto 32px !important; gap: 10px !important; padding: 14px 16px !important; }
          .deal-col-occ, .deal-col-ebitda, .deal-col-asking { display: none !important; }
        }
      `}</style>

      {/* Column headers */}
      <div className="deal-list-header" style={{
        display: 'grid', gridTemplateColumns: '1fr 72px 80px 90px 80px 36px',
        gap: 16, padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        fontFamily: 'IBM Plex Mono, monospace', fontSize: 10,
        color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.09em'
      }}>
        <span>Centre</span>
        <span style={{ textAlign: 'center' }}>Score</span>
        <span>Occupancy</span>
        <span>EBITDA</span>
        <span>Asking</span>
        <span />
      </div>

      {deals.map((deal, idx) => {
        const displayScore = resolveDisplayScore(deal)
        const color = scoreColor(displayScore ?? 0)
        const bg    = scoreBg(displayScore ?? 0)
        const isHovered = hovered === deal.id
        const hasCritical = deal.has_critical_flags
          ?? (deal.scored?.deal_breaker_flags?.flags?.some(f => f.triggered && f.severity === 'critical'))
          ?? false

        return (
          <div
            key={deal.id}
            className="deal-list-row"
            onClick={() => onOpen(deal.id)}
            onMouseEnter={() => setHovered(deal.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 72px 80px 90px 80px 36px',
              gap: 16, padding: '16px 24px',
              borderBottom: idx < deals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              cursor: 'pointer', alignItems: 'center',
              background: isHovered ? 'rgba(255,255,255,0.025)' : 'transparent',
              transition: 'background 0.15s'
            }}
          >
            {/* Centre info */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: '#e8edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deal.centre_name ?? '—'}
                </span>
                {/* Critical flag indicator */}
                {hasCritical && (
                  <span style={{
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 700,
                    color: '#ef4444', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap', flexShrink: 0
                  }}>
                    ⚑ CRITICAL
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {deal.state && (
                  <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: '#00b4a0', background: 'rgba(0,180,160,0.1)', padding: '1px 6px', borderRadius: 3 }}>
                    {deal.state}
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  {[deal.suburb, deal.licensed_places ? `${deal.licensed_places} places` : null].filter(Boolean).join(' · ')}
                </span>
              </div>
            </div>

            {/* Score — now 0–100 */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                background: bg, border: `1px solid ${color}22`,
                borderRadius: 8, padding: '6px 10px', minWidth: 52
              }}>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>
                  {displayScore != null ? displayScore.toFixed(1) : '—'}
                </span>
                <span style={{ fontSize: 9, color, fontFamily: 'IBM Plex Mono, monospace', marginTop: 2, letterSpacing: '0.04em' }}>
                  {deal.verdict ?? ''}
                </span>
              </div>
            </div>

            {/* Occupancy */}
            <div className="deal-col-occ" style={{ fontSize: 14, fontWeight: 500, color: (deal.occupancy_pct ?? 0) >= 65 ? '#00b4a0' : (deal.occupancy_pct ?? 0) >= 50 ? '#f59e0b' : '#ef4444' }}>
              {fmt(deal.occupancy_pct, '%')}
            </div>

            {/* EBITDA */}
            <div className="deal-col-ebitda" style={{ fontSize: 14, fontWeight: 500, color: (deal.ebitda ?? 0) > 0 ? 'rgba(255,255,255,0.8)' : '#ef4444' }}>
              {fmtM(deal.ebitda)}
            </div>

            {/* Asking */}
            <div className="deal-col-asking" style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
              {fmtM(deal.asking_price)}
            </div>

            {/* Delete */}
            <button
              onClick={e => handleDelete(deal.id, e)}
              disabled={deleting === deal.id}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: isHovered ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
                fontSize: 18, padding: 4, lineHeight: 1,
                transition: 'color 0.15s', borderRadius: 4
              }}
              title="Delete deal"
            >
              {deleting === deal.id ? '…' : '×'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
