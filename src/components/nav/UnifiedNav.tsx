'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { signOut, supabase } from '@/lib/useAuth'

type NavMode = 'landing' | 'app' | 'report'

interface UnifiedNavProps {
  mode: NavMode
  activeAppTab?: 'upload' | 'list' | 'report' | 'map'
  onLogoClick: () => void
  onUpload?: () => void
  onPipeline?: () => void
  onReport?: () => void
  onMap?: () => void
  onHome?: () => void
  centreLabel?: string
  user?: User | null
  onSignIn?: () => void
}

interface BillingStatus {
  plan: string | null
  status: string | null
  dealsUsed: number
  dealsMax: number | null
  dealsRemaining: number | null
}

export default function UnifiedNav({
  mode, activeAppTab, onLogoClick, onUpload, onPipeline,
  onReport, onMap, onHome, centreLabel, user, onSignIn,
}: UnifiedNavProps) {
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!user) { setBillingStatus(null); return }
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (!token) return
      fetch('/api/billing/status', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setBillingStatus(d) })
        .catch(() => {})
    })
  }, [user])

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpen])

  const navStyle: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 32px', height: 54,
    background: 'rgba(13,27,42,0.98)', backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(0,180,160,0.15)',
    fontFamily: "'DM Sans', sans-serif",
  }

  const logoStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    cursor: 'pointer', textDecoration: 'none',
    fontFamily: "'Playfair Display', serif",
    fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px',
    background: 'none', border: 'none',
  }

  const logoIcon: React.CSSProperties = {
    width: 28, height: 28, background: '#00b4a0', borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, flexShrink: 0,
  }

  const links: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4 }

  const linkBase: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500,
    color: 'rgba(255,255,255,0.5)', cursor: 'pointer', border: 'none',
    background: 'none', fontFamily: "'DM Sans', sans-serif",
    display: 'flex', alignItems: 'center', gap: 6,
    textDecoration: 'none', transition: 'all 0.2s',
  }

  const linkActive: React.CSSProperties = {
    ...linkBase, color: '#fff',
    background: 'rgba(0,180,160,0.12)', border: '1px solid rgba(0,180,160,0.2)',
  }

  const sep: React.CSSProperties = {
    width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: 'none', background: '#00b4a0', color: '#fff',
    fontFamily: "'DM Sans', sans-serif",
  }

  const btnGhost: React.CSSProperties = {
    padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)',
    fontFamily: "'DM Sans', sans-serif",
  }

  const badge: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', background: 'rgba(0,180,160,0.1)',
    border: '1px solid rgba(0,180,160,0.25)', borderRadius: 100,
    fontSize: 11, fontWeight: 700, color: '#00b4a0',
    letterSpacing: '0.08em', textTransform: 'uppercase' as const,
  }

  // Billing badge
  const BillingBadge = () => {
    if (!billingStatus || !billingStatus.status) return null
    const { plan, dealsUsed, dealsMax } = billingStatus
    if (!plan) return null
    const label = dealsMax === null
      ? 'Unlimited'
      : `${dealsUsed}/${dealsMax} deals`
    const pct = dealsMax ? dealsUsed / dealsMax : 0
    const color = pct >= 0.9 ? '#ef4444' : pct >= 0.7 ? '#f59e0b' : '#00b4a0'
    return (
      <div style={{
        padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
        background: `rgba(${color === '#00b4a0' ? '0,180,160' : color === '#f59e0b' ? '245,158,11' : '239,68,68'},0.12)`,
        border: `1px solid ${color}33`,
        color,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '0.02em',
      }}>
        {label}
      </div>
    )
  }

  // User avatar + sign out pill
  const UserChip = () => {
    if (!user) return null
    const initials = user.email ? user.email[0].toUpperCase() : '?'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BillingBadge />
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(0,180,160,0.2)', border: '1px solid rgba(0,180,160,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#00b4a0',
        }}>{initials}</div>
        <button onClick={() => signOut()} style={{
          ...btnGhost, padding: '5px 12px', fontSize: 12,
        }}>Sign out</button>
      </div>
    )
  }

  // Hamburger icon (3 lines, pure CSS)
  const HamburgerIcon = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 20 }}>
      <span style={{ display: 'block', height: 2, background: '#fff', borderRadius: 1 }} />
      <span style={{ display: 'block', height: 2, background: '#fff', borderRadius: 1 }} />
      <span style={{ display: 'block', height: 2, background: '#fff', borderRadius: 1 }} />
    </div>
  )

  // Mobile menu link style
  const mobileLink: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    minHeight: 48, padding: '0 20px',
    fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer', border: 'none', background: 'none',
    fontFamily: "'DM Sans', sans-serif", textDecoration: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.06)', width: '100%',
    textAlign: 'left',
  }

  const mobileLinkActive: React.CSSProperties = {
    ...mobileLink,
    color: '#00b4a0',
    background: 'rgba(0,180,160,0.06)',
  }

  return (
    <>
      <nav style={navStyle}>
        <button style={logoStyle} onClick={onLogoClick}>
          <div style={logoIcon}>🏫</div>
          <span className="nav-logo-text">Acquira<span style={{ color: '#00b4a0' }}>.</span></span>
        </button>

        {/* Desktop nav links */}
        <div className="nav-desktop" style={links}>
          {/* ── LANDING MODE ── */}
          {mode === 'landing' && (
            <>
              <a href="#how" style={linkBase}>How It Works</a>
              <a href="#scoring" style={linkBase}>Framework</a>
              <a href="#benchmarks" style={linkBase}>Benchmarks</a>
              <a href="#try-map" style={linkBase}>Supply Map</a>
              <a href="#pricing" style={linkBase}>Pricing</a>
              <div style={sep} />
              {user ? (
                <>
                  <button style={linkActive} onClick={onUpload}>⬆ Upload IM</button>
                  <UserChip />
                </>
              ) : (
                <>
                  <button style={btnGhost} onClick={onSignIn}>Sign In</button>
                  <button style={btnPrimary} onClick={onSignIn}>⬆ Upload Free IM</button>
                </>
              )}
            </>
          )}

          {/* ── APP MODE ── */}
          {mode === 'app' && (
            <>
              <button style={activeAppTab === 'upload' ? linkActive : linkBase} onClick={onUpload}>
                ⬆ New Report
              </button>
              <button style={activeAppTab === 'list' ? linkActive : linkBase} onClick={onPipeline}>
                📋 Pipeline
              </button>
              {onReport && (
                <button style={activeAppTab === 'report' ? linkActive : linkBase} onClick={onReport}>
                  📊 Report
                </button>
              )}
              <button style={activeAppTab === 'map' ? linkActive : linkBase} onClick={onMap}>🗺️ Supply Map</button>
              <a href="/councils" style={linkBase} target="_blank" rel="noopener noreferrer">🏛 Planning</a>
              <a href="/pricing" style={linkBase} target="_blank" rel="noopener noreferrer">💳 Pricing</a>
              <div style={sep} />
              <div style={sep} />
              <UserChip />
            </>
          )}

          {/* ── REPORT MODE ── */}
          {mode === 'report' && (
            <>
              <button style={activeAppTab === 'upload' ? linkActive : linkBase} onClick={onUpload}>
                ⬆ New Report
              </button>
              <button style={activeAppTab === 'list' ? linkActive : linkBase} onClick={onPipeline}>
                📋 Pipeline
              </button>
              <div style={sep} />
              <div style={badge}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#00b4a0',
                  animation: 'pulse 2s infinite', display: 'inline-block',
                }} />
                {centreLabel ?? 'Live Report'}
              </div>
              <div style={sep} />
              <button style={btnGhost} onClick={onHome}>← Home</button>
              <div style={sep} />
              <UserChip />
            </>
          )}
        </div>

        {/* Mobile: condensed right side + hamburger */}
        <div className="nav-mobile" style={{ display: 'none', alignItems: 'center', gap: 8 }}>
          {/* In app/report mode show New Report button directly */}
          {(mode === 'app' || mode === 'report') && (
            <button
              style={{ ...btnPrimary, padding: '6px 14px', fontSize: 12 }}
              onClick={onUpload}
            >
              ⬆ New Report
            </button>
          )}
          {/* Hamburger button — 44×44 tap target */}
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
            style={{
              width: 44, height: 44, background: 'none', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', borderRadius: 8,
            }}
            aria-label="Menu"
          >
            <HamburgerIcon />
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 54, left: 0, right: 0,
              background: '#0d1b2a',
              borderBottom: '1px solid rgba(0,180,160,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 400,
            }}
          >
            {/* LANDING MODE mobile links */}
            {mode === 'landing' && (
              <>
                <a href="#how" style={mobileLink} onClick={() => setMenuOpen(false)}>How It Works</a>
                <a href="#scoring" style={mobileLink} onClick={() => setMenuOpen(false)}>Framework</a>
                <a href="#benchmarks" style={mobileLink} onClick={() => setMenuOpen(false)}>Benchmarks</a>
                <a href="#try-map" style={mobileLink} onClick={() => setMenuOpen(false)}>Supply Map</a>
                <a href="#pricing" style={mobileLink} onClick={() => setMenuOpen(false)}>Pricing</a>
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {user ? (
                    <>
                      <button style={{ ...btnPrimary, width: '100%', padding: '12px 0' }} onClick={() => { setMenuOpen(false); onUpload?.() }}>
                        ⬆ Upload IM
                      </button>
                      <button style={{ ...btnGhost, width: '100%', padding: '12px 0' }} onClick={() => { signOut(); setMenuOpen(false) }}>
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <button style={{ ...btnPrimary, width: '100%', padding: '12px 0' }} onClick={() => { setMenuOpen(false); onSignIn?.() }}>
                        ⬆ Upload Free IM
                      </button>
                      <button style={{ ...btnGhost, width: '100%', padding: '12px 0' }} onClick={() => { setMenuOpen(false); onSignIn?.() }}>
                        Sign In
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* APP MODE mobile links */}
            {mode === 'app' && (
              <>
                <button style={activeAppTab === 'list' ? mobileLinkActive : mobileLink} onClick={() => { setMenuOpen(false); onPipeline?.() }}>
                  📋 Pipeline
                </button>
                <a href="/councils" style={mobileLink} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                  🏛 Planning Research
                </a>
                <button style={mobileLink} onClick={() => { setMenuOpen(false); onHome?.() }}>
                  ← Home
                </button>
                {user && (
                  <div style={{ padding: '12px 20px' }}>
                    <button style={{ ...btnGhost, width: '100%', padding: '12px 0' }} onClick={() => { signOut(); setMenuOpen(false) }}>
                      Sign out
                    </button>
                  </div>
                )}
              </>
            )}

            {/* REPORT MODE mobile links */}
            {mode === 'report' && (
              <>
                <button style={mobileLink} onClick={() => { setMenuOpen(false); onPipeline?.() }}>
                  📋 Pipeline
                </button>
                <button style={mobileLink} onClick={() => { setMenuOpen(false); onHome?.() }}>
                  ← Home
                </button>
                {user && (
                  <div style={{ padding: '12px 20px' }}>
                    <button style={{ ...btnGhost, width: '100%', padding: '12px 0' }} onClick={() => { signOut(); setMenuOpen(false) }}>
                      Sign out
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </nav>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        nav button:hover { opacity: 0.85; }

        @media (max-width: 767px) {
          .nav-desktop { display: none !important; }
          .nav-mobile  { display: flex !important; }
        }
        @media (min-width: 768px) {
          .nav-desktop { display: flex !important; }
          .nav-mobile  { display: none !important; }
        }
      `}</style>
    </>
  )
}
