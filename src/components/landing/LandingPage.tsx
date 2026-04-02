'use client'

import { useEffect, useRef, useState } from 'react'
import UnifiedNav from '@/components/nav/UnifiedNav'

import type { User } from '@supabase/supabase-js'

// ── Try The Map Component ─────────────────────────────────────────────────────
function SupplyMapPreview({ onGoToApp, onSignIn, onMapSignIn }: { onGoToApp: () => void; onSignIn?: () => void; onMapSignIn?: () => void }) {
  const [tab, setTab]           = useState<'address' | 'postcode'>('address')
  const [input, setInput]       = useState('')
  const [postcode, setPostcode] = useState('')
  const [state, setState]       = useState('VIC')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<any>(null)
  const [error, setError]       = useState<string | null>(null)
  const [focused, setFocused]   = useState<string | null>(null)

  const ZONE_CONFIG = {
    undersupplied: { label: 'Undersupplied',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  desc: 'Strong demand relative to supply — favourable for operators.' },
    balanced:      { label: 'Balanced',        color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', desc: 'Demand and supply roughly matched — monitor pipeline carefully.' },
    oversupplied:  { label: 'Oversupplied',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  desc: 'More licensed places than catchment demand — pricing pressure and occupancy risk.' },
  } as const

  async function handleSearch() {
    const query = tab === 'address'
      ? input.trim()
      : `${postcode.trim()} ${state}`
    if (!query) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Use suburb as address, blank out licensed_places (we just want zone/competitors)
      const res = await fetch('/api/map-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address:         query,
          suburb:          query,
          state:           tab === 'postcode' ? state : '',
          postcode:        tab === 'postcode' ? postcode : '',
          licensed_places: 0,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Could not find this location. Try a suburb name or postcode.')
        return
      }
      const data = await res.json()
      setResult(data)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const zoneConfig = result ? ZONE_CONFIG[result.demand.zone as keyof typeof ZONE_CONFIG] : null

  return (
    <section id="try-map" style={{ background: '#080f18', padding: '100px 48px', borderTop: '1px solid #1e3a5f' }}>
      <style>{`
        @media (max-width: 480px) {
          #try-map { padding: 60px 20px !important; }
          .smp-zone-badge { flex-direction: column !important; align-items: flex-start !important; }
          .smp-zone-badge .smp-kids-stat { margin-left: 0 !important; text-align: left !important; }
          .smp-stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 380px) {
          .smp-stats-grid { grid-template-columns: 1fr !important; }
        }
        .smp-comp-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
        @media (max-width: 480px) {
          .smp-comp-name { max-width: 130px; }
          .smp-da-btn { width: 100% !important; text-align: center !important; }
        }
      `}</style>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00b4a0', marginBottom: 16 }}>Supply Map Preview</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: -0.5, lineHeight: 1.1 }}>
            Is your target suburb<br /><em style={{ color: '#00b4a0', fontStyle: 'italic' }}>undersupplied or oversupplied?</em>
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 16, margin: 0 }}>
            Enter any suburb or postcode for an instant supply/demand snapshot — no signup required.
          </p>
        </div>

        {/* Search form */}
        <div style={{ background: '#112236', border: '1px solid #1e3a5f', borderRadius: 12, padding: '24px 24px 20px', marginBottom: 24 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#0d1b2a', borderRadius: 8, padding: 3 }}>
            {(['address', 'postcode'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setResult(null); setError(null) }} style={{
                flex: 1, padding: '8px 16px', borderRadius: 6, border: 'none',
                background: tab === t ? '#1e3a5f' : 'transparent',
                color: tab === t ? '#fff' : '#94a3b8',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
              }}>
                {t === 'address' ? '📍 By address' : '🏙 By suburb / postcode'}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', gap: 10 }}>
            {tab === 'address' ? (
              <input
                type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                onFocus={() => setFocused('input')} onBlur={() => setFocused(null)}
                placeholder="e.g. 45 Church St, Brighton VIC 3186"
                style={{ flex: 1, background: '#0d1b2a', border: `1.5px solid ${focused === 'input' ? '#00b4a0' : '#1e3a5f'}`, borderRadius: 8, padding: '12px 16px', color: '#fff', fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: 'none', transition: 'border-color 0.15s' }}
              />
            ) : (
              <>
                <input
                  type="text" value={postcode} onChange={e => setPostcode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  onFocus={() => setFocused('postcode')} onBlur={() => setFocused(null)}
                  placeholder="e.g. 3128"
                  style={{ flex: 1, background: '#0d1b2a', border: `1.5px solid ${focused === 'postcode' ? '#00b4a0' : '#1e3a5f'}`, borderRadius: 8, padding: '12px 16px', color: '#fff', fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: 'none', transition: 'border-color 0.15s' }}
                />
                <select value={state} onChange={e => setState(e.target.value)} style={{ background: '#0d1b2a', border: '1.5px solid #1e3a5f', borderRadius: 8, padding: '12px 12px', color: '#fff', fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: 'none', cursor: 'pointer' }}>
                  {['VIC','NSW','QLD','WA','SA','TAS','ACT','NT'].map(s => <option key={s}>{s}</option>)}
                </select>
              </>
            )}
            <button
              onClick={handleSearch} disabled={loading}
              style={{ background: loading ? '#00967f' : '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 22px', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', opacity: loading ? 0.8 : 1 }}
            >
              {loading ? 'Searching…' : 'Check supply →'}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 12, fontSize: 13, color: '#ef4444' }}>{error}</div>
          )}
        </div>

        {/* Results */}
        {result && zoneConfig && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Zone badge — big and prominent */}
            <div className="smp-zone-badge" style={{ background: zoneConfig.bg, border: `1.5px solid ${zoneConfig.border}`, borderRadius: 12, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: zoneConfig.color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Market Zone</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: zoneConfig.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{zoneConfig.label}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, maxWidth: 320 }}>{zoneConfig.desc}</div>
              </div>
              <div className="smp-kids-stat" style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: zoneConfig.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{result.demand.kids_per_place.toFixed(1)}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>kids per licensed place</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>dynamic catchment radius</div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="smp-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Existing centres', value: result.stats.total_competitors.toString(), sub: `within ${result.stats.radius_km ?? 3}km (${result.stats.radius_label ?? 'suburban'})`, color: '#00b4a0' },
                { label: 'Licensed places', value: result.demand.total_licensed_places.toLocaleString(), sub: `${result.stats.radius_km ?? 2}–${(result.stats.radius_km ?? 3) + 2}km catchment`, color: '#fff' },
                {
                  label: `Kids 0–4 (${result.demand.demand_detail?.yearEstimate ?? new Date().getFullYear()} est.)`,
                  value: result.demand.estimated_kids_0to4.toLocaleString(),
                  sub: result.demand.demand_detail
                    ? `ABS 2021: ${result.demand.demand_detail.abs2021Raw.toLocaleString()} · +${result.demand.demand_detail.growthPct}% growth · ${result.demand.demand_detail.areaRatioPct}% of postcode area`
                    : result.demand.data_source || 'ABS estimate',
                  color: '#fff'
                },
              ].map(s => (
                <div key={s.label} style={{ background: '#112236', border: '1px solid #1e3a5f', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Competitor preview — blurred, locked */}
            <div style={{ background: '#112236', border: '1px solid #1e3a5f', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Nearby centres ({result.stats.total_competitors})
                </span>
                <span style={{ fontSize: 11, color: '#00b4a0', fontWeight: 600 }}>Sign up to see all →</span>
              </div>
              {/* Show first 2 centres, blur the rest */}
              <div style={{ position: 'relative' }}>
                {result.competitors.slice(0, 4).map((c: any, i: number) => (
                  <div key={i} style={{
                    padding: '11px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                    gap: 12, alignItems: 'center',
                    filter: i >= 2 ? 'blur(4px)' : 'none',
                    userSelect: i >= 2 ? 'none' : 'auto',
                    opacity: i >= 2 ? 0.5 : 1,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="smp-comp-name" style={{ fontSize: 13, fontWeight: 600, color: i < 2 ? '#e8edf3' : '#888', marginBottom: 2 }}>{i < 2 ? c.name : '████████████████'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{i < 2 ? c.suburb : '█████████'} · {(c.distance_m / 1000).toFixed(1)}km</div>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{c.licensed_places || '—'} places</span>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                      background: c.nqs_rating === 'Exceeding NQS' ? 'rgba(34,197,94,0.12)' : c.nqs_rating === 'Meeting NQS' ? 'rgba(0,180,160,0.12)' : 'rgba(245,158,11,0.12)',
                      color: c.nqs_rating === 'Exceeding NQS' ? '#22c55e' : c.nqs_rating === 'Meeting NQS' ? '#00b4a0' : '#f59e0b',
                    }}>
                      {c.nqs_rating === 'Exceeding NQS' ? 'Exceeding' : c.nqs_rating === 'Meeting NQS' ? 'Meeting' : 'Working Towards'}
                    </span>
                  </div>
                ))}
                {/* Lock overlay */}
                {result.competitors.length > 2 && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, transparent, #112236)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 16 }}>
                    <button onClick={onMapSignIn || onSignIn || onGoToApp} style={{ background: '#00b4a0', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                      🔓 Sign up free to see all {result.stats.total_competitors} centres + DA pipeline map
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* DA pipeline teaser */}
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>🏗 DA Pipeline not shown</div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                  Full reports include approved DAs, lodged applications, and permit sites plotted on the competitive map — showing supply that doesn&apos;t exist yet but will.
                </div>
              </div>
              <button onClick={onMapSignIn || onSignIn || onGoToApp} style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                See full map →
              </button>
            </div>
          </div>
        )}

        {/* Methodology note */}
        {result && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid #1e3a5f', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
              <strong style={{ color: '#64748b' }}>Methodology:</strong> Kids per place = ABS 2021 Census 0–4 population
              (catchment-area adjusted, growth-indexed to {new Date().getFullYear()}) ÷ ACECQA licensed places within dynamic radius.
              Zones: &gt;2.0 Undersupplied · 1.0–2.0 Balanced · &lt;1.0 Oversupplied.
              Calibrated against national LDC occupancy (~79%, ACECQA) and ABS Preschool Education Australia 2024.
              Indicative only — not a substitute for site-specific due diligence.
            </p>
          </div>
        )}

        {/* Empty state — before search */}
        {!result && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
            Enter a suburb above to see the supply/demand snapshot for that catchment.
          </div>
        )}
      </div>
    </section>
  )
}


interface LandingPageProps {
  onGoToApp: () => void
  onViewSample?: () => void
  onSignIn?: () => void
  onMapSignIn?: () => void
  user?: User | null
}

export default function LandingPage({ onGoToApp, onViewSample, onSignIn, onMapSignIn, user }: LandingPageProps) {
  // Scroll-based fade-in for sections
  const observerRef = useRef<IntersectionObserver | null>(null)
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible')
        })
      },
      { threshold: 0.1 }
    )
    document.querySelectorAll('.land-fade').forEach((el) =>
      observerRef.current?.observe(el)
    )
    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", overflowX: 'hidden' }}>
      {/* FONTS */}
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* GLOBAL STYLES */}
      <style>{`
        :root {
          --navy: #0d1b2a; --navy-mid: #152637; --navy-light: #1e3a52; --navy-dark: #080f18;
          --teal: #00b4a0; --teal-light: #00d4bd; --teal-dim: rgba(0,180,160,0.12);
          --amber: #f59e0b; --red: #ef4444; --green: #22c55e; --green-dark: #16a34a;
          --cream: #f7f3ed; --cream-dark: #e8e2d8;
          --text-main: #1a2e42; --text-muted: #5a7a94;
        }
        .land-fade { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .land-fade.visible { opacity: 1; transform: translateY(0); }
        .land-fade.d1 { transition-delay: 0.1s; }
        .land-fade.d2 { transition-delay: 0.2s; }
        .land-fade.d3 { transition-delay: 0.3s; }
        .land-fade.d4 { transition-delay: 0.4s; }
        @keyframes lpulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes lgridpulse { 0%,100%{opacity:0.04} 50%{opacity:0.07} }
        .land-btn-primary {
          display: inline-block; background: #00b4a0; color: #fff;
          padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;
          cursor: pointer; border: none; font-family: 'DM Sans', sans-serif;
          transition: background 0.2s; text-decoration: none;
        }
        .land-btn-primary:hover { background: #00d4bd; }
        .land-btn-ghost {
          display: inline-block; background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.75);
          padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s;
          text-decoration: none;
        }
        .land-btn-ghost:hover { border-color: rgba(255,255,255,0.35); color: #fff; }
        .land-btn-outline {
          display: inline-block; border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.7); padding: 14px 32px; border-radius: 8px;
          font-size: 15px; font-weight: 600; cursor: pointer; background: transparent;
          transition: all 0.2s; text-decoration: none; font-family: 'DM Sans', sans-serif;
        }
        .land-btn-outline:hover { border-color: rgba(255,255,255,0.5); color: #fff; }
        .problem-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.08); }
        .score-card-item:hover { border-color: #00b4a0; box-shadow: 0 4px 24px rgba(0,180,160,0.1); }
        .bench-table tr:hover td { background: rgba(255,255,255,0.02); }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-right-col { display: none !important; }
          .two-col-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .scoring-grid-3col { grid-template-columns: 1fr !important; }
          .cta-section-inner { padding: 80px 24px !important; }
        }
      `}</style>

      {/* UNIFIED NAV */}
      <UnifiedNav
        mode="landing"
        onLogoClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onUpload={onGoToApp}
        onSignIn={onSignIn}
        user={user}
      />

      {/* ══════════════ HERO ══════════════ */}
      <section style={{
        minHeight: '100vh',
        background: 'var(--navy)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'center',
        gap: 0,
        padding: '72px 48px 80px',
        position: 'relative',
        overflow: 'hidden',
      }} className="hero-grid">

        {/* Background effects */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 70% 50%, rgba(0,180,160,0.08) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(0,180,160,0.05) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(0,180,160,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,160,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        {/* Hero left */}
        <div style={{ position: 'relative', zIndex: 1, paddingRight: 48 }}>
          <div className="land-fade" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,180,160,0.12)', border: '1px solid rgba(0,180,160,0.3)',
            padding: '6px 16px', borderRadius: 100,
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
            color: 'var(--teal)', textTransform: 'uppercase', marginBottom: 32,
          }}>
            <span style={{ fontSize: 8, animation: 'lpulse 2s infinite' }}>●</span>
            Childcare Acquisition Intelligence
          </div>

          <h1 className="land-fade d1" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(40px, 4.5vw, 64px)',
            fontWeight: 900, lineHeight: 1.05,
            color: '#fff', letterSpacing: '-1.5px',
            marginBottom: 24,
          }}>
            Stop guessing.<br />Start <em style={{ color: 'var(--teal)', fontStyle: 'italic' }}>knowing</em><br />before you bid.
          </h1>

          <p className="land-fade d2" style={{
            fontSize: 17, lineHeight: 1.7, color: 'rgba(255,255,255,0.6)',
            maxWidth: 480, marginBottom: 40,
          }}>
            Upload any Information Memorandum. Get a scored acquisition report with real demand intelligence — Effective Demand Ratio from ABS data, not GapMaps — competitive mapping, DA pipeline risk, and deal-breaker flags. In under 60 seconds.
          </p>

          <div className="land-fade d3" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 48 }}>
            <button className="land-btn-primary" onClick={onGoToApp}>Upload an IM Free →</button>
            <button className="land-btn-ghost" onClick={onViewSample ?? onGoToApp}>▶ See sample report</button>
          </div>

          <div className="land-fade d4" style={{ display: 'flex', gap: 40 }}>
            {[
              { num: '10x', label: 'faster due diligence' },
              { num: '17', label: 'scoring dimensions' },
              { num: 'Real EDR', label: 'ABS demand · not estimates' },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                  <span style={{ color: 'var(--teal)' }}>{s.num}</span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero right — mock app */}
        <div className="land-fade d2 hero-right-col" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            background: '#0f2136', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
          }}>
            {/* Mock header */}
            <div style={{
              background: '#152637', padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['#ff5f57','#febc2e','#28c840'].map(c => (
                  <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Mono', monospace" }}>
                Acquira · Kidz R Kidz Cranbourne North
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#00b4a0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                ● Live Report
              </div>
            </div>

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '10px 14px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { val: '71%', label: 'Occupancy', color: '#f59e0b' },
                { val: '74', label: 'Places', color: '#fff' },
                { val: '$1.29M', label: 'Revenue', color: '#fff' },
                { val: '$289K', label: 'EBITDA', color: '#22c55e' },
              ].map(k => (
                <div key={k.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 500, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Mock map + score sidebar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px' }}>
              {/* Mini map */}
              <div style={{ padding: 0, overflow: 'hidden', height: 185 }}>
                <svg viewBox="0 0 280 175" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                  <rect width="280" height="155" fill="#e8f0e0" />
                  <line x1="0" y1="52" x2="280" y2="52" stroke="rgba(255,255,255,0.7)" strokeWidth="2"/>
                  <line x1="0" y1="104" x2="280" y2="104" stroke="rgba(255,255,255,0.7)" strokeWidth="2"/>
                  <line x1="80" y1="0" x2="80" y2="155" stroke="rgba(255,255,255,0.7)" strokeWidth="2"/>
                  <line x1="190" y1="0" x2="190" y2="155" stroke="rgba(255,255,255,0.7)" strokeWidth="2"/>
                  <rect x="10" y="10" width="30" height="16" rx="2" fill="rgba(180,180,160,0.5)"/>
                  <rect x="90" y="10" width="50" height="16" rx="2" fill="rgba(180,180,160,0.45)"/>
                  <rect x="200" y="10" width="40" height="16" rx="2" fill="rgba(180,180,160,0.5)"/>
                  <rect x="10" y="65" width="40" height="15" rx="2" fill="rgba(180,180,160,0.45)"/>
                  <rect x="90" y="62" width="60" height="18" rx="2" fill="rgba(180,180,160,0.4)"/>
                  <rect x="200" y="65" width="50" height="15" rx="2" fill="rgba(180,180,160,0.45)"/>
                  <circle cx="128" cy="74" r="56" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.5)" strokeWidth="1.5" strokeDasharray="6,3"/>
                  <circle cx="200" cy="90" r="36" fill="rgba(245,158,11,0.13)" stroke="rgba(245,158,11,0.45)" strokeWidth="1.5" strokeDasharray="6,3"/>
                  {/* Target centre */}
                  <circle cx="128" cy="74" r="15" fill="#0d1b2a" stroke="white" strokeWidth="2"/>
                  <text x="128" y="79" textAnchor="middle" fontSize="10" fill="white" fontWeight="700" fontFamily="DM Sans">69</text>
                  {/* Existing centres (C) */}
                  <circle cx="72" cy="48" r="10" fill="#16a34a" stroke="white" strokeWidth="1.5"/>
                  <text x="72" y="52" textAnchor="middle" fontSize="8" fill="white" fontWeight="700">C</text>
                  <circle cx="178" cy="82" r="9" fill="#00b4a0" stroke="white" strokeWidth="1.5"/>
                  <text x="178" y="86" textAnchor="middle" fontSize="8" fill="white" fontWeight="700">C</text>
                  <circle cx="148" cy="112" r="9" fill="#d97706" stroke="white" strokeWidth="1.5"/>
                  <text x="148" y="116" textAnchor="middle" fontSize="8" fill="white" fontWeight="700">C</text>
                  {/* DA Approved (A) - red */}
                  <circle cx="55" cy="100" r="9" fill="#ef4444" stroke="white" strokeWidth="1.5"/>
                  <text x="55" y="104" textAnchor="middle" fontSize="8" fill="white" fontWeight="700">A</text>
                  <circle cx="220" cy="40" r="9" fill="#ef4444" stroke="white" strokeWidth="1.5"/>
                  <text x="220" y="44" textAnchor="middle" fontSize="8" fill="white" fontWeight="700">A</text>
                  {/* DA Lodged (L) - amber */}
                  <circle cx="100" cy="128" r="9" fill="#f59e0b" stroke="white" strokeWidth="1.5"/>
                  <text x="100" y="132" textAnchor="middle" fontSize="8" fill="white" fontWeight="700">L</text>
                  <rect x="50" y="26" width="26" height="11" rx="5" fill="white" opacity="0.9"/>
                  <text x="63" y="34" textAnchor="middle" fontSize="7" fill="#1a2e42" fontWeight="700">3.1 k/p</text>
                  {/* Legend */}
                  <rect x="0" y="155" width="280" height="20" fill="#0f2136"/>
                  <circle cx="16" cy="165" r="5" fill="#16a34a"/>
                  <text x="25" y="169" fontSize="7" fill="rgba(255,255,255,0.7)" fontFamily="DM Sans">Existing</text>
                  <circle cx="80" cy="165" r="5" fill="#ef4444"/>
                  <text x="89" y="169" fontSize="7" fill="rgba(255,255,255,0.7)" fontFamily="DM Sans">DA Approved</text>
                  <circle cx="168" cy="165" r="5" fill="#f59e0b"/>
                  <text x="177" y="169" fontSize="7" fill="rgba(255,255,255,0.7)" fontFamily="DM Sans">DA Lodged</text>
                </svg>
              </div>

              {/* Score sidebar */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                padding: '10px 8px',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <div style={{ textAlign: 'center', padding: '2px 0' }}>
                  <svg viewBox="0 0 80 50" style={{ width: 68, height: 40 }}>
                    <path d="M 10 45 A 30 30 0 0 1 70 45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" strokeLinecap="round"/>
                    <path d="M 10 45 A 30 30 0 0 1 70 45" fill="none" stroke="#00b4a0" strokeWidth="7" strokeLinecap="round" strokeDasharray="94.2" strokeDashoffset="28"/>
                  </svg>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: '#fff', marginTop: -6 }}>69</div>
                  <div style={{ fontSize: 9, color: '#00b4a0', fontWeight: 700, letterSpacing: '0.05em' }}>Attractive</div>
                </div>
                {[
                  { label: 'Demand', val: 70, color: '#00b4a0' },
                  { label: 'Labour', val: 72, color: '#00b4a0' },
                  { label: 'Revenue', val: 68, color: '#00b4a0' },
                  { label: 'Lease', val: 78, color: '#22c55e' },
                  { label: 'Valuation', val: 61, color: '#f59e0b' },
                ].map(d => (
                  <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>{d.label}</span>
                    <span style={{ color: d.color, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{d.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Analyst summary */}
            <div style={{ padding: '9px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,180,160,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#00b4a0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Analyst Summary</div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
                Kidz R Kidz presents as an <span style={{ color: '#00b4a0', fontWeight: 600 }}>attractive acquisition</span> at 71% occupancy with $289K EBITDA and a 22.4% margin. Labour at 55.3% is well-controlled. POA asking price limits valuation certainty.
              </p>
            </div>

            {/* Conditionals */}
            <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>Conditionals</div>
              {[
                { id: 'occupancy', text: 'Occupancy uplift to 80%+ within 12 months', impact: '+8' },
                { id: 'valuation', text: 'Confirm asking price — POA limits valuation certainty', impact: '-6' },
              ].map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.id}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', flex: 1 }}>{c.text}</span>
                  <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: c.impact.startsWith('+') ? '#22c55e' : '#ef4444', flexShrink: 0 }}>{c.impact}</span>
                </div>
              ))}
            </div>

            {/* Bottom stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
              {[
                { label: 'Labour ratio', val: '55.3%', color: '#22c55e' },
                { label: 'Rent ratio', val: '9.6%', color: '#22c55e' },
                { label: 'Lease remaining', val: '10yr', color: '#22c55e' },
              ].map((s, i) => (
                <div key={s.label} style={{ padding: '8px 12px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ PROBLEM ══════════════ */}
      <section style={{ background: 'var(--cream)', padding: '100px 48px' }} id="problem">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ maxWidth: 760, marginBottom: 64 }}>
            <div className="land-fade" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16 }}>The Problem</div>
            <h2 className="land-fade d1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 3.5vw, 52px)', fontWeight: 900, letterSpacing: -1, lineHeight: 1.1, color: 'var(--navy)', marginBottom: 24 }}>
              Generic AI reads the IM.<br />We <em style={{ color: 'var(--teal)', fontStyle: 'italic' }}>underwrite</em> the deal.
            </h2>
            <p className="land-fade d2" style={{ fontSize: 17, lineHeight: 1.75, color: 'var(--text-muted)', marginBottom: 24 }}>
              A broker sends an IM. You have days to decide. But the questions that actually determine whether it's a good deal aren't answered in the document:
            </p>
            <div className="land-fade d3" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                'How many children aged 0–4 live in the catchment vs licensed places available?',
                'How many competing centres exist within the dynamic catchment radius (2–5km) — and are any approved but not yet open?',
                'Is the labour ratio structurally above benchmark, or a one-year anomaly?',
                'Does the lease tail support financing — and what are the make-good obligations?',
                'Is the asking price above market EBITDA multiples for this centre profile?',
              ].map(q => (
                <div key={q} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--teal)', fontWeight: 700, fontSize: 16, lineHeight: 1.6, flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6 }}>{q}</span>
                </div>
              ))}
            </div>
            <p className="land-fade d4" style={{ fontSize: 17, lineHeight: 1.75, color: 'var(--text-muted)' }}>
              Generic AI can summarise what's in the document. It can't answer what isn't. Acquira combines IM extraction with live regulatory data, demographic catchments, and 2,131 mapped VIC centres to turn every IM into a structured acquisition analysis — in 60 seconds.
            </p>
          </div>

          {/* Persona pain cards */}
          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 48 }}>
            {[
              {
                persona: 'Solo investor / SMSF buyer',
                icon: '🏠',
                pain: 'Every IM looks the same — revenue trending up, occupancy "stabilising", lease "secure". You can\'t distinguish a quality asset from a distressed one dressed up well. You won\'t find out until 12 months post-settlement.',
                stakes: 'One bad deal can wipe a decade of contributions.',
              },
              {
                persona: 'Operator seeking bolt-ons',
                icon: '🏗️',
                pain: 'You can read an IM. But you\'re evaluating 6 at once across multiple states while running existing centres. Manually cross-checking ACECQA, ABS data, and lease abstracts for each one doesn\'t scale.',
                stakes: 'Your competition is moving faster than your spreadsheet.',
              },
              {
                persona: 'Broker or acquisition advisor',
                icon: '📋',
                pain: 'Clients expect you to surface risks they can\'t see. But your process relies on the same manual templates it did in 2018. Inconsistent analysis across deals is a liability — and 40 hours per IM isn\'t sustainable.',
                stakes: 'Your edge is speed and rigour. Protect both.',
              },
              {
                persona: 'The common thread',
                icon: '⚠️',
                pain: 'None of them know a new 104-place centre was approved 800m away last month. None can tell if 50% occupancy is a seasonal dip or a structural problem. Generic AI can\'t tell them either.',
                stakes: 'The risk isn\'t what\'s in the IM. It\'s what isn\'t.',
                highlight: true,
              },
            ].map((c) => (
              <div key={c.persona} className="land-fade problem-card" style={{
                background: c.highlight ? 'var(--navy)' : '#fff',
                border: c.highlight ? 'none' : '1px solid var(--cream-dark)',
                borderRadius: 12, padding: 28, position: 'relative', overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: c.highlight ? 'rgba(239,68,68,0.15)' : 'rgba(0,180,160,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {c.icon}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.highlight ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.persona}</div>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: c.highlight ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)', marginBottom: 16 }}>{c.pain}</p>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.highlight ? '#ef4444' : 'var(--navy)', padding: '10px 14px', background: c.highlight ? 'rgba(239,68,68,0.1)' : 'var(--cream)', borderRadius: 8, borderLeft: `3px solid ${c.highlight ? '#ef4444' : 'var(--teal)'}` }}>
                  {c.stakes}
                </div>
              </div>
            ))}
          </div>

          {/* Acquira answer strip */}
          <div className="land-fade" style={{
            background: 'var(--navy)', borderRadius: 12, padding: '32px 40px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 40, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 10 }}>The Acquira Answer</div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(20px, 2vw, 28px)', fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>
                Purpose-built intelligence for childcare acquisitions.
              </h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 520 }}>
                AI + real demand data. State-aware scoring across 17 dimensions — including a true Effective Demand Ratio (EDR) computed from ABS Census data and DoE utilisation rates, not GapMaps guesses. Live ACECQA competitor supply, deal-breaker flags, and DA pipeline risk. Structured acquisition analysis in 60 seconds.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200 }}>
              {[
                { stat: '60s', label: 'from IM to full report' },
                { stat: '17', label: 'scoring dimensions' },
                { stat: 'Real EDR', label: 'ABS demand · not GapMaps' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, color: 'var(--teal)', lineHeight: 1, minWidth: 60 }}>{s.stat}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <section style={{ background: 'var(--navy)', padding: '100px 48px' }} id="how">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="land-fade" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16 }}>How It Works</div>
          <h2 className="land-fade d1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 3.5vw, 52px)', fontWeight: 900, letterSpacing: -1, lineHeight: 1.1, color: '#fff', marginBottom: 60 }}>
            From IM to acquisition<br />decision in <em style={{ color: 'var(--teal)', fontStyle: 'italic' }}>minutes</em>.
          </h2>
          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0 }}>
            {[
              { num: '01', icon: '📄', title: 'Upload Your IM', text: 'Drop in a PDF or Word IM from any broker. Supports multi-file uploads for batch analysis.' },
              { num: '02', icon: '🧠', title: 'AI Parses & Scores', text: 'Extracts financials, occupancy, lease terms, staff metrics — then scores across 17 dimensions with state-aware context.' },
              { num: '03', icon: '🗺️', title: 'Demand + Supply Map', text: 'Real EDR computed from ABS 2021 Census + DoE utilisation data — not raw GapMaps CPP. Existing centres, approved DAs, and DA pipeline all plotted. See supply risk before it hits.' },
              { num: '04', icon: '⚠️', title: 'Red Flags Surfaced', text: 'Automatically flags occupancy inflation, labour cost pressure, lease risk, regulatory issues, and pipeline threats.' },
              { num: '05', icon: '📑', title: 'Export Report', text: 'Download a board-ready PDF report with scoring summary, competitive analysis, and upside opportunity assessment.' },
            ].map((step, i, arr) => (
              <div key={step.num} className="land-fade" style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                padding: '40px 32px', position: 'relative',
                borderRadius: i === 0 ? '12px 0 0 12px' : i === arr.length - 1 ? '0 12px 12px 0' : 0,
                transition: 'background 0.3s',
              }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 72, fontWeight: 900, color: 'rgba(0,180,160,0.1)', lineHeight: 1, position: 'absolute', top: 20, right: 24 }}>
                  {step.num}
                </div>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(0,180,160,0.12)', border: '1px solid rgba(0,180,160,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 20 }}>
                  {step.icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{step.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.5)' }}>{step.text}</p>
                {i < arr.length - 1 && (
                  <div style={{ position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--teal)', zIndex: 1 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ SCORING FRAMEWORK ══════════════ */}
      <section style={{ background: 'var(--cream)', padding: '100px 48px' }} id="scoring">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="land-fade" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16 }}>Scoring Framework</div>
          <h2 className="land-fade d1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 3.5vw, 52px)', fontWeight: 900, letterSpacing: -1, lineHeight: 1.1, color: 'var(--navy)', marginBottom: 12 }}>
            17 dimensions. <em style={{ color: 'var(--teal)', fontStyle: 'italic' }}>One</em><br />consistent decision.
          </h2>
          <p className="land-fade d2" style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 560, marginBottom: 48 }}>
            Every centre is evaluated across the same framework, enabling true like-for-like comparison across deals, states, and operators.
          </p>
          <div className="scoring-grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { icon: '👶', bg: '#dcfce7', title: 'Occupancy & Demand', text: 'Stabilised occupancy, 12-month trend, waitlist depth, churn rate. The most critical dimension.', badge: 'Critical' },
              { icon: '📈', bg: '#dcfce7', title: 'Profitability & Cashflow', text: 'EBITDA margin, normalised EBITDA after add-backs, operating cashflow, capex requirements.', badge: 'Critical' },
              { icon: '💰', bg: '#fef3c7', title: 'Revenue & Pricing Power', text: 'ARPU vs local peers, fee growth history, CCS dependency, arrears rate.', badge: 'High' },
              { icon: '👩‍🏫', bg: '#fee2e2', title: 'Staffing & Labour Resilience', text: 'Educator cost as % revenue, turnover rate, agency usage, tenure. 2025\'s biggest risk.', badge: 'High' },
              { icon: '🏢', bg: '#e0f2fe', title: 'Lease Economics', text: 'Rent as % revenue, review mechanism, make-good obligations. Fixed costs that can\'t be cut.', badge: 'High' },
              { icon: '🤝', bg: '#fef3c7', title: 'Valuation & Deal Structure', text: 'Price per place ($60k–$120k), EBITDA multiple (4.5x–6.5x), ROIC, downside protection.', badge: 'High' },
              { icon: '🗺️', bg: '#fff7ed', title: 'Market & Competitive Position', text: 'Supply vs demand gap, DA pipeline markers (approved & lodged), birth rates, catchment demographics. See future supply risk before it hits.', badge: 'High' },
              { icon: '⚙️', bg: '#f0fdf4', title: 'Management & Systems', text: 'Manager tenure, rostering/billing maturity, reporting quality, owner-dependency risk.', badge: 'Medium' },
              { icon: '📋', bg: '#faf5ff', title: 'Regulatory & Quality', text: 'NQS rating, time since last assessment, exceeding areas, active notices or conditions.', badge: 'Medium' },
              { icon: '🚀', bg: '#dcfce7', title: 'Upside Levers', text: 'Fee uplift headroom, occupancy growth potential, cost efficiencies, B/ASC extension opportunity.', badge: 'Medium' },
              { icon: '🏛️', bg: '#fef3c7', title: 'CCS / Subsidy Risk', text: 'Activity test exposure, CCS-dependent enrolment %, subsidy cliff scenarios under policy change.', badge: 'New' },
              { icon: '📅', bg: '#e0f2fe', title: 'Lease Tail', text: 'Years remaining including options. Total potential tenure. Critical for financing and exit.', badge: 'New' },
              { icon: '🔧', bg: '#fee2e2', title: 'CAPEX Liability', text: 'Fit-out age, renovation risk flagged in IM, estimated capital exposure before stabilisation.', badge: 'New' },
              { icon: '🎓', bg: '#faf5ff', title: 'Staff Qualification Mix', text: 'Degree vs certificate ratio, diploma split, wage trajectory risk as qualifications requirements rise.', badge: 'New' },
              { icon: '💵', bg: '#dcfce7', title: 'Fee Benchmarking', text: 'Centre daily fee vs suburb median. Pricing power headroom. Gap to maximum CCS-eligible rate.', badge: 'New' },
              { icon: '🏅', bg: '#fff7ed', title: 'Operator Quality Signal', text: 'Assessment recency, exceeding area count, active notices. Operator track record beyond NQS rating.', badge: 'New' },
              { icon: '📊', bg: '#f0fdf4', title: 'Enrolment Trend & Waitlist', text: 'Trend direction (growing/declining), waitlist depth as leading indicator. Snapshot vs trajectory.', badge: 'New' },
            ].map((c) => (
              <div key={c.title} className="land-fade score-card-item" style={{
                background: '#fff', border: '1px solid var(--cream-dark)',
                borderRadius: 12, padding: 24,
                display: 'flex', gap: 20, alignItems: 'flex-start',
                transition: 'all 0.2s', cursor: 'pointer',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: c.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {c.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>{c.title}</h4>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>{c.text}</p>
                </div>
                <div style={{ marginLeft: 'auto', flexShrink: 0, background: c.badge === 'New' ? 'rgba(0,180,160,0.12)' : c.badge === 'Critical' ? '#ef4444' : 'var(--navy)', color: c.badge === 'New' ? 'var(--teal)' : '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, height: 'fit-content', whiteSpace: 'nowrap', border: c.badge === 'New' ? '1px solid rgba(0,180,160,0.3)' : 'none' }}>
                  {c.badge}
                </div>
              </div>
            ))}
          </div>

          {/* ── SCORE GATE: blur overlay + CTA ── */}
          <div style={{ position: 'relative', marginTop: -180, height: 220 }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, transparent 0%, rgba(248,246,242,0.92) 40%, rgba(248,246,242,1) 70%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
              paddingBottom: 32,
            }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy)', marginBottom: 12, textAlign: 'center' }}>
                Sign up to see the full 17-dimension analysis →
              </p>
              <button
                onClick={onSignIn}
                style={{
                  background: 'var(--teal, #00b4a0)', border: 'none', borderRadius: 10,
                  padding: '12px 28px', color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  boxShadow: '0 4px 20px rgba(0,180,160,0.3)',
                }}
              >
                Get started free →
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════ BENCHMARKS ══════════════ */}
      <section style={{ background: 'var(--navy)', padding: '100px 48px' }} id="benchmarks">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="land-fade" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16 }}>Industry Benchmarks</div>
          <h2 className="land-fade d1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 3.5vw, 52px)', fontWeight: 900, letterSpacing: -1, lineHeight: 1.1, color: '#fff', marginBottom: 12 }}>
            Know what <em style={{ color: 'var(--teal)', fontStyle: 'italic' }}>good</em><br />actually looks like.
          </h2>
          <p className="land-fade d2" style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', maxWidth: 560, marginBottom: 48 }}>
            Every metric is compared against verified benchmarks. No guesswork — just clear signals on where a centre stands.
          </p>
          <table className="bench-table land-fade" style={{ width: '100%', borderCollapse: 'collapse', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
            <thead style={{ background: 'rgba(0,180,160,0.1)' }}>
              <tr>
                {['Metric', '✅ Good Benchmark', '🚨 Red Flag'].map(h => (
                  <th key={h} style={{ padding: '16px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--teal)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Current Occupancy', '≥ 75–85% stabilised', 'Inflated by short-term discounts'],
                ['Waitlist Depth', '≥ 10–20% of licensed places', 'Waitlist not converting for months'],
                ['Enrolment Churn', '< 3–4% per month', 'High monthly exits, no retention'],
                ['Labour Cost', '55–65% of revenue', '> 70% revenue to wages'],
                ['Educator Turnover', '< 25–30% annually', 'Heavy casual/agency reliance'],
                ['EBITDA Margin', '15–25% (quality dependent)', 'Only works with aggressive add-backs'],
                ['Rent as % Revenue', '≤ 12–15% of revenue', 'Fixed 4–5% increases with fee caps'],
                ['Lease Remaining', '≥ 10 years (incl. options)', '< 7 years remaining'],
                ['EBITDA Multiple', '4.5x–6.5x', 'Paying premium without quality/upside'],
                ['Price Per Place', '$60k–$120k per licensed place', 'No downside protection in contract'],
                ['Cash Yield Post-Debt', '> 10–12% ROIC', 'Vendor forecasts without evidence'],
                ['NQS Rating', 'Meeting or Exceeding', 'Working Towards (esp. QA2 or QA7)'],
              ].map(([metric, good, bad]) => (
                <tr key={metric}>
                  <td style={{ padding: '14px 20px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 700, color: '#fff' }}>{metric}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#22c55e', fontWeight: 600 }}>{good}</td>
                  <td style={{ padding: '14px 20px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#ef4444', fontWeight: 600 }}>{bad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════ TRY THE MAP ══════════════ */}
      <SupplyMapPreview onGoToApp={onGoToApp} onSignIn={onSignIn} onMapSignIn={onMapSignIn} />

      {/* ══════════════ PRICING ══════════════ */}
      <section id="pricing" style={{ background: '#080f18', padding: '100px 48px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16 }}>Pricing</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: -0.5 }}>
              Simple, transparent pricing
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, margin: 0 }}>
              Monthly subscription. Cancel anytime. Prices in AUD.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              {
                name: 'Solo',
                price: 79,
                deals: '5 deals/mo',
                desc: 'For individual investors evaluating deals',
                features: ['5 scored deals per month', '17-dimension analysis', 'Deal pipeline & status', 'PDF export', 'Email support'],
                popular: false,
              },
              {
                name: 'Advisor',
                price: 199,
                deals: '25 deals/mo',
                desc: 'For active acquirers and advisors',
                features: ['25 scored deals per month', 'Everything in Solo', 'Deal comparison tool', 'Notes & tags', 'Priority support'],
                popular: true,
              },
              {
                name: 'Fund',
                price: 499,
                deals: 'Unlimited',
                desc: 'For PE, family offices, aggregators',
                features: ['Unlimited scored deals', 'Everything in Advisor', 'Dedicated support', 'Team access (coming soon)', 'API access (coming soon)'],
                popular: false,
              },
            ].map(plan => (
              <div key={plan.name} style={{
                background: plan.popular ? 'linear-gradient(135deg, #112236 0%, rgba(0,180,160,0.08) 100%)' : '#0d1b2a',
                border: `1.5px solid ${plan.popular ? 'var(--teal)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12,
                padding: '32px 28px',
                position: 'relative',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--teal)', color: '#0d1b2a', fontSize: 11, fontWeight: 700,
                    padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.05em',
                  }}>MOST POPULAR</div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{plan.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 42, fontWeight: 800, color: plan.popular ? 'var(--teal)' : '#fff', letterSpacing: -1 }}>${plan.price}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>/mo</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 600, marginBottom: 24 }}>{plan.deals}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', gap: 8, fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                      <span style={{ color: 'var(--teal)', flexShrink: 0 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onGoToApp}
                  style={{
                    width: '100%',
                    background: plan.popular ? 'var(--teal)' : 'transparent',
                    color: plan.popular ? '#0d1b2a' : 'var(--teal)',
                    border: `1.5px solid var(--teal)`,
                    borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 15,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Get started →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ CTA ══════════════ */}
      <section style={{ background: 'var(--navy)', padding: '120px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }} className="cta-section-inner">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(0,180,160,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="land-fade" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16, display: 'inline-block' }}>Get Started</div>
          <h2 className="land-fade d1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 3.5vw, 52px)', fontWeight: 900, letterSpacing: -1, lineHeight: 1.1, color: '#fff', maxWidth: 700, margin: '0 auto 16px' }}>
            The next childcare deal<br />you look at could be your best.
          </h2>
          <p className="land-fade d2" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 17, marginBottom: 40 }}>
            Or your worst. Know the difference before you sign.
          </p>
          <div className="land-fade d3" style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="land-btn-primary" onClick={onGoToApp}>Upload an IM Free →</button>
            <a href="#benchmarks" className="land-btn-outline">See the framework</a>
          </div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer style={{ background: '#080f18', padding: '40px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#fff' }}>
          Acquira<span style={{ color: 'var(--teal)' }}>.</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
          Purpose-built for childcare acquisition due diligence. Not general AI.
        </p>
        <div style={{ display: 'flex', gap: 24 }}>
          {[['Pricing', '#pricing'], ['Privacy', '#'], ['Terms', '#'], ['Contact', '#']].map(([l, href]) => (
            <a key={l} href={href} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textDecoration: 'none' }}>{l}</a>
          ))}
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.08)', cursor: 'default' }}>Not financial advice.</span>
        </div>
      </footer>
    </div>
  )
}
