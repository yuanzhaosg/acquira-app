'use client'

import { useEffect, useRef } from 'react'
import UnifiedNav from '@/components/nav/UnifiedNav'

interface LandingPageProps {
  onGoToApp: () => void
}

export default function LandingPage({ onGoToApp }: LandingPageProps) {
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
          .scoring-grid-2col { grid-template-columns: 1fr !important; }
          .cta-section-inner { padding: 80px 24px !important; }
        }
      `}</style>

      {/* UNIFIED NAV */}
      <UnifiedNav
        mode="landing"
        onLogoClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onUpload={onGoToApp}
      />

      {/* ══════════════ HERO ══════════════ */}
      <section style={{
        minHeight: '100vh',
        background: 'var(--navy)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'center',
        gap: 0,
        padding: '120px 48px 80px',
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
            Upload any Information Memorandum. Get a structured acquisition report with competitive mapping, demand analysis, scoring across 10 key dimensions, and red flags — in under 60 seconds.
          </p>

          <div className="land-fade d3" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 48 }}>
            <button className="land-btn-primary" onClick={onGoToApp}>Upload an IM Free →</button>
            <button className="land-btn-ghost" onClick={onGoToApp}>▶ See sample report</button>
          </div>

          <div className="land-fade d4" style={{ display: 'flex', gap: 40 }}>
            {[
              { num: '10x', label: 'faster due diligence' },
              { num: '10', label: 'scoring dimensions' },
              { num: '$0', label: 'to get started' },
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
                Acquira · Bright Futures Childcare
              </div>
            </div>

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '12px 14px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { val: '78%', label: 'Occupancy', color: '#22c55e' },
                { val: '80', label: 'Places', color: '#fff' },
                { val: '$1.32M', label: 'Revenue', color: '#f59e0b' },
                { val: '$425K', label: 'EBITDA', color: '#fff' },
              ].map(k => (
                <div key={k.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 500, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Mock map + score sidebar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px' }}>
              {/* Mini map */}
              <div style={{ padding: 0, overflow: 'hidden', height: 180 }}>
                <svg viewBox="0 0 280 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                  <rect width="280" height="180" fill="#e8f0e0" />
                  <line x1="0" y1="60" x2="280" y2="60" stroke="rgba(255,255,255,0.7)" strokeWidth="2"/>
                  <line x1="0" y1="120" x2="280" y2="120" stroke="rgba(255,255,255,0.7)" strokeWidth="2"/>
                  <line x1="80" y1="0" x2="80" y2="180" stroke="rgba(255,255,255,0.7)" strokeWidth="2"/>
                  <line x1="190" y1="0" x2="190" y2="180" stroke="rgba(255,255,255,0.7)" strokeWidth="2"/>
                  <rect x="10" y="10" width="30" height="20" rx="2" fill="rgba(180,180,160,0.5)"/>
                  <rect x="90" y="10" width="50" height="20" rx="2" fill="rgba(180,180,160,0.45)"/>
                  <rect x="200" y="10" width="40" height="20" rx="2" fill="rgba(180,180,160,0.5)"/>
                  <rect x="10" y="75" width="40" height="18" rx="2" fill="rgba(180,180,160,0.45)"/>
                  <rect x="90" y="72" width="60" height="22" rx="2" fill="rgba(180,180,160,0.4)"/>
                  <rect x="200" y="75" width="50" height="18" rx="2" fill="rgba(180,180,160,0.45)"/>
                  <circle cx="130" cy="88" r="68" fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.5)" strokeWidth="1.5" strokeDasharray="6,3"/>
                  <circle cx="210" cy="100" r="44" fill="rgba(245,158,11,0.15)" stroke="rgba(245,158,11,0.45)" strokeWidth="1.5" strokeDasharray="6,3"/>
                  <circle cx="128" cy="86" r="18" fill="#0d1b2a" stroke="white" strokeWidth="2"/>
                  <text x="128" y="91" textAnchor="middle" fontSize="11" fill="white" fontWeight="700" fontFamily="DM Sans">8.0</text>
                  <circle cx="78" cy="58" r="12" fill="#16a34a" stroke="white" strokeWidth="1.5"/>
                  <text x="78" y="62" textAnchor="middle" fontSize="8" fill="white" fontWeight="700">C</text>
                  <circle cx="185" cy="95" r="11" fill="#d97706" stroke="white" strokeWidth="1.5"/>
                  <text x="185" y="99" textAnchor="middle" fontSize="8" fill="white" fontWeight="700">C</text>
                  <circle cx="155" cy="130" r="10" fill="#ef4444" stroke="white" strokeWidth="1.5"/>
                  <text x="155" y="134" textAnchor="middle" fontSize="8" fill="white" fontWeight="700">C</text>
                  <rect x="54" y="32" width="30" height="13" rx="6" fill="white" opacity="0.9"/>
                  <text x="69" y="42" textAnchor="middle" fontSize="8" fill="#1a2e42" fontWeight="700">4.2 k/p</text>
                </svg>
              </div>

              {/* Score sidebar */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                padding: '12px 10px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ textAlign: 'center', padding: '4px 0' }}>
                  <svg viewBox="0 0 80 50" style={{ width: 80, height: 50 }}>
                    <path d="M 10 45 A 30 30 0 0 1 70 45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" strokeLinecap="round"/>
                    <path d="M 10 45 A 30 30 0 0 1 70 45" fill="none" stroke="#00b4a0" strokeWidth="7" strokeLinecap="round" strokeDasharray="94.2" strokeDashoffset="18.8"/>
                  </svg>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: '#fff', marginTop: -8 }}>8.0</div>
                  <div style={{ fontSize: 10, color: '#00b4a0', fontWeight: 700, letterSpacing: '0.05em' }}>Strong Buy</div>
                </div>
                {[
                  { label: 'Demand', val: 9, color: '#22c55e' },
                  { label: 'Staffing', val: 8, color: '#22c55e' },
                  { label: 'Revenue', val: 7, color: '#f59e0b' },
                  { label: 'Lease', val: 7, color: '#f59e0b' },
                  { label: 'Reg.', val: 8, color: '#22c55e' },
                ].map(d => (
                  <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{d.label}</span>
                    <span style={{ color: d.color, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{d.val}</span>
                  </div>
                ))}
                <div style={{ marginTop: 4, background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginBottom: 3 }}>⚠ Red Flags</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>· Lease exp. 2027</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>· Director departure</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ PROBLEM ══════════════ */}
      <section style={{ background: 'var(--cream)', padding: '100px 48px' }} id="problem">
        <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start', maxWidth: 1200, margin: '0 auto' }}>
          <div>
            <div className="land-fade" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 16 }}>The Problem</div>
            <h2 className="land-fade d1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 3.5vw, 52px)', fontWeight: 900, letterSpacing: -1, lineHeight: 1.1, color: 'var(--navy)', marginBottom: 24 }}>
              Two bad options.<br />We built a <em style={{ color: 'var(--teal)', fontStyle: 'italic' }}>third</em>.
            </h2>
            <p className="land-fade d2" style={{ fontSize: 17, lineHeight: 1.75, color: 'var(--text-muted)', marginBottom: 20 }}>
              When a broker sends you an Information Memorandum, your current options are: feed it to a generic AI that has no idea what "30-hour free kinder rollout" means — or spend 40 hours manually cross-checking ACECQA, ABS data, and driving past competitor car parks.
            </p>
            <p className="land-fade d3" style={{ fontSize: 17, lineHeight: 1.75, color: 'var(--text-muted)' }}>
              Childcare acquisitions are local, policy-sensitive, and operationally complex. A general AI doesn't know that a VIC centre faces structurally different risk to an equivalent WA centre. It can't show you the 7 competing centres within 3km, or that there are 2,841 children aged 0–4 competing for 451 licensed places in the catchment.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: '🤖', title: 'Generic AI (ChatGPT / Gemini)', text: 'No local competitor data. No demand gap analysis. No policy context. No consistent scoring. Just a summary of whatever you uploaded.', accent: 'var(--red)' },
              { icon: '📊', title: 'Manual Spreadsheet Process', text: '40+ hours per deal. Call ACECQA. Cross-check ABS. Drive past competitors. Build formulas. Miss the approved sites in the pipeline.', accent: 'var(--red)' },
              { icon: '✅', title: 'Acquira — Purpose-Built for Childcare', text: 'State-aware scoring. Competitive mapping. Demand vs supply gap. 10-dimension framework. Structured report in 60 seconds.', accent: 'var(--teal)' },
            ].map((c) => (
              <div key={c.title} className="land-fade problem-card" style={{
                background: '#fff', border: '1px solid var(--cream-dark)',
                borderRadius: 12, padding: 24, position: 'relative', overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c.accent }} />
                <div style={{ fontSize: 22, marginBottom: 10 }}>{c.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>{c.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>{c.text}</p>
              </div>
            ))}
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
              { num: '02', icon: '🧠', title: 'AI Parses & Scores', text: 'Extracts financials, occupancy, lease terms, staff metrics — then scores across 10 dimensions with state-aware context.' },
              { num: '03', icon: '🗺️', title: 'Competitive Map', text: 'See all competing centres within 3–5km, demand-to-supply ratios, approved pipeline sites, and demographic catchment data.' },
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
            10 dimensions. <em style={{ color: 'var(--teal)', fontStyle: 'italic' }}>One</em><br />consistent decision.
          </h2>
          <p className="land-fade d2" style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 560, marginBottom: 48 }}>
            Every centre is evaluated across the same framework, enabling true like-for-like comparison across deals, states, and operators.
          </p>
          <div className="scoring-grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[
              { icon: '👶', bg: '#dcfce7', title: 'Occupancy & Demand Quality', text: 'Stabilised occupancy, 12-month trend, waitlist depth, churn rate. The most critical dimension.', badge: 'Critical' },
              { icon: '💰', bg: '#fef3c7', title: 'Revenue & Pricing Power', text: 'ARPU vs local peers, fee growth history, CCS dependency, arrears rate.', badge: 'High' },
              { icon: '👩‍🏫', bg: '#fee2e2', title: 'Staffing & Labour Resilience', text: 'Educator cost as % revenue, turnover rate, agency usage, tenure. 2025\'s biggest risk.', badge: 'Critical' },
              { icon: '📈', bg: '#dcfce7', title: 'Profitability & Cashflow', text: 'EBITDA margin, normalised EBITDA after add-backs, operating cashflow, capex requirements.', badge: 'High' },
              { icon: '🏢', bg: '#e0f2fe', title: 'Lease & Property Economics', text: 'Rent as % revenue, remaining lease tenure, review mechanism. Can make or break the deal.', badge: 'High' },
              { icon: '📋', bg: '#faf5ff', title: 'Regulatory & Quality Profile', text: 'NQS rating (Meeting/Exceeding), compliance history, outstanding actions, incident frequency.', badge: 'High' },
              { icon: '🗺️', bg: '#fff7ed', title: 'Market & Competitive Position', text: 'Supply growth vs demand, approved pipelines, birth rates, workforce participation in catchment.', badge: 'High' },
              { icon: '⚙️', bg: '#f0fdf4', title: 'Management & Systems', text: 'Manager tenure, rostering/billing maturity, reporting quality, owner-dependency risk.', badge: 'Medium' },
              { icon: '🤝', bg: '#fef3c7', title: 'Valuation & Deal Structure', text: 'Price per place ($60k–$120k), EBITDA multiple (4.5x–6.5x), ROIC, downside protection.', badge: 'High' },
              { icon: '🚀', bg: '#dcfce7', title: 'Upside Levers', text: 'Fee uplift headroom, occupancy growth potential, cost efficiencies, B/ASC extension opportunity.', badge: 'Medium' },
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
                <div style={{ marginLeft: 'auto', flexShrink: 0, background: 'var(--navy)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, height: 'fit-content', whiteSpace: 'nowrap' }}>
                  {c.badge}
                </div>
              </div>
            ))}
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
          {['Privacy', 'Terms', 'Contact'].map(l => (
            <a key={l} href="#" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textDecoration: 'none' }}>{l}</a>
          ))}
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.08)', cursor: 'default' }}>Not financial advice.</span>
        </div>
      </footer>
    </div>
  )
}
