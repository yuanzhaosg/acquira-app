'use client'

import { useState } from 'react'
import UnifiedNav from '@/components/nav/UnifiedNav'
import type { User } from '@supabase/supabase-js'

const ZONE_CONFIG = {
  undersupplied: { label: 'Undersupplied', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', desc: 'Strong demand relative to supply — favourable for operators.' },
  balanced:      { label: 'Balanced',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', desc: 'Demand and supply roughly matched — monitor pipeline carefully.' },
  oversupplied:  { label: 'Oversupplied',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  desc: 'More licensed places than catchment demand — pricing pressure and occupancy risk.' },
} as const

interface SupplyMapPageProps {
  user: User | null
  onLogoClick: () => void
  onUpload: () => void
  onPipeline: () => void
}

export default function SupplyMapPage({ user, onLogoClick, onUpload, onPipeline }: SupplyMapPageProps) {
  const [tab, setTab]           = useState<'address' | 'postcode'>('address')
  const [input, setInput]       = useState('')
  const [postcode, setPostcode] = useState('')
  const [state, setState]       = useState('VIC')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<any>(null)
  const [error, setError]       = useState<string | null>(null)
  const [focused, setFocused]   = useState<string | null>(null)

  async function handleSearch() {
    const query = tab === 'address' ? input.trim() : `${postcode.trim()} ${state}`
    if (!query) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/map-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: query, suburb: query,
          state: tab === 'postcode' ? state : '',
          postcode: tab === 'postcode' ? postcode : '',
          licensed_places: 0,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Could not find this location. Try a suburb name or postcode.')
        return
      }
      setResult(await res.json())
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const zoneConfig = result ? ZONE_CONFIG[result.demand.zone as keyof typeof ZONE_CONFIG] : null

  return (
    <div style={{ minHeight: '100vh', background: '#0d1b2a', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@600;700;800;900&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <UnifiedNav
        mode="app"
        activeAppTab="upload"
        onLogoClick={onLogoClick}
        onUpload={onUpload}
        onPipeline={onPipeline}
        onHome={onLogoClick}
        user={user}
      />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px 60px' }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00b4a0', marginBottom: 12 }}>Supply Map</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 800, color: '#fff', margin: '0 0 12px', letterSpacing: -0.5 }}>
            Is your target suburb undersupplied?
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15, margin: 0 }}>
            Enter any suburb or postcode to see the full supply/demand picture — existing centres, DA pipeline, and kids-per-place ratio.
          </p>
        </div>

        {/* Search */}
        <div style={{ background: '#112236', border: '1px solid #1e3a5f', borderRadius: 12, padding: '20px 20px 16px', marginBottom: 28 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, background: '#0d1b2a', borderRadius: 8, padding: 3 }}>
            {(['address', 'postcode'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setResult(null); setError(null) }} style={{
                flex: 1, padding: '8px 16px', borderRadius: 6, border: 'none',
                background: tab === t ? '#1e3a5f' : 'transparent',
                color: tab === t ? '#fff' : '#94a3b8',
                fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
              }}>
                {t === 'address' ? '📍 By address' : '🏙 By suburb / postcode'}
              </button>
            ))}
          </div>
          {/* Input */}
          <div style={{ display: 'flex', gap: 10 }}>
            {tab === 'address' ? (
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                onFocus={() => setFocused('input')} onBlur={() => setFocused(null)}
                placeholder="e.g. 45 Church St, Brighton VIC 3186"
                style={{ flex: 1, background: '#0d1b2a', border: `1.5px solid ${focused === 'input' ? '#00b4a0' : '#1e3a5f'}`, borderRadius: 8, padding: '11px 14px', color: '#fff', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
              />
            ) : (
              <>
                <input type="text" value={postcode} onChange={e => setPostcode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  onFocus={() => setFocused('postcode')} onBlur={() => setFocused(null)}
                  placeholder="e.g. 3128"
                  style={{ flex: 1, background: '#0d1b2a', border: `1.5px solid ${focused === 'postcode' ? '#00b4a0' : '#1e3a5f'}`, borderRadius: 8, padding: '11px 14px', color: '#fff', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
                />
                <select value={state} onChange={e => setState(e.target.value)} style={{ background: '#0d1b2a', border: '1.5px solid #1e3a5f', borderRadius: 8, padding: '11px 10px', color: '#fff', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', cursor: 'pointer' }}>
                  {['VIC','NSW','QLD','WA','SA','TAS','ACT','NT'].map(s => <option key={s}>{s}</option>)}
                </select>
              </>
            )}
            <button onClick={handleSearch} disabled={loading} style={{ background: loading ? '#00967f' : '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', opacity: loading ? 0.8 : 1 }}>
              {loading ? 'Searching…' : 'Check supply →'}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, fontSize: 13, color: '#ef4444' }}>{error}</div>}
        </div>

        {/* Empty state */}
        {!result && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#475569', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗺️</div>
            Enter a suburb above to see the full supply/demand picture.
          </div>
        )}

        {/* Results */}
        {result && zoneConfig && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Zone badge */}
            <div style={{ background: zoneConfig.bg, border: `1.5px solid ${zoneConfig.border}`, borderRadius: 12, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: zoneConfig.color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Market Zone</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: zoneConfig.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{zoneConfig.label}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, maxWidth: 320 }}>{zoneConfig.desc}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 44, fontWeight: 900, color: zoneConfig.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{result.demand.kids_per_place.toFixed(1)}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>kids per licensed place</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>dynamic catchment radius</div>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Existing centres', value: result.stats.total_competitors.toString(), sub: `within ${result.stats.radius_km ?? 3}km`, color: '#00b4a0' },
                { label: 'Licensed places', value: result.demand.total_licensed_places.toLocaleString(), sub: 'catchment total', color: '#fff' },
                {
                  label: `Kids 0–4 (${result.demand.demand_detail?.yearEstimate ?? new Date().getFullYear()} est.)`,
                  value: result.demand.estimated_kids_0to4.toLocaleString(),
                  sub: result.demand.demand_detail
                    ? `ABS 2021: ${result.demand.demand_detail.abs2021Raw.toLocaleString()} · +${result.demand.demand_detail.growthPct}% growth`
                    : result.demand.data_source || 'ABS estimate',
                  color: '#fff',
                },
              ].map(s => (
                <div key={s.label} style={{ background: '#112236', border: '1px solid #1e3a5f', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Full competitor list — no blur */}
            <div style={{ background: '#112236', border: '1px solid #1e3a5f', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '13px 18px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  All nearby centres ({result.stats.total_competitors})
                </span>
                <span style={{ fontSize: 11, color: '#475569' }}>sorted by distance</span>
              </div>
              {result.competitors.length === 0 && (
                <div style={{ padding: '20px 18px', fontSize: 13, color: '#475569' }}>No centres found in catchment.</div>
              )}
              {result.competitors.map((c: any, i: number) => (
                <div key={i} style={{ padding: '11px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e8edf3', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.suburb} · {(c.distance_m / 1000).toFixed(1)}km</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{c.licensed_places || '—'} places</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                    background: c.nqs_rating === 'Exceeding NQS' ? 'rgba(34,197,94,0.12)' : c.nqs_rating === 'Meeting NQS' ? 'rgba(0,180,160,0.12)' : 'rgba(245,158,11,0.12)',
                    color: c.nqs_rating === 'Exceeding NQS' ? '#22c55e' : c.nqs_rating === 'Meeting NQS' ? '#00b4a0' : '#f59e0b',
                  }}>
                    {c.nqs_rating === 'Exceeding NQS' ? 'Exceeding' : c.nqs_rating === 'Meeting NQS' ? 'Meeting' : 'Working Towards'}
                  </span>
                </div>
              ))}
            </div>

            {/* DA pipeline — full, no teaser */}
            {result.pipeline_intel && (result.pipeline_intel.approvedDAs > 0 || result.pipeline_intel.lodgedDAs > 0) && (
              <div style={{ background: '#112236', border: '1px solid #1e3a5f', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '13px 18px', borderBottom: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🏗</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>DA Pipeline</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    {result.pipeline_intel.approvedDAs > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 20 }}>{result.pipeline_intel.approvedDAs} approved</span>
                    )}
                    {result.pipeline_intel.lodgedDAs > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 20 }}>{result.pipeline_intel.lodgedDAs} lodged</span>
                    )}
                  </div>
                </div>
                {result.pipeline_intel.applications?.map((app: any, i: number) => (
                  <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', marginTop: 2,
                      background: app.status === 'approved' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                      color: app.status === 'approved' ? '#ef4444' : '#f59e0b',
                    }}>
                      {app.status === 'approved' ? 'Approved' : 'Lodged'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#e8edf3', marginBottom: 2 }}>{app.address}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{app.description}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {app.places && <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{app.places} places</div>}
                      {app.distance_km && <div style={{ fontSize: 11, color: '#475569' }}>{app.distance_km}km</div>}
                    </div>
                  </div>
                ))}
                {result.pipeline_intel.notes && (
                  <div style={{ padding: '10px 18px', fontSize: 12, color: '#475569', borderTop: '1px solid rgba(255,255,255,0.04)' }}>{result.pipeline_intel.notes}</div>
                )}
              </div>
            )}

            {/* Nudge to upload IM */}
            <div style={{ background: 'rgba(0,180,160,0.06)', border: '1px solid rgba(0,180,160,0.2)', borderRadius: 10, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00b4a0', marginBottom: 4 }}>Found a deal in this suburb?</div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                  Upload the IM to get a full 17-dimension scored report — financials, lease, labour, valuation, and DA pipeline risk all in one place.
                </div>
              </div>
              <button onClick={onUpload} style={{ background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                Upload an IM →
              </button>
            </div>

            {/* Methodology */}
            <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid #1e3a5f', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#334155', lineHeight: 1.6 }}>
                <strong style={{ color: '#475569' }}>Methodology:</strong> Adjusted kids per place = ABS 2021 Census 0–4 population (catchment-adjusted, growth-indexed to {new Date().getFullYear()}) × LDC utilisation rate (40–55% metro / 35–45% regional, Dept of Education 2024) ÷ ACECQA licensed places within dynamic radius.
                Zones: &gt;1.0 Undersupplied · 0.5–1.0 Balanced · &lt;0.5 Oversupplied (LDC-adjusted). Raw ratio shown for reference only. Indicative — not a substitute for site-specific due diligence.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
