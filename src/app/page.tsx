'use client'

import { useState } from 'react'
import LandingPage from '@/components/landing/LandingPage'
import UnifiedNav from '@/components/nav/UnifiedNav'
import UploadWidget from '@/components/upload/UploadWidget'
import ReportView from '@/components/report/ReportView'
import DealList from '@/components/deals/DealList'
import CompareView from '@/components/compare/CompareView'
import AuthModal from '@/components/auth/AuthModal'
import { useAuth, supabase } from '@/lib/useAuth'
import { getDeal } from '@/lib/deals'
import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'

// ── Sample deal for unauthenticated preview ────────────────────────────────────
const SAMPLE_EXTRACTED = {
  centre_name: 'Bayside Early Learning Centre',
  address: '12 Marine Parade',
  suburb: 'Brighton',
  state: 'VIC',
  postcode: '3186',
  licensed_places: 80,
  asking_price: 2800000,
  ebitda: 420000,
  occupancy_rate: 87,
  rent_per_annum: 195000,
  nqs_rating: 'Meeting NQS',
}

const SAMPLE_SCORED = {
  scoring_version: 'v2-sample',
  scoring_timestamp: new Date().toISOString(),
  centre_name: 'Bayside Early Learning Centre',
  total_score: 71,
  verdict: {
    category: 'passive_hold',
    one_liner: 'Solid inner-suburban centre with strong occupancy and NQS compliance — priced fairly for a passive operator.',
    recommended_buyer_profile: 'Passive investor or small group operator seeking stable cash yield with modest upside.',
  },
  dimensions: {
    occupancy_demand:       { score: 8.2, label: 'Occupancy & Demand',        summary: 'Strong 87% occupancy with 3-month waitlist across most age groups.', data_used: ['occupancy_rate', 'waitlist_depth'] },
    profitability_cashflow: { score: 7.1, label: 'Profitability & Cashflow',   summary: '$420K EBITDA on $1.85M revenue. 22.7% margin — above median for metro VIC.', data_used: ['ebitda', 'revenue'] },
    revenue_pricing:        { score: 6.8, label: 'Revenue & Pricing Power',    summary: 'Fees at market median. Limited pricing power without NQS uplift.', data_used: ['daily_fee', 'ccs_dependency'] },
    staffing_resilience:    { score: 6.5, label: 'Staffing & Labour',          summary: 'Educator costs at 54% of revenue. Minimal agency usage noted.', data_used: ['labour_ratio', 'agency_usage'] },
    lease_economics:        { score: 7.4, label: 'Lease Economics',            summary: 'Rent at 10.5% of revenue — within acceptable range. Make-good capped.', data_used: ['rent_pa', 'lease_terms'] },
    regulatory_quality:     { score: 7.0, label: 'Regulatory & Quality',       summary: 'Meeting NQS across all 7 quality areas. Last assessed 14 months ago.', data_used: ['nqs_rating', 'assessment_date'] },
    market_position:        { score: 6.9, label: 'Market Position',            summary: '2.8 kids per licensed place within 3km — balanced supply zone.', data_used: ['competitor_count', 'licensed_places'] },
    management_systems:     { score: 6.2, label: 'Management & Systems',       summary: 'Owner-operator runs centre daily. Transition risk flagged.', data_used: ['management_structure'] },
    valuation_structure:    { score: 6.7, label: 'Valuation & Deal Structure', summary: '6.7x EBITDA multiple. Within fair range for metro VIC at this occupancy.', data_used: ['asking_price', 'ebitda'] },
    upside_levers:          { score: 5.8, label: 'Upside Levers',              summary: 'Fee uplift headroom of ~$8/day. Occupancy near ceiling limits volume upside.', data_used: ['fee_gap', 'occupancy_rate'] },
    ccs_risk:               { score: 7.5, label: 'CCS / Subsidy Risk',         summary: 'Low CCS cliff exposure. Predominantly dual-income families.', data_used: ['ccs_dependency'], detail: { estimated_ccs_dependent_pct: 62, activity_test_exposure: 'low', subsidy_cliff_note: 'Catchment demographics suggest stable CCS eligibility.' } },
    lease_tail:             { score: 8.0, label: 'Lease Tail',                  summary: '12 years remaining + two 5-year options. Strong tenure for exit.', data_used: ['lease_expiry', 'options'], detail: { years_remaining: 12, options_available: 2, option_years_each: 5, total_potential_tenure: 22, landlord_obligations_noted: true } },
    capex_liability:        { score: 6.5, label: 'CAPEX Liability',             summary: 'Fit-out 6 years old. Outdoor equipment refresh likely within 3 years.', data_used: ['fit_out_age'], detail: { fit_out_age_years: 6, capex_mentioned_in_im: false, estimated_capex_risk: 'medium', notes: 'Outdoor play equipment showing wear per site visit notes.' } },
    staff_qualification_mix:{ score: 7.2, label: 'Staff Qualification Mix',    summary: '28% degree-qualified. Diploma-heavy team — manageable wage trajectory.', data_used: ['qualification_data'], detail: { degree_qualified_pct: 28, diploma_pct: 55, certificate_pct: 17, wage_trajectory_risk: 'low' } },
    fee_benchmarking:       { score: 6.0, label: 'Fee Benchmarking',           summary: 'Daily fee $168 vs suburb median $172. Slight below-market position.', data_used: ['daily_fee', 'suburb_median'], detail: { centre_daily_fee: 168, suburb_median_fee: 172, fee_position: 'below_market', pricing_power_note: 'Could support $5–8 increase without occupancy risk.' } },
    operator_quality:       { score: 7.8, label: 'Operator Quality Signal',    summary: 'Meeting NQS. 4 of 7 areas exceeding. No active conditions or notices.', data_used: ['nqs_data'], detail: { nqs_rating: 'Meeting NQS', last_assessment_date: '2024-01-15', months_since_assessment: 14, exceeding_areas_count: 4, active_conditions: false, active_notices: false, compliance_note: 'Solid compliance history. No enforcement action in 5 years.' } },
    enrolment_trend:        { score: 7.5, label: 'Enrolment Trend & Waitlist', summary: 'Occupancy stable at 87% for 18 months. Waitlist across 3 age groups.', data_used: ['occupancy_trend', 'waitlist'], detail: { current_occupancy_pct: 87, trend_direction: 'stable', waitlist_depth: 'moderate', occupancy_snapshot_date: '2025-10-31', trend_note: 'Seasonal dip in Jan/Feb typical for Brighton catchment.' } },
  },
  deal_breaker_flags: { any_triggered: false, flags: [] },
  audit_trail: {
    fields_missing: ['churn_rate', 'b_asc_status'],
    confidence: 'high',
    confidence_note: 'IM provided full financial statements and NQS documentation.',
  },
}

type View = 'landing' | 'upload' | 'report' | 'list' | 'sample' | 'compare'

export default function Home() {
  const { user, loading } = useAuth()

  const [view, setView]           = useState<View>('landing')
  const [showAuth, setShowAuth]   = useState(false)
  const [extracted, setExtracted] = useState<ExtractedDeal | null>(null)
  const [scored, setScored]       = useState<ScoredDeal | null>(null)
  const [dealId, setDealId]       = useState<string | null>(null)
  const [compareDeals, setCompareDeals] = useState<{ id: string; centre_name: string | null; total_score: number | null; scored: unknown }[]>([])

  function handleUploadIntent() {
    if (user) {
      setView('upload')
    } else {
      setShowAuth(true)
    }
  }

  function handleAuthClose() {
    setShowAuth(false)
    if (user) setView('upload')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1b2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  // ── Sample ────────────────────────────────────────────────────────────────
  if (view === 'sample') {
    return (
      <>
        {showAuth && <AuthModal onClose={handleAuthClose} />}
        <ReportView
          extracted={SAMPLE_EXTRACTED as unknown as ExtractedDeal}
          scored={SAMPLE_SCORED as unknown as ScoredDeal}
          dealId={null}
          onBack={() => setView('landing')}
          onNew={handleUploadIntent}
          sampleMode
        />
      </>
    )
  }

  // ── Landing ───────────────────────────────────────────────────────────────
  if (view === 'landing') {
    return (
      <>
        {showAuth && <AuthModal onClose={handleAuthClose} />}
        <LandingPage
          onGoToApp={handleUploadIntent}
          onViewSample={() => setView('sample')}
          user={user}
          onSignIn={() => setShowAuth(true)}
        />
      </>
    )
  }

  // ── Report ────────────────────────────────────────────────────────────────
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

  // ── Deal list ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1b2a' }}>
        <UnifiedNav
          mode="app" activeAppTab="list"
          onLogoClick={() => setView('landing')}
          onUpload={() => setView('upload')}
          onPipeline={() => setView('list')}
          onHome={() => setView('landing')}
          user={user}
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
          onCompare={(_ids, deals) => {
            setCompareDeals(deals as { id: string; centre_name: string | null; total_score: number | null; scored: unknown }[])
            setView('compare')
          }}
        />
      </div>
    )
  }

  // ── Compare ───────────────────────────────────────────────────────────────
  if (view === 'compare' && compareDeals.length >= 2) {
    return (
      <CompareView
        deals={compareDeals}
        onBack={() => setView('list')}
      />
    )
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  return (
    <main style={{
      minHeight: '100vh', background: '#0d1b2a', color: '#fff',
      display: 'flex', flexDirection: 'column'
    }}>
      <UnifiedNav
        mode="app" activeAppTab="upload"
        onLogoClick={() => setView('landing')}
        onUpload={() => setView('upload')}
        onPipeline={() => setView('list')}
        onHome={() => setView('landing')}
        user={user}
      />

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 560 }}>
          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
            letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 16,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Analyse a deal
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            Upload an IM or data room. Acquira extracts every metric and scores it
            across 17 dimensions in about 60 seconds.
          </p>
        </div>

        <UploadWidget
          onResult={async (ext, sc) => {
            const extracted = ext as ExtractedDeal
            const scored    = sc as ScoredDeal
            setExtracted(extracted)
            setScored(scored)
            try {
              const { data: { session } } = await supabase.auth.getSession()
              const res = await fetch('/api/save-deal', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({ extracted, scored, overrides: {} }),
              })
              const data = await res.json()
              setDealId(data.id ?? null)
            } catch (e) {
              console.error('save-deal failed:', e)
            }
            setView('report')
          }}
        />

        {/* Updated hint text to reflect new file type support */}
        <div style={{ display: 'flex', gap: 20, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['PDF · DOCX · XLSX · ZIP', 'Up to 30 files', '~60–120 seconds'].map(t => (
            <span key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Mono', monospace" }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </main>
  )
}
