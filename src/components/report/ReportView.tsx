'use client'
import CompetitiveMap from '@/components/map/CompetitiveMap'
import { useState, useEffect } from 'react'
import type {
  ScoredDeal, BaseDimension, DimensionId, Conditional,
  CCSRiskDimension, LeaseTailDimension, CapexDimension,
  StaffQualificationDimension, FeeBenchmarkingDimension,
  OperatorQualityDimension, EnrolmentTrendDimension,
  DealBreakerFlag,
} from '@/types/scored'
import type { ExtractedDeal } from '@/types/extracted'

// ── HELPERS ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 55) return '#00b4a0'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function dimScoreColor(score: number): string {
  if (score >= 7) return '#22c55e'
  if (score >= 5.5) return '#00b4a0'
  if (score >= 4) return '#f59e0b'
  return '#ef4444'
}

function scoreVerdict(score: number): string {
  if (score >= 75) return 'Strong Buy'
  if (score >= 65) return 'Attractive'
  if (score >= 55) return 'Conditional'
  if (score >= 45) return 'Caution'
  if (score >= 35) return 'High Risk'
  return 'Avoid'
}

function fmt(n: number | null | undefined, prefix = '', suffix = '', decimals = 0): string {
  if (n == null) return '—'
  return `${prefix}${n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
}

function fmtM(n: number | null | undefined): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// Score ring: input is 0–100
function ringOffset(score: number): number {
  const pct = Math.min(Math.max(score / 100, 0), 1)
  return 326.7 * (1 - pct)
}

// Resolve canonical score: v2 = total_score (0-100), v1 fallback = overall_score * 10
function resolveScore(s: ScoredDeal): number {
  if (typeof s.total_score === 'number') return s.total_score
  if (typeof s.overall_score === 'number') return s.overall_score * 10
  return 0
}

// Resolve dimension score: v2 = dim.score (0-10), v1 fallback = dim.raw_score
function dimScore(dim: any): number {
  return typeof dim.score === 'number' ? dim.score : (dim.raw_score ?? 0)
}

// Resolve dimension label: v2 = dim.label, v1 fallback = dim.name
function dimLabel(dim: any): string {
  return dim.label || dim.name || ''
}

// ── SCORE RING ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { setTimeout(() => setAnimated(true), 100) }, [])
  const color = scoreColor(score)
  const circ = 2 * Math.PI * 52

  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={52} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={52} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={animated ? ringOffset(score) : circ}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center', lineHeight: 1
      }}>
        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 32, color, fontWeight: 700 }}>
          {score.toFixed(1)}
        </span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>/100</span>
      </div>
    </div>
  )
}

// ── DIMENSION ROW ─────────────────────────────────────────────────────────────

function DimensionRow({ id, dim, isActive, onClick }: {
  id: string
  dim: any
  isActive: boolean
  onClick: () => void
}) {
  const score = dimScore(dim)
  const color = dimScoreColor(score)
  const label = dimLabel(dim)
  const weight = dim.weight ?? 0

  // Sprint 3 dimensions that have detail blocks
  const detailDims = ['ccs_risk','lease_tail','capex_liability','staff_qualification_mix','fee_benchmarking','operator_quality','enrolment_trend']
  const hasDetail = detailDims.includes(id) && dim.detail

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
        background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
        transition: 'all 0.15s', marginBottom: 4,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 52px', gap: 14, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginBottom: 2 }}>
            {label}
          </div>
          {weight > 0 && (
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
              {Math.round(weight * 100)}% weight
            </div>
          )}
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${(score / 10) * 100}%`,
            background: color,
            transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
          }} />
        </div>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 700, color, textAlign: 'right' }}>
          {score.toFixed(1)}
        </div>
      </div>

      {isActive && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {dim.summary && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.6 }}>
              {dim.summary}
            </p>
          )}

          {/* v1 signals */}
          {dim.signals && dim.signals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: hasDetail ? 12 : 0 }}>
              {dim.signals.map((sig: any, i: number) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px auto 1fr', gap: 10, alignItems: 'start' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>
                    {sig.id}
                  </span>
                  <span style={{
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    color: sig.pts > 0 ? '#00b4a0' : sig.pts < 0 ? '#ef4444' : 'rgba(255,255,255,0.3)',
                  }}>
                    {sig.pts > 0 ? `+${sig.pts}` : sig.pts}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, fontSize: 12.5 }}>
                    {sig.reasoning}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* v2 data_used tags */}
          {dim.data_used && dim.data_used.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: hasDetail ? 12 : 0 }}>
              {dim.data_used.map((field: string, i: number) => (
                <span key={i} style={{
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 10,
                  background: 'rgba(255,255,255,0.05)', borderRadius: 4,
                  padding: '2px 7px', color: 'rgba(255,255,255,0.35)'
                }}>{field}</span>
              ))}
            </div>
          )}

          {/* v2 Sprint 3 detail blocks */}
          {hasDetail && (
            <DetailBlock id={id} detail={dim.detail} />
          )}
        </div>
      )}
    </div>
  )
}

// ── DETAIL BLOCK (Sprint 3 dimensions) ───────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  const display = value == null ? '—' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>{display}</span>
    </div>
  )
}

function DetailBlock({ id, detail }: { id: string; detail: any }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', borderRadius: 6,
      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
      borderLeft: '2px solid rgba(0,180,160,0.25)'
    }}>
      {id === 'ccs_risk' && <>
        <DetailRow label="CCS dependent %" value={detail.estimated_ccs_dependent_pct != null ? `${detail.estimated_ccs_dependent_pct}%` : null} />
        <DetailRow label="Activity test risk" value={detail.activity_test_exposure} />
        {detail.subsidy_cliff_note && <DetailRow label="Note" value={detail.subsidy_cliff_note} />}
      </>}

      {id === 'lease_tail' && <>
        <DetailRow label="Years remaining" value={detail.years_remaining} />
        <DetailRow label="Options available" value={detail.options_available} />
        <DetailRow label="Years per option" value={detail.option_years_each} />
        <DetailRow label="Total potential tenure" value={detail.total_potential_tenure != null ? `${detail.total_potential_tenure} yrs` : null} />
        <DetailRow label="Landlord obligations" value={detail.landlord_obligations_noted} />
      </>}

      {id === 'capex_liability' && <>
        <DetailRow label="Fit-out age" value={detail.fit_out_age_years != null ? `${detail.fit_out_age_years} yrs` : null} />
        <DetailRow label="CAPEX in IM" value={detail.capex_mentioned_in_im} />
        <DetailRow label="Risk level" value={detail.estimated_capex_risk} />
        {detail.notes && <DetailRow label="Note" value={detail.notes} />}
      </>}

      {id === 'staff_qualification_mix' && <>
        <DetailRow label="Degree qualified" value={detail.degree_qualified_pct != null ? `${detail.degree_qualified_pct}%` : null} />
        <DetailRow label="Diploma" value={detail.diploma_pct != null ? `${detail.diploma_pct}%` : null} />
        <DetailRow label="Certificate" value={detail.certificate_pct != null ? `${detail.certificate_pct}%` : null} />
        <DetailRow label="Wage trajectory risk" value={detail.wage_trajectory_risk} />
      </>}

      {id === 'fee_benchmarking' && <>
        <DetailRow label="Centre daily fee" value={detail.centre_daily_fee != null ? `$${detail.centre_daily_fee}` : null} />
        <DetailRow label="Suburb median fee" value={detail.suburb_median_fee != null ? `$${detail.suburb_median_fee}` : null} />
        <DetailRow label="Fee position" value={detail.fee_position?.replace(/_/g, ' ')} />
        {detail.pricing_power_note && <DetailRow label="Note" value={detail.pricing_power_note} />}
      </>}

      {id === 'operator_quality' && <>
        <DetailRow label="NQS rating" value={detail.nqs_rating} />
        <DetailRow label="Last assessment" value={detail.last_assessment_date} />
        <DetailRow label="Months since assessment" value={detail.months_since_assessment} />
        <DetailRow label="Exceeding areas" value={detail.exceeding_areas_count != null ? `${detail.exceeding_areas_count} / 7` : null} />
        <DetailRow label="Active conditions" value={detail.active_conditions} />
        <DetailRow label="Active notices" value={detail.active_notices} />
        {detail.compliance_note && <DetailRow label="Note" value={detail.compliance_note} />}
      </>}

      {id === 'enrolment_trend' && <>
        <DetailRow label="Current occupancy" value={detail.current_occupancy_pct != null ? `${detail.current_occupancy_pct}%` : null} />
        <DetailRow label="Trend direction" value={detail.trend_direction} />
        <DetailRow label="Waitlist depth" value={detail.waitlist_depth} />
        <DetailRow label="Snapshot date" value={detail.occupancy_snapshot_date} />
        {detail.trend_note && <DetailRow label="Note" value={detail.trend_note} />}
      </>}
    </div>
  )
}

// ── EDITABLE METRIC CARD ──────────────────────────────────────────────────────

function EditableMetricCard({ label, value, note, color = '#e8edf3', editable, onSave, overridden }: {
  label: string; value: string; note?: string; color?: string
  editable?: boolean; onSave?: (val: string) => void; overridden?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  const handleSave = () => {
    if (input.trim() && onSave) onSave(input.trim())
    setEditing(false)
    setInput('')
  }

  return (
    <div style={{
      background: '#152336',
      border: overridden ? '1px solid rgba(0,180,160,0.35)' : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: 18, position: 'relative'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase', letterSpacing: '0.08em'
        }}>{label}</div>
        {editable && !editing && (
          <button onClick={() => setEditing(true)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            color: 'rgba(255,255,255,0.2)', fontSize: 13, lineHeight: 1, transition: 'color 0.15s'
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#00b4a0')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
          title="Override value">✎</button>
        )}
        {overridden && !editing && (
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#00b4a0', letterSpacing: '0.06em' }}>
            OVERRIDE
          </span>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <input
            autoFocus value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            placeholder={value === '—' ? 'Enter value' : value}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,180,160,0.4)',
              borderRadius: 6, padding: '6px 10px', color: '#e8edf3',
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 600,
              width: '100%', outline: 'none'
            }}
          />
          <button onClick={handleSave} style={{
            background: '#00b4a0', border: 'none', borderRadius: 6,
            padding: '6px 12px', color: '#0d1b2a', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap'
          }}>Save</button>
          <button onClick={() => setEditing(false)} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6,
            padding: '6px 10px', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer'
          }}>✕</button>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>
            {value}
          </div>
          {note && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>{note}</div>}
        </>
      )}
    </div>
  )
}

// ── FLAG ITEM ─────────────────────────────────────────────────────────────────

function FlagItem({ severity, title, description, delay = 0 }: {
  severity: 'critical' | 'warning' | 'info'
  title: string; description: string; delay?: number
}) {
  const styles = {
    critical: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',     icon: '🔴' },
    warning:  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',   icon: '🟡' },
    info:     { bg: 'rgba(100,150,200,0.08)', border: 'rgba(100,150,200,0.15)', icon: '🔵' },
  }[severity]

  return (
    <div style={{
      background: styles.bg, border: `1px solid ${styles.border}`,
      borderRadius: 8, padding: '14px 16px',
      display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12,
      animation: `fadeUp 0.4s ease ${delay}s both`
    }}>
      <span style={{ fontSize: 15, lineHeight: 1.5 }}>{styles.icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8edf3', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>{description}</div>
      </div>
    </div>
  )
}

// ── SECTION TITLE ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
      marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)'
    }}>
      {children}
    </div>
  )
}

// ── VERDICT BADGE ─────────────────────────────────────────────────────────────

function VerdictBadge({ category }: { category?: string }) {
  if (!category) return null
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    passive_hold: { bg: 'rgba(34,197,94,0.1)',   text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
    turnaround:   { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
    distressed:   { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
    pass:         { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)' },
  }
  const s = styles[category] || styles.pass
  return (
    <span style={{
      fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
      padding: '3px 10px', borderRadius: 4, fontWeight: 600,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      textTransform: 'uppercase', letterSpacing: '0.06em'
    }}>{category.replace('_', ' ')}</span>
  )
}

// ── BADGE ─────────────────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: 'teal' | 'red' | 'amber' }) {
  const styles = {
    teal:  { bg: 'rgba(0,180,160,0.12)',  text: '#00b4a0', border: 'rgba(0,180,160,0.25)' },
    red:   { bg: 'rgba(239,68,68,0.10)',  text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
    amber: { bg: 'rgba(245,158,11,0.10)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  }[color]
  return (
    <span style={{
      fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
      padding: '3px 10px', borderRadius: 4, fontWeight: 600,
      background: styles.bg, color: styles.text, border: `1px solid ${styles.border}`
    }}>{children}</span>
  )
}

// ── MAIN REPORT VIEW ──────────────────────────────────────────────────────────

export default function ReportView({ extracted, scored, dealId, saving, onBack, onNew }: {
  extracted: ExtractedDeal; scored: ScoredDeal; dealId?: string | null
  saving?: boolean; onBack?: () => void; onNew?: () => void
}) {
  const [activeDim, setActiveDim]       = useState<string | null>(null)
  const [overrides, setOverrides]       = useState<Record<string, number>>({})
  const [currentScored, setCurrentScored] = useState<ScoredDeal>(scored)
  const [rescoring, setRescoring]       = useState(false)
  const [rescoreError, setRescoreError] = useState<string | null>(null)
  const [resaved, setResaved]           = useState(false)

  useEffect(() => { setCurrentScored(scored) }, [scored])

  const handleOverride = (field: string, rawVal: string) => {
    const num = parseFloat(rawVal.replace(/[$,%\s,]/g, ''))
    if (isNaN(num)) return
    setOverrides(prev => ({ ...prev, [field]: num }))
  }

  const handleRescore = async () => {
    setRescoring(true); setRescoreError(null); setResaved(false)
    try {
      const overriddenExtracted = JSON.parse(JSON.stringify(extracted))
      if (overrides.asking_price != null) {
        overriddenExtracted.financials.asking_price = overrides.asking_price
        overriddenExtracted.key_ratios.asking_price = overrides.asking_price
      }
      if (overrides.occupancy != null) {
        overriddenExtracted.occupancy.avg_4wk_pct = overrides.occupancy
        overriddenExtracted.key_ratios.occupancy_latest_4wk_pct = overrides.occupancy
      }
      if (overrides.ebitda != null) {
        if (overriddenExtracted.financials.fy25) overriddenExtracted.financials.fy25.ebitda = overrides.ebitda
        overriddenExtracted.key_ratios.ebitda_fy25 = overrides.ebitda
      }
      const res = await fetch('/api/rescore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted: overriddenExtracted, overrides })
      })
      if (!res.ok) throw new Error(await res.text())
      const newScored: ScoredDeal = await res.json()
      newScored.scoring_timestamp = new Date().toISOString()
      setCurrentScored(newScored)
      if (dealId) {
        await fetch('/api/update-deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dealId, scored: newScored, overrides })
        })
        setResaved(true)
      }
    } catch (e) {
      setRescoreError(e instanceof Error ? e.message : 'Rescore failed')
    } finally {
      setRescoring(false) }
  }

  const hasOverrides  = Object.keys(overrides).length > 0
  const centre        = extracted.centre
  const financials    = extracted.financials
  const occupancy     = extracted.occupancy
  const lease         = extracted.lease
  const ratios        = extracted.key_ratios
  const fy25          = financials?.fy25
  const hardFlags     = extracted.hard_flags || []
  const conditionals: Conditional[] = currentScored.conditionals || currentScored.audit_trail?.conditionals || []

  // Canonical score (0–100)
  const canonicalScore = resolveScore(currentScored)
  const mainColor      = scoreColor(canonicalScore)
  const verdict        = scoreVerdict(canonicalScore)

  // Flags: v2 deal_breaker_flags takes priority, fall back to v1 hard_flags_triggered
  const triggeredFlags: DealBreakerFlag[] = currentScored.deal_breaker_flags?.flags?.filter(f => f.triggered) ?? []
  const legacyFlagIds: string[]           = currentScored.hard_flags_triggered ?? []
  const hasFlagsToShow = triggeredFlags.length > 0 || legacyFlagIds.length > 0 || currentScored.score_capped

  const criticalFlagCount = triggeredFlags.filter(f => f.severity === 'critical').length
    + legacyFlagIds.filter(id => ['occupancy_critical','labour_ratio_critical','ebitda_negative_no_ramp','lease_expired'].includes(id)).length

  const effectiveOccupancy = overrides.occupancy ?? (occupancy?.avg_4wk_pct ?? occupancy?.current_month_pct)
  const effectiveEbitda    = overrides.ebitda ?? (fy25?.ebitda ?? ratios?.ebitda_fy25)
  const effectiveAskPrice  = overrides.asking_price ?? (financials?.asking_price ?? ratios?.asking_price)

  const metrics = [
    {
      label: 'Revenue (FY25)',
      value: fmtM(fy25?.revenue ?? ratios?.revenue_fy25),
      note: financials?.revenue_trend ? `Trend: ${financials.revenue_trend}` : undefined,
      color: '#00b4a0', editable: false,
    },
    {
      label: 'EBITDA (FY25)',
      value: fmtM(effectiveEbitda),
      note: fy25?.ebitda_margin_pct != null ? `${fy25.ebitda_margin_pct}% margin` : undefined,
      color: (effectiveEbitda ?? 0) > 0 ? '#00b4a0' : '#ef4444',
      editable: true, field: 'ebitda',
    },
    {
      label: 'Occupancy',
      value: fmt(effectiveOccupancy, '', '%', 1),
      note: occupancy?.avg_4wk_pct != null ? '4-week average' : 'Current month',
      color: (effectiveOccupancy ?? 0) >= 65 ? '#00b4a0' : (effectiveOccupancy ?? 0) >= 50 ? '#f59e0b' : '#ef4444',
      editable: true, field: 'occupancy',
    },
    {
      label: 'Labour Ratio',
      value: fmt(fy25?.labour_ratio_pct ?? ratios?.labour_ratio_fy25_pct, '', '%', 1),
      note: 'Target: 55–65%',
      color: (fy25?.labour_ratio_pct ?? 0) <= 65 ? '#00b4a0' : (fy25?.labour_ratio_pct ?? 0) <= 75 ? '#f59e0b' : '#ef4444',
      editable: false,
    },
    {
      label: 'Rent / Revenue',
      value: fmt(fy25?.rent_ratio_pct ?? ratios?.rent_ratio_fy25_pct, '', '%', 1),
      note: 'Target: <20%',
      color: (fy25?.rent_ratio_pct ?? 0) <= 20 ? '#00b4a0' : (fy25?.rent_ratio_pct ?? 0) <= 25 ? '#f59e0b' : '#ef4444',
      editable: false,
    },
    {
      label: 'Licensed Places',
      value: fmt(centre?.licensed_places),
      note: centre?.state ? `${centre.state} service` : undefined,
      color: '#e8edf3', editable: false,
    },
    {
      label: 'Asking Price',
      value: fmtM(effectiveAskPrice),
      note: financials?.asking_price_ebitda_multiple != null
        ? `${financials.asking_price_ebitda_multiple.toFixed(1)}× EBITDA` : undefined,
      color: '#e8edf3', editable: true, field: 'asking_price',
    },
    {
      label: 'NQS Rating',
      value: centre?.nqs_rating?.replace(' NQS', '') ?? '—',
      note: centre?.nqs_date ?? undefined,
      color: centre?.nqs_rating === 'Exceeding NQS' ? '#22c55e'
        : centre?.nqs_rating === 'Meeting NQS' ? '#00b4a0'
        : centre?.nqs_rating ? '#f59e0b' : 'rgba(255,255,255,0.3)',
      editable: false,
    },
  ]

  const dimEntries = Object.entries(currentScored.dimensions)

  return (
    <div style={{
      background: '#0d1b2a', color: '#e8edf3',
      fontFamily: 'IBM Plex Sans, sans-serif',
      minHeight: '100vh', fontSize: 14, lineHeight: 1.6
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d1b2a; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

        /* ── Mobile responsiveness ── */
        @media (max-width: 768px) {
          .report-hero       { grid-template-columns: 1fr !important; padding: 28px 20px 24px !important; }
          .report-score-dial { min-width: unset !important; width: 100% !important; }
          .report-metrics    { grid-template-columns: repeat(2, 1fr) !important; }
          .report-content    { padding: 24px 20px !important; }
          .report-header     { padding: 0 16px !important; }
          .report-header-right { gap: 6px !important; flex-wrap: wrap !important; }
          .dim-row-grid      { grid-template-columns: 1fr 1fr 44px !important; }
          .detail-row        { grid-template-columns: 120px 1fr !important; }
        }
        @media (max-width: 480px) {
          .report-metrics    { grid-template-columns: 1fr 1fr !important; }
          .report-hero h1    { font-size: 28px !important; }
        }
      `}</style>

      {/* ── STICKY HEADER ── */}
      <header className="report-header" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,27,42,0.96)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 32px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, color: '#00b4a0', fontWeight: 700
          }}>Acquira</button>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 18 }}>／</span>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: 'IBM Plex Sans, sans-serif'
          }}>← Pipeline</button>
        </div>
        <div className="report-header-right" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {centre?.state && <Badge color="teal">{centre.state}</Badge>}
          {criticalFlagCount > 0 && <Badge color="red">{criticalFlagCount} Critical Flag{criticalFlagCount > 1 ? 's' : ''}</Badge>}
          {currentScored.score_capped && <Badge color="amber">Score Capped</Badge>}
          {hasOverrides && <Badge color="amber">{Object.keys(overrides).length} Override{Object.keys(overrides).length > 1 ? 's' : ''}</Badge>}
          {saving && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono, monospace' }}>Saving…</span>}
          {!saving && dealId && !hasOverrides && <span style={{ fontSize: 11, color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace' }}>✓ Saved</span>}
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            v{currentScored.scoring_version} · {new Date().toLocaleDateString('en-AU')}
          </span>
          <button onClick={onNew} style={{
            background: 'rgba(0,180,160,0.1)', border: '1px solid rgba(0,180,160,0.25)',
            borderRadius: 6, padding: '6px 14px', color: '#00b4a0',
            fontSize: 12, cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 600
          }}>+ New Deal</button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="report-hero" style={{
        padding: '52px 40px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'start'
      }}>
        <div>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10
          }}>
            {centre?.address || 'Childcare Centre'}
          </div>
          <h1 style={{
            fontFamily: 'Space Grotesk, sans-serif', fontSize: 40, fontWeight: 700,
            lineHeight: 1.1, letterSpacing: '-1.2px', marginBottom: 8
          }}>
            {centre?.name || currentScored.centre_name}
          </h1>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, marginBottom: 16 }}>
            {[centre?.operator, centre?.licensed_places ? `${centre.licensed_places} Licensed Places` : null].filter(Boolean).join(' · ')}
          </div>

          {/* Verdict row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
            <VerdictBadge category={currentScored.verdict?.category} />
            {currentScored.verdict?.one_liner && (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                {currentScored.verdict.one_liner}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {[
              { label: 'Occupancy',    value: fmt(effectiveOccupancy, '', '%', 1) },
              { label: 'NQS Rating',   value: centre?.nqs_rating ?? '—' },
              { label: 'Lease',        value: lease?.options ? `${lease.term_years}yr + ${lease.options}` : lease?.remaining_term_years ? `${lease.remaining_term_years}yr remaining` : '—' },
              { label: 'Rent pa',      value: fmtM(lease?.base_rent_pa_fy25 ?? ratios?.rent_pa_fy25) },
              { label: 'Asking Price', value: fmtM(effectiveAskPrice) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono, monospace' }}>{label}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Score dial */}
        <div className="report-score-dial" style={{
          background: '#152336', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: '28px 32px', textAlign: 'center', minWidth: 200
        }}>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16
          }}>Weighted Score</div>
          <ScoreRing score={canonicalScore} />
          <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            <strong style={{ color: mainColor }}>{verdict}</strong>
            {conditionals.length > 0 && (
              <><br />{conditionals.length} conditional{conditionals.length > 1 ? 's' : ''} required</>
            )}
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <div className="report-content" style={{ padding: '40px', maxWidth: 1200 }}>

        {/* KEY METRICS */}
        <SectionTitle>Key Metrics</SectionTitle>
        <div className="report-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: hasOverrides ? 16 : 40 }}>
          {metrics.map(m => (
            <EditableMetricCard
              key={m.label} label={m.label} value={m.value} note={m.note} color={m.color}
              editable={m.editable}
              overridden={m.field ? overrides[m.field as string] != null : false}
              onSave={m.field ? (val) => handleOverride(m.field!, val) : undefined}
            />
          ))}
        </div>

        {/* RESCORE BAR */}
        {hasOverrides && (
          <div style={{
            background: 'rgba(0,180,160,0.08)', border: '1px solid rgba(0,180,160,0.2)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap'
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {Object.keys(overrides).map(k => (
                <span key={k} style={{ marginRight: 16 }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
                    {k.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  {' '}<span style={{ color: '#00b4a0', fontWeight: 600 }}>
                    {k === 'asking_price' || k === 'ebitda' ? fmtM(overrides[k]) : `${overrides[k]}%`}
                  </span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {rescoreError && <span style={{ fontSize: 12, color: '#ef4444' }}>{rescoreError}</span>}
              {resaved && <span style={{ fontSize: 12, color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace' }}>✓ Saved</span>}
              <button onClick={() => { setOverrides({}); setCurrentScored(scored) }} style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, padding: '7px 14px', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer'
              }}>Clear</button>
              <button onClick={handleRescore} disabled={rescoring} style={{
                background: rescoring ? 'rgba(0,180,160,0.4)' : '#00b4a0',
                border: 'none', borderRadius: 6, padding: '7px 18px',
                color: '#0d1b2a', fontWeight: 700, fontSize: 13,
                cursor: rescoring ? 'wait' : 'pointer'
              }}>{rescoring ? 'Rescoring…' : 'Rescore →'}</button>
            </div>
          </div>
        )}

        {/* COMPETITIVE MAP */}
        {extracted.centre?.address && (
          <div style={{ marginBottom: 40 }}>
            <SectionTitle>Competitive Map</SectionTitle>
            <CompetitiveMap
              address={extracted.centre.address}
              suburb={extracted.centre.suburb || ''}
              state={extracted.centre.state || ''}
              postcode={extracted.centre.postcode || ''}
              licensed_places={extracted.centre.licensed_places || 0}
              centre_name={scored.centre_name || ''}
              overall_score={canonicalScore}
            />
          </div>
        )}

        {/* FLAGS */}
        {hasFlagsToShow && (
          <>
            <SectionTitle>Flags & Observations</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
              {/* v2 deal_breaker_flags */}
              {triggeredFlags.map((flag, i) => (
                <FlagItem
                  key={flag.id}
                  severity={flag.severity === 'critical' ? 'critical' : 'warning'}
                  title={flag.label}
                  description={flag.reason || flag.id.replace(/_/g, ' ')}
                  delay={i * 0.05}
                />
              ))}
              {/* v1 hard_flags_triggered fallback */}
              {triggeredFlags.length === 0 && legacyFlagIds.map((id, i) => {
                const extractedFlag = hardFlags.find((f: any) => f.id === id)
                const isCritical = ['occupancy_critical','labour_ratio_critical','ebitda_negative_no_ramp','lease_expired'].includes(id)
                return (
                  <FlagItem
                    key={id}
                    severity={isCritical ? 'critical' : 'warning'}
                    title={id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    description={extractedFlag?.description || id.replace(/_/g, ' ')}
                    delay={i * 0.05}
                  />
                )
              })}
              {currentScored.score_capped && (
                <FlagItem
                  severity="warning"
                  title="Score Cap Applied"
                  description={currentScored.score_cap_reason || 'Score capped due to hard flag — resolve flagged items to unlock full score'}
                  delay={(triggeredFlags.length + legacyFlagIds.length) * 0.05}
                />
              )}
            </div>
          </>
        )}

        {/* DIMENSION SCORES */}
        <SectionTitle>Score Breakdown</SectionTitle>
        <div style={{ marginBottom: 40 }}>
          {dimEntries.map(([id, dim]) => (
            <DimensionRow
              key={id} id={id} dim={dim}
              isActive={activeDim === id}
              onClick={() => setActiveDim(activeDim === id ? null : id)}
            />
          ))}
        </div>

        {/* AUDIT TRAIL */}
        {currentScored.audit_trail && (
          <>
            <SectionTitle>Scoring Audit</SectionTitle>
            <div style={{
              background: '#152336', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: 16, marginBottom: 40,
              display: 'flex', flexDirection: 'column', gap: 10
            }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Confidence
                  </span>
                  <div style={{
                    fontSize: 13, fontWeight: 600, marginTop: 4,
                    color: currentScored.audit_trail.confidence === 'high' ? '#22c55e'
                      : currentScored.audit_trail.confidence === 'medium' ? '#00b4a0' : '#f59e0b'
                  }}>
                    {currentScored.audit_trail.confidence?.toUpperCase()}
                  </div>
                </div>
                {currentScored.audit_trail.fields_missing?.length > 0 && (
                  <div>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Missing Fields
                    </span>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                      {currentScored.audit_trail.fields_missing.join(', ')}
                    </div>
                  </div>
                )}
              </div>
              {currentScored.audit_trail.confidence_note && (
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                  {currentScored.audit_trail.confidence_note}
                </div>
              )}
            </div>
          </>
        )}

        {/* CONDITIONALS */}
        {conditionals.length > 0 && (
          <>
            <SectionTitle>Conditionals Required</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
              {conditionals.map((c, i) => {
                const isString = typeof c === 'string'
                const dim    = isString ? '' : c.dimension
                const desc   = isString ? (c as unknown as string) : c.description
                const impact = isString ? '' : c.score_impact
                return (
                  <div key={i} style={{
                    background: '#152336', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: 16,
                    display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14
                  }}>
                    <span style={{
                      fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
                      color: '#00b4a0', background: 'rgba(0,180,160,0.1)',
                      borderRadius: 4, padding: '3px 7px', height: 'fit-content', whiteSpace: 'nowrap'
                    }}>C{i + 1}</span>
                    <div>
                      {dim && (
                        <div style={{ fontSize: 10.5, fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                          {dim}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55, marginBottom: 6 }}>{desc}</div>
                      {impact && (
                        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                          Score impact: <span style={{ color: '#00b4a0' }}>{impact}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ANALYST SUMMARY / VERDICT */}
        <SectionTitle>Analyst Summary</SectionTitle>
        <div style={{
          background: '#152336',
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeft: `3px solid ${mainColor}`,
          borderRadius: 8, padding: '20px 22px',
          fontSize: 14, color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.75, marginBottom: 16
        }}>
          {currentScored.verdict?.one_liner || currentScored.analyst_summary || '—'}
        </div>
        {currentScored.verdict?.recommended_buyer_profile && (
          <div style={{
            background: 'rgba(0,180,160,0.06)', border: '1px solid rgba(0,180,160,0.15)',
            borderRadius: 8, padding: '14px 18px', marginBottom: 40,
            fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6
          }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: '#00b4a0', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 8 }}>
              Ideal Buyer
            </span>
            {currentScored.verdict.recommended_buyer_profile}
          </div>
        )}

      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '18px 40px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.25)'
      }}>
        <span>Acquira Deal Intelligence · {centre?.name}</span>
        <span>Extraction {extracted.meta?.extraction_version} · Scoring {currentScored.scoring_version} · {extracted.meta?.source_type}</span>
      </footer>
    </div>
  )
}
