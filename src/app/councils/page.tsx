'use client'

import { useState } from 'react'

type Council = {
  name: string
  url: string
  notes: string
}

const COUNCILS: Record<string, Council[]> = {
  VIC: [
    { name: 'Melbourne City Council',        url: 'https://development.melbourne.vic.gov.au/planning-register',           notes: 'Search: child care, early learning' },
    { name: 'Boroondara City Council',        url: 'https://eservices.boroondara.vic.gov.au/datrack/',                    notes: 'Search: childcare, early childhood' },
    { name: 'Monash City Council',            url: 'https://www.monash.vic.gov.au/Planning-Building/Planning/Planning-Applications', notes: 'Search: child care centre' },
    { name: 'Whitehorse City Council',        url: 'https://www.whitehorse.vic.gov.au/planning-applications',             notes: 'Search: early learning, childcare' },
    { name: 'Knox City Council',              url: 'https://www.knox.vic.gov.au/planning-permits',                        notes: 'Search: child care' },
    { name: 'Manningham City Council',        url: 'https://www.manningham.vic.gov.au/building-planning/planning/planning-applications', notes: 'Search: early learning centre' },
    { name: 'Maroondah City Council',         url: 'https://www.maroondah.vic.gov.au/Planning-permits',                   notes: 'Search: childcare, kinder' },
    { name: 'Yarra City Council',             url: 'https://www.yarracity.vic.gov.au/planning-and-building/planning-applications', notes: 'Search: child care, early childhood' },
    { name: 'Glen Eira City Council',         url: 'https://www.gleneira.vic.gov.au/planning-permits',                    notes: 'Search: child care centre' },
    { name: 'Bayside City Council',           url: 'https://www.bayside.vic.gov.au/planning',                             notes: 'Search: early learning, childcare' },
    { name: 'Moonee Valley City Council',     url: 'https://www.mvcc.vic.gov.au/planning',                                notes: 'Search: child care' },
    { name: 'Darebin City Council',           url: 'https://www.darebin.vic.gov.au/planning-building-permits',            notes: 'Search: early childhood, childcare' },
  ],
  NSW: [
    { name: 'City of Sydney Council',         url: 'https://da.cityofsydney.nsw.gov.au/',                                 notes: 'Search: child care centre, early learning' },
    { name: 'Northern Beaches Council',       url: 'https://www.northernbeaches.nsw.gov.au/services/planning-and-building/development-applications', notes: 'Search: child care' },
    { name: 'Ku-ring-gai Council',            url: 'https://www.kmc.nsw.gov.au/planning_and_development/development_applications', notes: 'Search: early learning, childcare' },
    { name: 'Ryde City Council',              url: 'https://www.ryde.nsw.gov.au/Planning/Development-Applications',       notes: 'Search: child care centre' },
    { name: 'Parramatta City Council',        url: 'https://eservices.parracity.nsw.gov.au/datracking/',                  notes: 'Search: early childhood, childcare' },
    { name: 'Blacktown City Council',         url: 'https://www.blacktown.nsw.gov.au/Planning-and-Building/Development-applications', notes: 'Search: child care' },
    { name: 'Lane Cove Council',              url: 'https://www.lanecove.nsw.gov.au/planning/development-applications/',  notes: 'Search: early learning' },
    { name: 'Willoughby City Council',        url: 'https://www.willoughby.nsw.gov.au/Planning-Building/Development-Applications', notes: 'Search: child care, kinder' },
    { name: 'Mosman Council',                 url: 'https://www.mosman.nsw.gov.au/council/services/planning/development-applications', notes: 'Search: early childhood' },
    { name: 'Strathfield Council',            url: 'https://www.strathfield.nsw.gov.au/building-planning/development-applications', notes: 'Search: childcare, early learning' },
    { name: 'Canterbury-Bankstown Council',   url: 'https://www.cbcity.nsw.gov.au/planning-and-building/development-applications', notes: 'Search: child care centre' },
  ],
  QLD: [
    { name: 'Brisbane City Council',          url: 'https://developmenti.brisbane.qld.gov.au/',                           notes: 'Search: child care, early learning' },
    { name: 'Gold Coast City Council',        url: 'https://eplanning.goldcoast.qld.gov.au/',                             notes: 'Search: childcare, early childhood' },
    { name: 'Sunshine Coast Council',         url: 'https://eplanning.sunshinecoast.qld.gov.au/',                         notes: 'Search: child care centre' },
    { name: 'Moreton Bay Regional Council',   url: 'https://eplanning.moretonbay.qld.gov.au/',                            notes: 'Search: early learning, childcare' },
    { name: 'Logan City Council',             url: 'https://eplanning.logan.qld.gov.au/',                                 notes: 'Search: child care' },
    { name: 'Ipswich City Council',           url: 'https://eplanning.ipswich.qld.gov.au/',                               notes: 'Search: early childhood centre' },
    { name: 'Townsville City Council',        url: 'https://eplanning.townsville.qld.gov.au/',                            notes: 'Search: childcare, child care' },
    { name: 'Cairns Regional Council',        url: 'https://eplanning.cairns.qld.gov.au/',                                notes: 'Search: early learning' },
    { name: 'Redland City Council',           url: 'https://eplanning.redland.qld.gov.au/',                               notes: 'Search: child care centre' },
    { name: 'Toowoomba Regional Council',     url: 'https://eplanning.toowoomba.qld.gov.au/',                             notes: 'Search: childcare, kinder' },
    { name: 'Rockhampton Regional Council',   url: 'https://eplanning.rockhamptonregion.qld.gov.au/',                     notes: 'Search: child care' },
  ],
  WA: [
    { name: 'City of Perth',                  url: 'https://www.perth.wa.gov.au/planning-development/development-applications', notes: 'Search: child care, early learning' },
    { name: 'City of Stirling',               url: 'https://www.stirling.wa.gov.au/planning',                             notes: 'Search: childcare centre' },
    { name: 'City of Joondalup',              url: 'https://www.joondalup.wa.gov.au/planning',                            notes: 'Search: early learning, child care' },
    { name: 'City of Swan',                   url: 'https://www.swan.wa.gov.au/planning',                                 notes: 'Search: childcare' },
    { name: 'City of Melville',               url: 'https://www.melvillecity.com.au/planning',                            notes: 'Search: child care centre' },
    { name: 'City of Canning',                url: 'https://www.canning.wa.gov.au/planning',                              notes: 'Search: early childhood' },
    { name: 'City of Gosnells',               url: 'https://www.gosnells.wa.gov.au/planning',                             notes: 'Search: childcare, child care' },
    { name: 'City of Wanneroo',               url: 'https://www.wanneroo.wa.gov.au/planning',                             notes: 'Search: early learning' },
  ],
  SA: [
    { name: 'City of Adelaide',               url: 'https://www.cityofadelaide.com.au/planning',                          notes: 'Search: child care, early learning' },
    { name: 'City of Charles Sturt',          url: 'https://www.charlessturt.sa.gov.au/planning',                         notes: 'Search: childcare centre' },
    { name: 'City of Onkaparinga',            url: 'https://www.onkaparinga.sa.gov.au/planning',                          notes: 'Search: early childhood, child care' },
    { name: 'City of Marion',                 url: 'https://www.marion.sa.gov.au/planning',                               notes: 'Search: childcare' },
    { name: 'City of Tea Tree Gully',         url: 'https://www.teatreegully.sa.gov.au/planning',                         notes: 'Search: early learning' },
    { name: 'City of Salisbury',              url: 'https://www.salisbury.sa.gov.au/planning',                            notes: 'Search: child care centre' },
    { name: 'City of Port Adelaide Enfield',  url: 'https://www.portenf.sa.gov.au/planning',                              notes: 'Search: childcare, kinder' },
    { name: 'City of Prospect',               url: 'https://www.prospect.sa.gov.au/planning',                             notes: 'Search: early childhood' },
  ],
}

const TABS = ['VIC', 'NSW', 'QLD', 'WA', 'SA'] as const

export default function CouncilsPage() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('VIC')

  return (
    <div style={{
      background: '#0d1b2a', minHeight: '100vh', color: '#e8edf3',
      fontFamily: "'DM Sans', sans-serif", fontSize: 14,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Space+Grotesk:wght@600;700&display=swap');
        * { box-sizing: border-box; }
        a { color: #00b4a0; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .councils-state-tabs { scrollbar-width: none; -ms-overflow-style: none; }
        .councils-state-tabs::-webkit-scrollbar { display: none; }
        .councils-state-tabs button { flex-shrink: 0; }
        @media (max-width: 480px) {
          .council-row { grid-template-columns: 1fr !important; }
          .council-link { min-height: 44px !important; justify-content: center !important; }
        }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 32px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(13,27,42,0.98)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <a href="/" style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700,
          color: '#fff', letterSpacing: '-0.3px',
        }}>
          Acquira<span style={{ color: '#00b4a0' }}>.</span>
        </a>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Planning Research</span>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        {/* Page title */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700,
            marginBottom: 8, letterSpacing: '-0.5px',
          }}>
            Council Planning Research
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, maxWidth: 640 }}>
            Find DA applications for childcare centres through your local council planning register.
            Use these links to search for recent approvals, lodged applications, and upcoming competition
            in your target market.
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
            <a href="https://www.planningalerts.org.au" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,180,160,0.1)', border: '1px solid rgba(0,180,160,0.25)',
              borderRadius: 6, padding: '6px 14px', fontSize: 13, color: '#00b4a0', fontWeight: 600,
            }}>
              🔍 Search PlanningAlerts.org.au →
            </a>
            <a href="https://www.planningalerts.org.au/where_to_find_planning_alerts" target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '6px 14px', fontSize: 13, color: 'rgba(255,255,255,0.5)',
            }}>
              Where to find planning alerts →
            </a>
          </div>
        </div>

        {/* Search tip */}
        <div style={{
          background: 'rgba(0,180,160,0.06)', border: '1px solid rgba(0,180,160,0.15)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 28,
          fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
        }}>
          <strong style={{ color: '#00b4a0' }}>Search tip:</strong> When searching council registers, try keywords like{' '}
          <span style={{ fontFamily: "'DM Mono', monospace", color: '#e8edf3' }}>"child care centre"</span>,{' '}
          <span style={{ fontFamily: "'DM Mono', monospace", color: '#e8edf3' }}>"early learning"</span>,{' '}
          <span style={{ fontFamily: "'DM Mono', monospace", color: '#e8edf3' }}>"early childhood"</span>,{' '}
          <span style={{ fontFamily: "'DM Mono', monospace", color: '#e8edf3' }}>"kindergarten"</span>.
          Filter by status "Approved" or "Determined" to find supply already in the pipeline.
        </div>

        {/* State tabs */}
        <div className="councils-state-tabs" style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any, scrollbarWidth: 'none' as any }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 600,
                border: 'none', borderBottom: activeTab === tab ? '2px solid #00b4a0' : '2px solid transparent',
                background: 'none', cursor: 'pointer',
                color: activeTab === tab ? '#00b4a0' : 'rgba(255,255,255,0.4)',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Council list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(COUNCILS[activeTab] ?? []).map((council, i) => (
            <div key={i} className="council-row" style={{
              background: '#112236', border: '1px solid #1e3a5f', borderRadius: 8,
              padding: '14px 16px',
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 600, color: '#e8edf3', marginBottom: 4, fontSize: 14 }}>
                  {council.name}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>
                  {council.notes}
                </div>
              </div>
              <a
                href={council.url}
                target="_blank"
                rel="noopener noreferrer"
                className="council-link"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(0,180,160,0.08)', border: '1px solid rgba(0,180,160,0.2)',
                  borderRadius: 6, padding: '6px 14px',
                  fontSize: 12, color: '#00b4a0', fontWeight: 600,
                  whiteSpace: 'nowrap', textDecoration: 'none',
                }}
              >
                Planning portal →
              </a>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 32, fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
          Council portal URLs were current as at March 2026. Councils occasionally update their portal URLs — if a link is broken,
          search "[Council name] planning applications" to find the current portal.
          <br />
          <br />
          For automated DA monitoring, see{' '}
          <a href="https://www.planningalerts.org.au" target="_blank" rel="noopener noreferrer">PlanningAlerts.org.au</a>{' '}
          (free email alerts for planning applications near any address).
        </div>
      </div>
    </div>
  )
}
