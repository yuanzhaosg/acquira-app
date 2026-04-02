'use client'

import { useState } from 'react'
import LandingPage from '@/components/landing/LandingPage'
import UnifiedNav from '@/components/nav/UnifiedNav'
import UploadWidget from '@/components/upload/UploadWidget'
import ReportView from '@/components/report/ReportView'
import DealList from '@/components/deals/DealList'
import CompareView from '@/components/compare/CompareView'
import AuthModal from '@/components/auth/AuthModal'
import SupplyMapPage from '@/components/map/SupplyMapPage'
import { useAuth, supabase } from '@/lib/useAuth'
import { getDeal } from '@/lib/deals'
import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'

// ── Sample deal for unauthenticated preview ────────────────────────────────────
const SAMPLE_EXTRACTED = {
  meta: {
    extraction_version: 'v2.2-sample',
    extraction_date: '2026-03-28T10:00:00Z',
    source_type: 'pdf_im',
    source_files: ['Bayside_ELC_IM_2026.pdf'],
    data_quality: 'HIGH',
    missing_fields_count: 2,
    missing_fields: ['churn_rate', 'b_asc_status'],
  },
  centre: {
    name: 'Bayside Early Learning Centre',
    trading_name: 'Bayside ELC',
    address: '12 Marine Parade, Brighton VIC 3186',
    suburb: 'Brighton',
    state: 'VIC' as const,
    postcode: '3186',
    lga: 'Bayside City Council',
    operator: 'Brighton Family Trust (Owner-Operator)',
    operator_type: 'owner_operator' as const,
    licensed_places: 80,
    nqs_rating: 'Meeting NQS' as const,
    nqs_date: '2024-01-15',
    service_approval_number: 'SE-VIC-12847',
  },
  occupancy: {
    avg_4wk_pct: 87,
    avg_13wk_pct: 86,
    avg_52wk_pct: 85,
    peak_pct: 94,
    fy23_avg_pct: 82,
    fy24_avg_pct: 85,
    fy25_avg_pct: 87,
    trend_fy23_to_fy25: 'improving' as const,
    waitlist_depth: 18,
    waitlist_notes: 'Waitlist across 0–2, 2–3, and 3–5 rooms. 18 children pending as at Oct 2025.',
  },
  financials: {
    primary_year: 'fy25',
    fy23: {
      revenue: 1680000, total_labour_cost: 924000, rent_pa: 178000,
      ebitda: 340000, ebitda_margin_pct: 20.2, labour_ratio_pct: 55.0, rent_ratio_pct: 10.6,
      is_provisional: false,
    },
    fy24: {
      revenue: 1760000, total_labour_cost: 950400, rent_pa: 184000,
      ebitda: 388000, ebitda_margin_pct: 22.0, labour_ratio_pct: 54.0, rent_ratio_pct: 10.5,
      is_provisional: false,
    },
    fy25: {
      revenue: 1850000, total_labour_cost: 999000, rent_pa: 195000,
      ebitda: 420000, ebitda_margin_pct: 22.7, labour_ratio_pct: 54.0, rent_ratio_pct: 10.5,
      is_provisional: false,
    },
    ebitda_3yr_average: 382667,
    revenue_trend: 'growing' as const,
    labour_trend: 'stable' as const,
    asking_price: 2800000,
    asking_price_ebitda_multiple: 6.67,
  },
  key_ratios: {
    occupancy_latest_4wk_pct: 87,
    ebitda_fy25: 420000,
    revenue_fy25: 1850000,
    labour_ratio_pct: 54.0,
    rent_ratio_pct: 10.5,
    ebitda_margin_pct: 22.7,
    asking_price: 2800000,
    ebitda_multiple: 6.67,
    price_per_place: 35000,
  },
  lease: {
    status: 'ACTIVE' as const,
    start_date: '2014-02-01',
    expiry_date: '2037-01-31',
    years_remaining: 11.8,
    options: [{ years: 5 }, { years: 5 }],
    annual_rent: 195000,
    rent_review_type: 'CPI' as const,
    make_good_capped: true,
    make_good_cap_amount: 80000,
    landlord_fitout_obligation: false,
  },
  staff: {
    headcount_fte: 22,
    degree_qualified_pct: 28,
    diploma_pct: 55,
    certificate_pct: 17,
    director_tenure_years: 4.5,
    agency_usage_pct: 2,
  },
  fees: {
    daily_fee_0_2: 185,
    daily_fee_2_3: 175,
    daily_fee_3_5: 162,
    daily_fee_blended: 168,
    suburb_median_fee: 172,
    fee_last_increased: '2025-01-01',
  },
}

const SAMPLE_SCORED = {
  scoring_version: 'v2.2-sample',
  scoring_timestamp: new Date().toISOString(),
  centre_name: 'Bayside Early Learning Centre',
  total_score: 71,
  verdict: {
    category: 'passive_hold',
    one_liner: 'Solid inner-bayside centre with strong occupancy and NQS compliance — fairly priced for a passive operator, with pipeline supply risk to monitor.',
    recommended_buyer_profile: 'Passive investor or small group operator seeking stable 7–8% cash-on-cash yield with modest fee uplift upside. Well-suited to an interstate or offshore family office seeking a set-and-forget Brighton asset.',
  },
  analyst_summary: 'Bayside ELC is a well-run, owner-operated centre in one of Melbourne\'s strongest childcare demographics. Revenue has grown from $1.68M to $1.85M over three years (+10.1%) with EBITDA margin improving from 20.2% to 22.7%. Labour is well-controlled at 54% — meaningfully below the 57–60% metro VIC median. The 6.67× EBITDA asking multiple is fair but not cheap; buyers should model a $5–8/day fee increase ($72K–$115K annualised revenue upside) and confirm occupancy sustainability given 2 approved DAs within 2km adding 165 places over the next 18–24 months.',
  dimensions: {
    occupancy_demand:       { score: 8.2, label: 'Occupancy & Demand',        summary: 'Strong 87% occupancy (13wk avg 86%). Improving trend: 82% FY23 → 87% FY25. Waitlist of 18 children across 3 rooms — structural demand confirmed. Brighton catchment shows 1.28 kids per licensed place (Balanced zone).', data_used: ['avg_4wk_pct', 'avg_13wk_pct', 'waitlist_depth', 'fy23_avg_pct', 'fy25_avg_pct'] },
    profitability_cashflow: { score: 7.1, label: 'Profitability & Cashflow',  summary: '$420K EBITDA on $1.85M revenue. 22.7% margin — above the metro VIC median of ~19%. 3-year EBITDA average $382K confirms consistency. Wage stress test: +10% labour cost would reduce EBITDA to $320K (7.6% margin) — above 4.5% defensive yield floor at ask. LOW wage stress risk.', data_used: ['ebitda', 'revenue', 'ebitda_margin_pct', 'ebitda_3yr_average', 'total_labour_cost'] },
    revenue_pricing:        { score: 6.8, label: 'Revenue & Pricing Power',   summary: 'Blended daily fee $168 vs suburb median $172 — slight below-market position creates $5–8/day uplift headroom (~$72K–$115K revenue upside). Fee last increased Jan 2025. Revenue growing 5.1% YoY — healthy trajectory.', data_used: ['daily_fee_blended', 'suburb_median_fee', 'revenue'] },
    staffing_resilience:    { score: 6.5, label: 'Staffing & Labour',         summary: 'Labour at 54% of revenue — 3–6pp below metro median. Agency usage minimal at 2%. Director 4.5 years tenure — transition risk if she departs post-sale. 28% degree-qualified: manageable wage trajectory. No active industrial disputes noted.', data_used: ['labour_ratio_pct', 'agency_usage_pct', 'director_tenure_years', 'degree_qualified_pct'] },
    lease_economics:        { score: 7.4, label: 'Lease Economics',           summary: 'Rent $195K = 10.5% of revenue — within the 9–13% acceptable range. CPI rent review provides inflation protection for tenant. Make-good capped at $80K — landlord risk contained. Lease expires Jan 2037 (11.8 years remaining).', data_used: ['rent_pa', 'rent_ratio_pct', 'rent_review_type', 'make_good_cap_amount'] },
    regulatory_quality:     { score: 7.0, label: 'Regulatory & Quality',      summary: 'Meeting NQS across all 7 quality areas. Last assessed Jan 2024 (14 months ago). 4 of 7 areas rated Exceeding. No active conditions or notices. No enforcement action in 5 years. Next assessment due Q2 2026.', data_used: ['nqs_rating', 'nqs_date', 'active_conditions', 'active_notices'] },
    market_position:        { score: 5.8, label: 'Market Position',           summary: '1.28 kids per licensed place within 2km — Balanced zone. MEDIUM pipeline risk: 2 approved DAs adding 165 places (206% of this centre\'s capacity) within 2km. Saturation penalty applied: –25%. DA pipeline score cap triggered. Brighton inner-bayside corridor has historically absorbed new supply via demand growth, but monitor closely.', data_used: ['competitor_count', 'licensed_places', 'pipeline_intel'] },
    management_systems:     { score: 6.2, label: 'Management & Systems',      summary: 'Owner-operator director manages centre daily — key person risk on transition. No documented succession plan. Centre management software (Xplor) in use. No second-in-command with operational authority. Recommend 6-month handover period in deal structure.', data_used: ['operator_type', 'director_tenure_years'] },
    valuation_structure:    { score: 6.7, label: 'Valuation & Deal Structure', summary: '6.67× EBITDA — fair for metro VIC at 87% occupancy. Price per place: $35,000 — within the $30K–$45K Brighton range. 3yr EBITDA average multiple: 7.3× (slightly elevated vs ask). No vendor finance offered. Standard commercial terms.', data_used: ['asking_price', 'ebitda', 'ebitda_multiple', 'price_per_place'] },
    upside_levers:          { score: 5.8, label: 'Upside Levers',              summary: 'Fee uplift: $5–8/day = $72K–$115K additional revenue at current occupancy. Occupancy already near ceiling (87% → limited volume upside). Labour efficiency already optimised. Kinder funding uplift possible if Pre-Prep rollout increases 4yo participation. Modest upside overall.', data_used: ['daily_fee_blended', 'suburb_median_fee', 'avg_4wk_pct'] },
    ccs_risk:               { score: 7.5, label: 'CCS / Subsidy Risk',         summary: 'CCS dependency estimated 62% of revenue. Activity test exposure: LOW — Brighton catchment is predominantly dual-income professional families with stable CCS eligibility. Revenue topology: Direct (LOW risk). No Pre-Prep rollout impact on 3–5 cohort detected — Brighton kindy network is private/independent dominated. Cohort risk: LOW.', data_used: ['ccs_dependency'], detail: { estimated_ccs_dependent_pct: 62, activity_test_exposure: 'low', subsidy_cliff_note: 'Dual-income professional catchment — stable CCS eligibility expected through 2027 reforms.', cohort_35_pct_estimated: 35 } },
    lease_tail:             { score: 8.0, label: 'Lease Tail',                 summary: '11.8 years remaining + two 5-year options = 21.8 years total potential tenure. Strong exit story for any buyer in 5–7 years. Landlord obligations documented. Rent review CPI-linked.', data_used: ['years_remaining', 'options'], detail: { years_remaining: 11.8, options_available: 2, option_years_each: 5, total_potential_tenure: 21.8, landlord_obligations_noted: true } },
    capex_liability:        { score: 6.5, label: 'CAPEX Liability',            summary: 'Fit-out approximately 6 years old (installed ~2020). Internal fit-out in good condition per IM photos. Outdoor equipment refresh likely required within 3 years (~$25K–$40K). No major CAPEX flagged in IM. Medium-term risk manageable.', data_used: ['nqs_date'], detail: { fit_out_age_years: 6, capex_mentioned_in_im: false, estimated_capex_risk: 'medium', notes: 'Outdoor play equipment showing wear per site visit notes. Budget $30K in Year 3.' } },
    staff_qualification_mix:{ score: 7.2, label: 'Staff Qualification Mix',   summary: '28% degree-qualified educators — above the VIC minimum (no minimum, but ACECQA benchmark ~20%). Diploma-heavy team (55%) minimises wage pressure vs degree-heavy centres. Certificate III at 17% — manageable. Low wage trajectory risk overall.', data_used: ['degree_qualified_pct', 'diploma_pct', 'certificate_pct'], detail: { degree_qualified_pct: 28, diploma_pct: 55, certificate_pct: 17, wage_trajectory_risk: 'low' } },
    fee_benchmarking:       { score: 6.5, label: 'Fee Benchmarking',          summary: 'Blended daily fee $168 vs suburb median $172 — 2.3% below market. Not at fee ceiling (top quartile ~$190). Premium differentiation: Reggio-inspired documentation approach noted in IM, outdoor learning program. Fee ceiling risk: NONE — room to move $5–8 before hitting ceiling.', data_used: ['daily_fee_blended', 'suburb_median_fee'], detail: { centre_daily_fee: 168, suburb_median_fee: 172, fee_position: 'below_market', pricing_power_note: 'Could support $5–8/day increase. Top quartile Brighton fee ~$190 — significant headroom.' } },
    operator_quality:       { score: 7.8, label: 'Operator Quality Signal',   summary: 'Meeting NQS (Jan 2024). 4 of 7 quality areas rated Exceeding — above median. No active conditions or notices. No enforcement action in 5+ years. Director with 4.5 years tenure — institutional knowledge risk on exit.', data_used: ['nqs_rating', 'nqs_date'], detail: { nqs_rating: 'Meeting NQS', last_assessment_date: '2024-01-15', months_since_assessment: 14, exceeding_areas_count: 4, active_conditions: false, active_notices: false, compliance_note: 'Exemplary compliance history. Assessed Jan 2024 — above average rating.' } },
    enrolment_trend:        { score: 7.5, label: 'Enrolment Trend & Waitlist', summary: 'Occupancy stable at 87% for 18+ months. FY23→FY25 trend: improving (82%→87%). Waitlist 18 children — 3 months depth. No significant seasonal dip beyond Jan/Feb. Structural demand confirmed.', data_used: ['avg_4wk_pct', 'waitlist_depth'], detail: { current_occupancy_pct: 87, trend_direction: 'stable', waitlist_depth: 'moderate', occupancy_snapshot_date: '2025-10-31', trend_note: 'Seasonal Jan/Feb dip typical for Brighton catchment — recovers by March each year.' } },
  },
  deal_breaker_flags: {
    any_triggered: true,
    flags: [
      {
        id: 'pipeline_supply_risk',
        label: 'DA Pipeline Supply Risk',
        severity: 'warning',
        reason: '2 approved DAs within 2km to add 165 licensed places (206% of this centre\'s capacity) within 18–24 months. Monitor occupancy impact post-opening. Not a deal-breaker in Brighton\'s strong demographic, but warrants sensitivity modelling.'
      }
    ]
  },
  audit_trail: {
    fields_missing: ['churn_rate', 'b_asc_status'],
    confidence: 'high',
    confidence_note: 'IM provided full 3-year P&L, lease abstract, NQS certificate, occupancy weekly data, and staff qualification breakdown. High confidence in all material metrics.',
  },
  pipeline_intel_used: true,
  effective_demand_ratio: 0.59,
  demand_zone: 'balanced',
  demand_context: {
    postcode: '3186', radius_km: 2, radius_label: 'dense urban', is_regional: false,
    estimated_kids_0_to_4: 909, total_licensed_places: 737, raw_kids_per_place: 1.23,
    ldc_util_rate: { low: 0.40, high: 0.55, mid: 0.475, is_regional: false },
    ldc_kids_range: { low: 364, mid: 432, high: 500 },
    adj_kids_per_place: { low: 0.49, mid: 0.59, high: 0.68 },
    zone: 'balanced', demand_trend: 'flat', growth_factor: 1.04, confidence: 'high', abs_hit: true,
  },
  market_context: {
    score: 5.8, edr_mid: 0.59, zone: 'balanced',
    demand_score: 4.0, competition_score: 5.0, pipeline_score: 3.0,
    comp_multiplier: 0.75, pipeline_ratio_subject: 2.06, pipeline_ratio_market: 0.22,
    competitor_count: 4, approved_pipeline_places: 165, risk_bucket: 'soft', confidence: 'high',
  },
  pipeline_intel: {
    approvedDAs: 2,
    lodgedDAs: 1,
    permitSites: 1,
    notes: '2 approved DAs add 165 places within 2km. 1 lodged DA (60 places, 0.9km) pending VCAT approval.',
    applications: [
      {
        address: '45 Church St, Brighton VIC 3186',
        description: 'Construction of a child care centre — 90 licensed places',
        status: 'approved',
        date: '2025-08-14',
        places: 90,
        distance_km: 1.1,
      },
      {
        address: '12 Bay Rd, Hampton VIC 3188',
        description: 'Early learning centre — 75 licensed places (DA approved, construction Q3 2026)',
        status: 'approved',
        date: '2025-11-22',
        places: 75,
        distance_km: 1.8,
      },
      {
        address: '88 Nepean Hwy, Brighton VIC 3186',
        description: 'Child care centre development — 60 places (lodged, VCAT objection pending)',
        status: 'lodged',
        date: '2026-01-15',
        places: 60,
        distance_km: 0.9,
      },
    ],
  },
}

type View = 'landing' | 'upload' | 'report' | 'list' | 'sample' | 'compare' | 'map'

export default function Home() {
  const { user, loading } = useAuth()

  const [view, setView]           = useState<View>('landing')
  const [showAuth, setShowAuth]   = useState(false)
  const [signupReason, setSignupReason] = useState<'upload' | 'map'>('upload')
  const [extracted, setExtracted] = useState<ExtractedDeal | null>(null)
  const [scored, setScored]       = useState<ScoredDeal | null>(null)
  const [dealId, setDealId]       = useState<string | null>(null)
  const [savedOverrides, setSavedOverrides] = useState<Record<string, number | string>>({})
  const [compareDeals, setCompareDeals] = useState<{ id: string; centre_name: string | null; total_score: number | null; scored: unknown }[]>([])

  function handleUploadIntent() {
    if (user) {
      setView('upload')
    } else {
      setSignupReason('upload')
      setShowAuth(true)
    }
  }

  function handleMapSignupIntent() {
    if (user) {
      setView('map')
    } else {
      setSignupReason('map')
      setShowAuth(true)
    }
  }

  function handleAuthClose() {
    setShowAuth(false)
    if (user) {
      // Route based on what triggered the signup
      if (signupReason === 'map') {
        setView('map')
      } else {
        setView('upload')
      }
    }
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
        {showAuth && <AuthModal onClose={handleAuthClose} reason={signupReason} />}
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
        {showAuth && <AuthModal onClose={handleAuthClose} reason={signupReason} />}
        <LandingPage
          onGoToApp={handleUploadIntent}
          onViewSample={() => setView('sample')}
          user={user}
          onSignIn={() => { setSignupReason('upload'); setShowAuth(true) }}
          onMapSignIn={handleMapSignupIntent}
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
        initialOverrides={savedOverrides}
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
              setSavedOverrides((deal.overrides as Record<string, number | string>) ?? {})
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

  // ── Supply Map ────────────────────────────────────────────────────────────
  if (view === 'map') {
    return (
      <SupplyMapPage
        user={user}
        onLogoClick={() => setView('landing')}
        onUpload={() => setView('upload')}
        onPipeline={() => setView('list')}
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
            // Save to pipeline before navigating to report
            let savedId: string | null = null
            try {
              // Always refresh session to get latest token
              const { data: { session: freshSession } } = await supabase.auth.getSession()
              if (!freshSession?.access_token) {
                // Not logged in — show report anyway, but skip save
                console.warn('save-deal: no session, skipping save')
              } else {
                const res = await fetch('/api/save-deal', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${freshSession.access_token}`,
                  },
                  body: JSON.stringify({ extracted, scored, overrides: {} }),
                })
                if (res.ok) {
                  const data = await res.json()
                  savedId = data.id ?? null
                } else {
                  const err = await res.json().catch(() => ({}))
                  console.error('save-deal failed:', res.status, err)
                  // Surface paywall errors so user knows what happened
                  if (res.status === 402) {
                    console.warn('Deal limit reached:', err.reason)
                  }
                }
              }
            } catch (e) {
              console.error('save-deal error:', e)
            }
            setDealId(savedId)
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
