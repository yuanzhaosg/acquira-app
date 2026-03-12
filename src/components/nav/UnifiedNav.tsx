'use client'

import type { User } from '@supabase/supabase-js'
import { signOut } from '@/lib/useAuth'

type NavMode = 'landing' | 'app' | 'report'

interface UnifiedNavProps {
  mode: NavMode
  activeAppTab?: 'upload' | 'list' | 'report'
  onLogoClick: () => void
  onUpload?: () => void
  onPipeline?: () => void
  onReport?: () => void
  onHome?: () => void
  centreLabel?: string
  user?: User | null
  onSignIn?: () => void
}

export default function UnifiedNav({
  mode, activeAppTab, onLogoClick, onUpload, onPipeline,
  onReport, onHome, centreLabel, user, onSignIn,
}: UnifiedNavProps) {

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

  // User avatar + sign out pill
  const UserChip = () => {
    if (!user) return null
    const initials = user.email ? user.email[0].toUpperCase() : '?'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

  return (
    <nav style={navStyle}>
      <button style={logoStyle} onClick={onLogoClick}>
        <div style={logoIcon}>🏫</div>
        Acquira<span style={{ color: '#00b4a0' }}>.</span>
      </button>

      <div style={links}>
        {/* ── LANDING MODE ── */}
        {mode === 'landing' && (
          <>
            <a href="#how" style={linkBase}>How It Works</a>
            <a href="#scoring" style={linkBase}>Framework</a>
            <a href="#benchmarks" style={linkBase}>Benchmarks</a>
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
            <div style={sep} />
            <button style={btnGhost} onClick={onHome}>← Home</button>
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

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        nav button:hover { opacity: 0.85; }
      `}</style>
    </nav>
  )
}
