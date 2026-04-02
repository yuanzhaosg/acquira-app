'use client'
import CompetitiveMap from '@/components/map/CompetitiveMap'
import ICSummary from '@/components/report/ICSummary'
import { useState, useEffect } from 'react'
import type {
  ScoredDeal, DimensionId, Conditional, DealBreakerFlag,
} from '@/types/scored'
import type { ExtractedDeal } from '@/types/extracted'

// ── HELPERS ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 72) return '#22c55e'
  if (score >= 62) return '#00b4a0'
  if (score >= 52) return '#f59e0b'
  if (score >= 42) return '#f97316'
  return '#ef4444'
}

function dimScoreColor(score: number): string {
  if (score >= 7) return '#22c55e'
  if (score >= 5.5) return '#00b4a0'
  if (score >= 4) return '#f59e0b'
  return '#ef4444'
}

function scoreVerdict(score: number): string {
  if (score >= 72) return 'Strong Buy'
  if (score >= 62) return 'Attractive'
  if (score >= 52) return 'Worth Investigating'
  if (score >= 42) return 'High Scrutiny Required'
  if (score >= 32) return 'High Risk'
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

function DimensionRow({ id, dim, isActive, onClick, pipelineIntelUsed, tx }: {
  id: string
  dim: any
  isActive: boolean
  onClick: () => void
  pipelineIntelUsed?: boolean
  tx: (key: string, original: string | null | undefined) => string
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
      className="dim-row-wrap"
      style={{
        borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
        background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
        transition: 'all 0.15s', marginBottom: 4,
      }}
    >
      <div className="dim-row-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 52px', gap: 14, alignItems: 'center' }}>
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
        <div className="dim-score-bar" style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
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

      {/* Always visible in print via .dim-detail-panel CSS class */}
      <div className="dim-detail-panel" style={{ display: isActive ? 'block' : 'none', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {dim.summary && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.6 }}>
              {tx(`dim_${id}_summary`, dim.summary)}
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

          {/* Pipeline intel note for market_position */}
          {id === 'market_position' && pipelineIntelUsed && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
              padding: '3px 10px', borderRadius: 4,
              background: 'rgba(0,180,160,0.08)', border: '1px solid rgba(0,180,160,0.2)',
              fontSize: 11, color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace',
            }}>
              ✓ Pipeline intel included in scoring
            </div>
          )}
      </div>
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

function EditableMetricCard({ label, value, note, color = '#e8edf3', editable, onSave, overridden, isSelect, selectOptions }: {
  label: string; value: string; note?: string; color?: string
  editable?: boolean; onSave?: (val: string) => void; overridden?: boolean
  isSelect?: boolean; selectOptions?: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  const handleSave = () => {
    if (input.trim() && onSave) onSave(input.trim())
    setEditing(false)
    setInput('')
  }

  const handleSelectSave = (val: string) => {
    if (onSave) onSave(val)
    setEditing(false)
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
        isSelect && selectOptions ? (
          // Dropdown for select fields (e.g. NQS Rating)
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {selectOptions.map(opt => (
              <button key={opt} onClick={() => handleSelectSave(opt)} style={{
                background: opt === value || opt === value + ' NQS' ? 'rgba(0,180,160,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${opt === value || opt === value + ' NQS' ? 'rgba(0,180,160,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 6, padding: '7px 12px', color: '#e8edf3',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}>{opt}</button>
            ))}
            <button onClick={() => setEditing(false)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
              fontSize: 11, cursor: 'pointer', padding: '2px 0', textAlign: 'left',
            }}>Cancel</button>
          </div>
        ) : (
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
        )
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

export default function ReportView({ extracted, scored, dealId, saving, onBack, onNew, sampleMode, initialOverrides, onMap }: {
  extracted: ExtractedDeal; scored: ScoredDeal; dealId?: string | null
  saving?: boolean; onBack?: () => void; onNew?: () => void; sampleMode?: boolean
  initialOverrides?: Record<string, number | string>
  onMap?: () => void
}) {
  const [activeDim, setActiveDim]       = useState<string | null>(null)
  const [overrides, setOverrides]       = useState<Record<string, number | string>>(initialOverrides ?? {})

  // Sync overrides when a deal is loaded (initialOverrides arrives after async getDeal)
  // Runs on dealId change AND when initialOverrides reference changes
  useEffect(() => {
    setOverrides(initialOverrides ?? {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, initialOverrides])
  const [currentScored, setCurrentScored] = useState<ScoredDeal>(scored)
  const [rescoring, setRescoring]       = useState(false)
  const [rescoreError, setRescoreError] = useState<string | null>(null)
  const [resaved, setResaved]           = useState(false)

  // Chinese translation
  const [translating, setTranslating]   = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [translations, setTranslations] = useState<Record<string, string> | null>(null)
  const isChinese = translations !== null

  const handleTranslate = async () => {
    if (isChinese) { setTranslations(null); return }  // toggle back to English
    setTranslating(true)
    setTranslateError(null)
    try {
      const res = await fetch('/api/translate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scored: currentScored }),
      })
      if (!res.ok) throw new Error('Translation failed')
      const { translations: t } = await res.json()
      setTranslations(t)
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  // Helper: get translated text or fall back to original
  const tx = (key: string, original: string | null | undefined): string => {
    if (!original) return ''
    return (isChinese && translations?.[key]) ? translations[key] : (original ?? '')
  }

  // Decision Checklist state
  type ChecklistAnswer = 'yes' | 'no' | 'unsure' | null
  const CHECKLIST_QUESTIONS = [
    { id: 'management_transition', label: 'Is there a credible management transition plan?' },
    { id: 'lease_confirmed',       label: 'Has the landlord confirmed lease assignment?' },
    { id: 'dd_financials',         label: 'Have financials been independently verified?' },
    { id: 'regulatory_clear',      label: 'Are there no open regulatory or compliance issues?' },
  ]
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, ChecklistAnswer>>(() => {
    if (typeof window === 'undefined' || !dealId) return {}
    try { return JSON.parse(localStorage.getItem(`checklist-${dealId}`) ?? '{}') } catch { return {} }
  })
  const setChecklistAnswer = (id: string, val: ChecklistAnswer) => {
    const next = { ...checklistAnswers, [id]: val }
    setChecklistAnswers(next)
    if (dealId && typeof window !== 'undefined') {
      localStorage.setItem(`checklist-${dealId}`, JSON.stringify(next))
    }
  }

  // Notes & Tags state
  const [notesOpen, setNotesOpen]   = useState(false)
  const [notes, setNotes]           = useState('')
  const [tagsInput, setTagsInput]   = useState('')
  const [tags, setTags]             = useState<string[]>([])
  const [notesSaving, setNotesSaving] = useState(false)

  const saveNotesAndTags = async (newNotes?: string, newTags?: string[]) => {
    if (!dealId) return
    setNotesSaving(true)
    try {
      const { data: { session } } = await (await import('@/lib/useAuth')).supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      await fetch(`/api/deals/${dealId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          notes: newNotes ?? notes,
          tags: (newTags ?? tags).join(','),
        }),
      })
    } catch {}
    setNotesSaving(false)
  }

  const addTag = (tag: string) => {
    const t = tag.trim()
    if (!t || tags.includes(t)) return
    const next = [...tags, t]
    setTags(next)
    setTagsInput('')
    saveNotesAndTags(notes, next)
  }

  const removeTag = (tag: string) => {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    saveNotesAndTags(notes, next)
  }

  // P4 — Data intelligence
  type NearbyCentre = { name: string; address: string; nqs_rating: string; licensed_places: number; distance_km: number; provider: string }
  type DemographicData = { postcode: string; population_0_4: { trend: string; pct_change_5yr: number; risk_flag: boolean; risk_note: string }; median_household_income: number; source: string }
  const [nearbyCentres, setNearbyCentres]     = useState<NearbyCentre[] | null>(null)
  const [nearbyLoading, setNearbyLoading]     = useState(false)
  const [demographics, setDemographics]       = useState<DemographicData | null>(null)
  const [demoLoading, setDemoLoading]         = useState(false)

  // P6 — DA Pipeline
  type DAApplication = {
    address: string | null
    description: string
    status: 'approved' | 'lodged' | 'refused' | 'unknown'
    date: string | null
    places: number | null
    distance_km: number | null
    info_url: string | null
  }
  type DAPipelineData = {
    source: string
    note?: string
    postcode: string
    suburb?: string
    state: string
    applications: DAApplication[]
    summary: {
      total: number
      approved: number
      lodged: number
      refused: number
      total_approved_places: number
      total_pipeline_places: number
      risk_flag: boolean
      risk_note: string
    }
  }
  const [daPipeline, setDaPipeline]   = useState<DAPipelineData | null>(null)
  const [daLoading, setDaLoading]     = useState(false)

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'https://acquira-api-production.up.railway.app'

  async function loadNearbyCentres() {
    setNearbyLoading(true)
    try {
      const c = (extracted as any).centre
      const lat = c?.lat ?? null
      const lng = c?.lng ?? null
      const postcode = c?.postcode ?? null
      const qs = new URLSearchParams()
      if (lat) qs.set('lat', lat)
      if (lng) qs.set('lng', lng)
      if (postcode) qs.set('postcode', postcode)
      qs.set('radius_km', '2')
      const res = await fetch(`${apiBase}/acecqa/nearby?${qs}`)
      const json = await res.json()
      setNearbyCentres(json.centres ?? [])
    } catch { setNearbyCentres([]) }
    setNearbyLoading(false)
  }

  async function loadDemographics() {
    setDemoLoading(true)
    try {
      const c = (extracted as any).centre
      const postcode = c?.postcode ?? '3000'
      const res = await fetch(`${apiBase}/demographics/${postcode}`)
      const json = await res.json()
      setDemographics(json)
    } catch { setDemographics(null) }
    setDemoLoading(false)
  }

  async function loadDAPipeline() {
    setDaLoading(true)
    try {
      const c = (extracted as any).centre
      const postcode = c?.postcode ?? '3000'
      const suburb   = c?.suburb ?? ''
      const state    = c?.state ?? 'VIC'
      const qs = new URLSearchParams()
      qs.set('postcode', postcode)
      if (suburb) qs.set('suburb', suburb)
      if (state)  qs.set('state', state)
      qs.set('radius_km', '2')
      const res = await fetch(`${apiBase}/planning/nearby?${qs}`)
      const json = await res.json()
      setDaPipeline(json)
    } catch { setDaPipeline(null) }
    setDaLoading(false)
  }

  useEffect(() => { setCurrentScored(scored) }, [scored])

  const saveOverridesToDB = async (newOverrides: Record<string, number | string>) => {
    if (!dealId) return
    try {
      await fetch('/api/update-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId, scored: currentScored, overrides: newOverrides })
      })
    } catch (e) {
      console.error('saveOverridesToDB error:', e)
    }
  }

  const handleOverride = (field: string, rawVal: string) => {
    // NQS rating is a string — store as-is
    let newVal: string | number
    if (field === 'nqs_rating_str') {
      newVal = rawVal
    } else {
      const num = parseFloat(rawVal.replace(/[$,%\s,]/g, ''))
      if (isNaN(num)) return
      newVal = num
    }
    const newOverrides = { ...overrides, [field]: newVal }
    setOverrides(newOverrides)
    // Save immediately — don’t wait for rescore
    saveOverridesToDB(newOverrides)
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
      if (overrides.revenue != null) {
        if (overriddenExtracted.financials.fy25) overriddenExtracted.financials.fy25.revenue = overrides.revenue
        overriddenExtracted.key_ratios.revenue_fy25 = overrides.revenue
        // Recalculate ratios if we have the raw costs
        const fy25data = overriddenExtracted.financials?.fy25
        const newRev = overrides.revenue as number
        if (fy25data?.total_labour_cost != null)
          fy25data.labour_ratio_pct = parseFloat(((fy25data.total_labour_cost / newRev) * 100).toFixed(1))
        if (fy25data?.rent_pa != null)
          fy25data.rent_ratio_pct = parseFloat(((fy25data.rent_pa / newRev) * 100).toFixed(1))
      }
      if (overrides.licensed_places != null) {
        overriddenExtracted.centre.licensed_places = overrides.licensed_places
        overriddenExtracted.key_ratios.licensed_places = overrides.licensed_places
      }
      if (overrides.nqs_rating_str != null) {
        overriddenExtracted.centre.nqs_rating = overrides.nqs_rating_str as string
      }
      if (overrides.labour_cost != null) {
        const lc = overrides.labour_cost as number
        if (overriddenExtracted.financials.fy25) {
          overriddenExtracted.financials.fy25.total_labour_cost = lc
          const rev = overriddenExtracted.financials.fy25.revenue ?? 0
          if (rev > 0) overriddenExtracted.financials.fy25.labour_ratio_pct = parseFloat(((lc / rev) * 100).toFixed(1))
        }
        overriddenExtracted.key_ratios.labour_ratio_fy25_pct = overriddenExtracted.financials?.fy25?.labour_ratio_pct
      }
      if (overrides.rent_pa != null) {
        const rp = overrides.rent_pa as number
        if (overriddenExtracted.financials.fy25) {
          overriddenExtracted.financials.fy25.rent_pa = rp
          const rev = overriddenExtracted.financials.fy25.revenue ?? 0
          if (rev > 0) overriddenExtracted.financials.fy25.rent_ratio_pct = parseFloat(((rp / rev) * 100).toFixed(1))
        }
        overriddenExtracted.key_ratios.rent_ratio_fy25_pct = overriddenExtracted.financials?.fy25?.rent_ratio_pct
        overriddenExtracted.key_ratios.rent_pa_fy25 = rp
      }
      const res = await fetch('/api/rescore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted: overriddenExtracted, overrides })
      })
      if (!res.ok) throw new Error(await res.text())
      const newScored: ScoredDeal = await res.json()
      newScored.scoring_timestamp = new Date().toISOString()
      // Preserve demand intelligence fields — rescore API returns raw LLM output
      // which strips these server-computed fields. Re-attach from previous state.
      const prev = currentScored as any
      if (prev.demand_context)        (newScored as any).demand_context        = prev.demand_context
      if (prev.market_context)        (newScored as any).market_context        = prev.market_context
      if (prev.effective_demand_ratio != null) (newScored as any).effective_demand_ratio = prev.effective_demand_ratio
      if (prev.demand_zone)           (newScored as any).demand_zone           = prev.demand_zone
      if (prev.pipeline_intel)        (newScored as any).pipeline_intel        = prev.pipeline_intel
      if (prev.pipeline_intel_used)   (newScored as any).pipeline_intel_used   = prev.pipeline_intel_used
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

  // Helper: safely extract a numeric override (returns undefined if not set or not a number)
  const numOvr = (k: string): number | undefined => {
    const v = overrides[k]; return typeof v === 'number' ? v : undefined
  }
  const effectiveOccupancy      = numOvr('occupancy')       ?? occupancy?.avg_4wk_pct ?? occupancy?.current_month_pct
  const effectiveEbitda          = numOvr('ebitda')           ?? fy25?.ebitda ?? ratios?.ebitda_fy25
  const effectiveAskPrice        = numOvr('asking_price')     ?? financials?.asking_price ?? ratios?.asking_price
  const effectiveRevenue         = numOvr('revenue')          ?? fy25?.revenue ?? ratios?.revenue_fy25
  const effectiveLicensedPlaces  = numOvr('licensed_places')  ?? centre?.licensed_places
  const effectiveNqsRating       = (overrides.nqs_rating_str as string | undefined) ?? centre?.nqs_rating
  const effectiveLabourCost      = numOvr('labour_cost')      ?? fy25?.total_labour_cost
  const effectiveRentPa          = numOvr('rent_pa')          ?? fy25?.rent_pa ?? ratios?.rent_pa_fy25
  // Derived ratios — recalculate if labour cost or rent overridden
  const baseRevForRatios = effectiveRevenue ?? 0
  const labourCostNum = numOvr('labour_cost')
  const rentPaNum     = numOvr('rent_pa')
  const effectiveLabourRatioPct = labourCostNum != null && baseRevForRatios > 0
    ? parseFloat(((labourCostNum / baseRevForRatios) * 100).toFixed(1))
    : (fy25?.labour_ratio_pct ?? ratios?.labour_ratio_fy25_pct)
  const effectiveRentRatioPct = rentPaNum != null && baseRevForRatios > 0
    ? parseFloat(((rentPaNum / baseRevForRatios) * 100).toFixed(1))
    : (fy25?.rent_ratio_pct ?? ratios?.rent_ratio_fy25_pct)

  const metrics = [
    {
      label: 'Revenue (FY25)',
      value: fmtM(effectiveRevenue),
      note: financials?.revenue_trend ? `Trend: ${financials.revenue_trend}` : undefined,
      color: '#00b4a0', editable: true, field: 'revenue',
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
      label: 'Labour Cost (FY25)',
      value: effectiveLabourCost != null ? fmtM(effectiveLabourCost) : '—',
      note: effectiveLabourRatioPct != null ? `${effectiveLabourRatioPct}% of revenue · target 55–65%` : 'Enter to calculate ratio',
      color: (effectiveLabourRatioPct ?? 0) <= 65 ? '#00b4a0' : (effectiveLabourRatioPct ?? 0) <= 75 ? '#f59e0b' : '#ef4444',
      editable: true, field: 'labour_cost',
    },
    {
      label: 'Rent pa (FY25)',
      value: effectiveRentPa != null ? fmtM(effectiveRentPa) : '—',
      note: effectiveRentRatioPct != null ? `${effectiveRentRatioPct}% of revenue · target <20%` : 'Enter to calculate ratio',
      color: (effectiveRentRatioPct ?? 0) <= 20 ? '#00b4a0' : (effectiveRentRatioPct ?? 0) <= 25 ? '#f59e0b' : '#ef4444',
      editable: true, field: 'rent_pa',
    },
    {
      label: 'Licensed Places',
      value: fmt(effectiveLicensedPlaces),
      note: centre?.state ? `${centre.state} service` : undefined,
      color: '#e8edf3', editable: true, field: 'licensed_places',
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
      value: (effectiveNqsRating ?? '—')?.replace(' NQS', ''),
      note: centre?.nqs_date ?? undefined,
      color: effectiveNqsRating === 'Exceeding NQS' ? '#22c55e'
        : effectiveNqsRating === 'Meeting NQS' ? '#00b4a0'
        : effectiveNqsRating ? '#f59e0b' : 'rgba(255,255,255,0.3)',
      editable: true, field: 'nqs_rating_str', isSelect: true,
      selectOptions: ['Exceeding NQS', 'Meeting NQS', 'Working Towards NQS', 'Significant Improvement Required'],
    },
  ]

  const dimEntries = Object.entries(currentScored.dimensions)

  return (
    <div style={{
      background: '#0d1b2a', color: '#e8edf3',
      fontFamily: 'IBM Plex Sans, sans-serif',
      minHeight: '100vh', fontSize: 14, lineHeight: 1.6
    }}>
      {isChinese && (
        <div style={{
          background: 'rgba(220,38,38,0.08)', borderBottom: '1px solid rgba(220,38,38,0.2)',
          padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          fontFamily: 'DM Sans, sans-serif', fontSize: 12,
        }}>
          <span style={{ color: '#f87171', fontWeight: 600 }}>🇨🇳 简体中文版</span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>数字、指标名称及地名保留英文原文 &middot; Numbers and proper nouns retained in English</span>
          <button onClick={() => setTranslations(null)} style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4,
            padding: '2px 10px', color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer',
          }}>切换回英文 English</button>
        </div>
      )}

      {sampleMode && (
        <div style={{
          background: 'rgba(0,180,160,0.1)', borderBottom: '1px solid rgba(0,180,160,0.25)',
          padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
          fontFamily: 'DM Sans, sans-serif', fontSize: 13,
        }}>
          <span style={{ color: '#00b4a0', fontWeight: 600 }}>📋 Sample Report</span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>This is a demo deal. Sign up to analyse your own acquisitions.</span>
          <button onClick={onNew} style={{
            background: '#00b4a0', border: 'none', borderRadius: 6,
            padding: '5px 14px', color: '#0d1b2a', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Upload an IM →</button>
        </div>
      )}
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
          .report-metrics    { grid-template-columns: repeat(2, 1fr) !important; }
          .report-hero h1    { font-size: 28px !important; }
          .dim-grid          { grid-template-columns: 1fr !important; }
          .checklist-btn     { min-height: 44px !important; padding: 8px 14px !important; font-size: 13px !important; }
        }
        @media print {
          /* ── PAGE SETUP ── */
          @page { margin: 16mm 18mm; size: A4; }
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;

          .print-only-header { display: flex !important; }

          html, body {
            background: #fff !important;
            color: #1a2b3c !important;
            font-family: 'IBM Plex Sans', 'Inter', 'Segoe UI', Arial, sans-serif !important;
            font-size: 10pt !important;
            line-height: 1.5 !important;
          }

          /* ── NUCLEAR BACKGROUND RESET ──
             React renders inline styles without spaces (background:#152336)
             so attribute selectors can't reliably match.
             Instead: reset ALL backgrounds to white, then re-apply light cards via class. */
          * {
            background-color: transparent !important;
            border-color: #e2e8f0 !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          html, body, #__next, main { background-color: #fff !important; }

          /* ── COLOUR PRESERVATION ──
             Re-apply score/brand colours via explicit classes added to elements */
          .print-score-green  { color: #16a34a !important; }
          .print-score-teal   { color: #007a6e !important; }
          .print-score-amber  { color: #b45309 !important; }
          .print-score-red    { color: #dc2626 !important; }
          .print-card         { background-color: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 6px; padding: 10px 12px; }
          .print-card-white   { background-color: #fff !important; border: 1px solid #e2e8f0 !important; }
          .print-flag-red     { background-color: #fef2f2 !important; border-color: #fca5a5 !important; }
          .print-flag-amber   { background-color: #fffbeb !important; border-color: #fcd34d !important; }
          .print-flag-green   { background-color: #f0fdf4 !important; border-color: #86efac !important; }

          /* Typography */
          h1, h2, h3 { color: #0d1b2a !important; font-family: 'Space Grotesk','Segoe UI',Arial,sans-serif !important; }
          p, span, div, td, th, li { color: #1a2b3c !important; }
          a { color: #007a6e !important; text-decoration: none; }

          /* ── HIDE INTERACTIVE ── */
          .report-header, nav, .no-print, .score-ring-wrap, .dim-score-bar { display: none !important; }

          /* ── LAYOUT ── */
          .report-hero   { padding: 16px 0 12px !important; display: block !important; border-bottom: 2px solid #00b4a0 !important; }
          .report-content { padding: 0 !important; max-width: 100% !important; }
          .report-metrics { grid-template-columns: repeat(4,1fr) !important; gap: 8px !important; }

          /* ── DIMENSION ROWS ── */
          .dim-row-wrap  { background-color: #fff !important; border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important; padding: 10px 12px !important; margin-bottom: 6px !important; break-inside: avoid; }
          .dim-detail-panel { display: block !important; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0 !important; }

          /* ── IC SUMMARY ── */
          .ic-scenario-col  { background-color: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 6px !important; break-inside: avoid; }
          .ic-pipeline-strip > div { background-color: #f8fafc !important; border: 1px solid #e2e8f0 !important; }

          /* ── SCORE INTERPRETATION ── */
          .score-interpretation { page-break-before: always; background-color: #f8fafc !important;
            border: 1px solid #e2e8f0 !important; border-radius: 8px !important; padding: 20px 24px !important; margin: 0 !important; }
          .score-interpretation-grid  { grid-template-columns: repeat(3,1fr) !important; }
          .score-interpretation-bottom { grid-template-columns: 1fr 1fr !important; }

          /* ── PAGE BREAKS ── */
          .dim-row-wrap, .ic-scenario-col { break-inside: avoid; }

          /* ── FOOTER ── */
          footer { border-top: 1px solid #e2e8f0 !important; color: #94a3b8 !important; font-size: 8pt !important; padding: 8px 0 !important; }
        }
      `}</style>

      {/* ── PRINT-ONLY HEADER ── */}
      <div style={{
        display: 'none',  // hidden on screen, shown in print via CSS
        padding: '12px 0 10px',
        borderBottom: '2px solid #00b4a0',
        marginBottom: 4,
        justifyContent: 'space-between',
        alignItems: 'center',
      }} className="print-only-header">
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 800, color: '#0d1b2a' }}>
          Acquira<span style={{ color: '#00b4a0' }}>.</span>
          <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b', marginLeft: 10, fontFamily: 'IBM Plex Mono, monospace' }}>ACQUISITION INTELLIGENCE</span>
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>
          Generated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── STICKY HEADER ── */}
      <header className="report-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
        background: 'rgba(13,27,42,0.96)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 32px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, color: '#00b4a0', fontWeight: 700
          }}>Acquira</button>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 18 }}>/</span>
          {[{
            label: '← Pipeline', action: onBack,
          }, {
            label: '⬆ New Report', action: onNew,
          }, {
            label: '🗺️ Supply Map', action: onMap,
          }, {
            label: '💳 Pricing', action: () => window.open('/pricing', '_blank'),
          }].map(({ label, action }) => action ? (
            <button key={label} onClick={action} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
              fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif',
              borderRadius: 5, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fff'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >{label}</button>
          ) : null)}
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
          <button
            onClick={handleTranslate}
            disabled={translating}
            title={isChinese ? 'Switch back to English' : 'Translate report to Simplified Chinese'}
            style={{
              background: isChinese ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${isChinese ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 6, padding: '6px 14px',
              color: isChinese ? '#f87171' : 'rgba(255,255,255,0.7)',
              fontSize: 12, cursor: translating ? 'wait' : 'pointer',
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
              opacity: translating ? 0.7 : 1,
            }}
          >
            {translating ? '翻译中…' : isChinese ? '🇺🇸 English' : '🇨🇳 中文'}
          </button>
          {translateError && (
            <span style={{ fontSize: 11, color: '#ef4444' }}>{translateError}</span>
          )}
          <button
            onClick={() => window.print()}
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, padding: '6px 14px', color: 'rgba(255,255,255,0.7)',
              fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            }}
          >
            ⬇ PDF
          </button>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div style={{ height: 56 }} aria-hidden />

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
                {tx('verdict_one_liner', currentScored.verdict.one_liner)}
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

        {/* IC VALUATION SUMMARY */}
        {(() => {
          const dc = (currentScored as any).demand_context
          if (!dc || !centre?.licensed_places) return null
          const mc = (currentScored as any).market_context
          const approvedPlaces = mc?.approved_pipeline_places ?? 0
          const piIntel = (currentScored as any).pipeline_intel
          const lodgedPlaces = piIntel?.lodgedDAs ? piIntel.lodgedDAs * 75 : 0
          // Use actual IM daily fee if available, else fall back to fee_benchmarking detail
          const actualFee =
            (currentScored as any).dimensions?.fee_benchmarking?.detail?.centre_daily_fee
            ?? undefined
          // Pass actual IM EBITDA so IC engine can anchor base scenario
          const actualEbitda = effectiveEbitda ?? undefined
          const actualRevenue = effectiveRevenue ?? undefined
          const actualOccupancy = (ratios?.occupancy_latest_4wk_pct ?? occupancy?.avg_4wk_pct)
            ? ((ratios?.occupancy_latest_4wk_pct ?? occupancy?.avg_4wk_pct)! / 100)
            : undefined
          return (
            <ICSummary
              kids0to4={dc.estimated_kids_0_to_4 ?? 0}
              totalLicensedPlaces={dc.total_licensed_places ?? 0}
              isRegional={dc.is_regional ?? false}
              pipelineApprovedPlaces={approvedPlaces}
              pipelineLodgedPlaces={lodgedPlaces}
              centreLicensedPlaces={centre.licensed_places}
              centreCurrentOccupancy={actualOccupancy}
              centreAvgDailyFee={actualFee}
              centreAskingPrice={effectiveAskPrice ?? undefined}
              actualEbitda={actualEbitda}
              actualRevenue={actualRevenue}
              acquiraScore={canonicalScore}
              demandGrowthFactor={dc.growth_factor ?? undefined}
            />
          )
        })()}

        {/* KEY METRICS */}
        <SectionTitle>Key Metrics</SectionTitle>
        <div className="report-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: hasOverrides ? 16 : 40 }}>
          {metrics.map(m => (
            <EditableMetricCard
              key={m.label} label={m.label} value={m.value} note={m.note} color={m.color}
              editable={m.editable}
              overridden={m.field ? overrides[m.field as string] != null : false}
              onSave={m.field ? (val) => handleOverride(m.field!, val) : undefined}
              isSelect={(m as any).isSelect}
              selectOptions={(m as any).selectOptions}
            />
          ))}
        </div>

        {/* RESCORE BAR */}
        {hasOverrides && (
          <div className="no-print" style={{
            background: 'rgba(0,180,160,0.08)', border: '1px solid rgba(0,180,160,0.2)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap'
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {Object.keys(overrides).map(k => (
                <span key={k} style={{ marginRight: 16 }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
                    {k.replace(/_str$/, '').replace(/_/g, ' ').toUpperCase()}
                  </span>
                  {' '}<span style={{ color: '#00b4a0', fontWeight: 600 }}>
                    {k === 'nqs_rating_str'
                      ? String(overrides[k]).replace(' NQS', '')
                      : ['asking_price','ebitda','revenue','labour_cost','rent_pa'].includes(k)
                      ? fmtM(overrides[k] as number)
                      : k === 'licensed_places'
                      ? String(overrides[k])
                      : `${overrides[k]}%`}
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

        {/* DEMAND INTELLIGENCE PANEL */}
        {(() => {
          // Support both direct fields and nested demand_context
          const sc = currentScored as any
          const dc = sc.demand_context ?? null
          const edr = sc.effective_demand_ratio ?? dc?.adj_kids_per_place?.mid ?? null
          if (edr == null) return null
          const zone = sc.demand_zone ?? dc?.zone ?? 'balanced'
          const mc   = sc.market_context as any
          const zoneColor = zone === 'undersupplied' ? '#22c55e' : zone === 'balanced' ? '#f59e0b' : '#ef4444'
          const zoneLabel = zone === 'undersupplied' ? 'Undersupplied' : zone === 'balanced' ? 'Balanced' : 'Oversupplied'
          const confColor = dc?.confidence === 'high' ? '#22c55e' : dc?.confidence === 'medium' ? '#f59e0b' : '#ef4444'
          return (
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>Demand Intelligence</SectionTitle>
              <div style={{ background: '#152336', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Effective Demand Ratio</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 36, fontWeight: 800, color: zoneColor, lineHeight: 1 }}>{edr.toFixed(2)}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>LDC kids per place</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: `${zoneColor}18`, color: zoneColor, border: `1px solid ${zoneColor}40` }}>{zoneLabel.toUpperCase()}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${confColor}12`, color: confColor, border: `1px solid ${confColor}30` }}>Confidence: {dc?.confidence?.toUpperCase() ?? 'UNKNOWN'}</span>
                  </div>
                  {dc?.demand_trend && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: dc.demand_trend === 'growing' ? 'rgba(34,197,94,0.1)' : dc.demand_trend === 'declining' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                      color: dc.demand_trend === 'growing' ? '#22c55e' : dc.demand_trend === 'declining' ? '#ef4444' : '#f59e0b',
                    }}>
                      {dc.demand_trend === 'growing' ? '📈 Growing cohort' : dc.demand_trend === 'declining' ? '📉 Declining cohort' : '➡️ Flat cohort'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                  {[
                    { label: 'Kids 0–4 (catchment)', value: dc?.estimated_kids_0_to_4?.toLocaleString() ?? '—', sub: `ABS 2021 · ${dc?.radius_km ?? 3}km radius` },
                    { label: 'LDC kids (mid est.)', value: dc?.ldc_kids_range?.mid?.toLocaleString() ?? '—', sub: `${Math.round((dc?.ldc_util_rate?.mid ?? 0.475) * 100)}% utilisation · DoE 2024` },
                    { label: 'Licensed places', value: dc?.total_licensed_places?.toLocaleString() ?? '—', sub: 'ACECQA · catchment total' },
                    { label: 'Market score', value: mc ? `${mc.score}/10` : '—', sub: mc ? `${mc.competitor_count} competitors · ${mc.risk_bucket}` : 'from scoring model', color: mc ? dimScoreColor(mc.score) : undefined },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{s.label}</div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, color: (s as any).color ?? '#e8edf3', lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>&gt;1.0 Undersupplied</span>
                  <span>·</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>0.5–1.0 Balanced</span>
                  <span>·</span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>&lt;0.5 Oversupplied</span>
                  <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>LDC-adjusted · ABS 2021 + DoE 2024 · deterministic, not LLM-estimated</span>
                </div>
                {mc && mc.pipeline_ratio_subject > 0 && (
                  <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6,
                    background: mc.pipeline_ratio_subject > 0.5 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                    border: `1px solid ${mc.pipeline_ratio_subject > 0.5 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    fontSize: 12, color: 'rgba(255,255,255,0.5)',
                  }}>
                    <span style={{ fontWeight: 700, color: mc.pipeline_ratio_subject > 0.5 ? '#ef4444' : '#f59e0b' }}>
                      {mc.pipeline_ratio_subject > 0.5 ? '⚠ HIGH' : '⚡ MEDIUM'} pipeline pressure
                    </span>
                    {' '}— approved DA places = {(mc.pipeline_ratio_subject * 100).toFixed(0)}% of this centre’s capacity
                  </div>
                )}
              </div>
            </div>
          )
        })()}

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
              pipelineIntel={(currentScored as any).pipeline_intel ?? null}
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
                  description={tx(`flag_${triggeredFlags.indexOf(flag)}_reason`, flag.reason) || flag.id.replace(/_/g, ' ')}
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

        {/* DIMENSION SCORES — grouped into 4 categories */}
        <SectionTitle>Score Breakdown</SectionTitle>
        <div style={{ marginBottom: 40 }}>
          {([
            {
              group: 'Operational Stability',
              color: '#00b4a0',
              ids: ['occupancy_demand', 'staffing_resilience', 'regulatory_quality', 'management_systems', 'operator_quality', 'enrolment_trend', 'staff_qualification_mix'],
            },
            {
              group: 'Financial Performance',
              color: '#22c55e',
              ids: ['profitability_cashflow', 'revenue_pricing', 'fee_benchmarking', 'upside_levers'],
            },
            {
              group: 'Lease & Property',
              color: '#f59e0b',
              ids: ['lease_economics', 'lease_tail', 'capex_liability'],
            },
            {
              group: 'Strategic Risk',
              color: '#ef4444',
              ids: ['valuation_structure', 'market_position', 'ccs_risk'],
            },
          ] as const).map(({ group, color, ids }) => {
            const groupDims = ids
              .map(id => [id, currentScored.dimensions?.[id as DimensionId]] as [string, any])
              .filter(([, dim]) => dim != null)
            if (groupDims.length === 0) return null

            // Group average — simple mean of dimension scores (0–10)
            // Note: dim.weight is only present after a rescore; use mean to avoid 0/10 on fresh pipeline results
            const groupAvg = groupDims.length > 0
              ? groupDims.reduce((sum, [, dim]) => sum + (typeof dim.score === 'number' ? dim.score : 0), 0) / groupDims.length
              : 0

            return (
              <div key={group} style={{ marginBottom: 28 }}>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8, paddingBottom: 8,
                  borderBottom: `1px solid ${color}22`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <span style={{
                      fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      color: 'rgba(255,255,255,0.4)',
                    }}>{group}</span>
                  </div>
                  <span style={{
                    fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 700,
                    color: scoreColor(groupAvg * 10),
                  }}>
                    {(groupAvg * 10).toFixed(0)}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginLeft: 2 }}>/100</span>
                  </span>
                </div>

                {/* Dimensions in this group */}
                {groupDims.map(([id, dim]) => (
                  <DimensionRow
                    key={id} id={id} dim={dim}
                    isActive={activeDim === id}
                    onClick={() => setActiveDim(activeDim === id ? null : id)}
                    pipelineIntelUsed={id === 'market_position' && !!(currentScored as any).pipeline_intel_used}
                    tx={tx}
                  />
                ))}
              </div>
            )
          })}

          {/* Catch-all: any dimensions not in a group (future-proofing) */}
          {(() => {
            const allGrouped = ['occupancy_demand','staffing_resilience','regulatory_quality','management_systems','operator_quality','enrolment_trend','staff_qualification_mix','profitability_cashflow','revenue_pricing','fee_benchmarking','upside_levers','lease_economics','lease_tail','capex_liability','valuation_structure','market_position','ccs_risk']
            const ungrouped = dimEntries.filter(([id]) => !allGrouped.includes(id))
            if (ungrouped.length === 0) return null
            return (
              <div style={{ marginBottom: 28 }}>
                <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)' }}>Other</span>
                </div>
                {ungrouped.map(([id, dim]) => (
                  <DimensionRow key={id} id={id} dim={dim} isActive={activeDim === id} onClick={() => setActiveDim(activeDim === id ? null : id)} pipelineIntelUsed={false} tx={tx} />
                ))}
              </div>
            )
          })()}
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
                  {tx('audit_confidence_note', currentScored.audit_trail.confidence_note)}
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
          {tx('verdict_one_liner', currentScored.verdict?.one_liner) || tx('analyst_summary', currentScored.analyst_summary) || '—'}
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
            {tx('verdict_buyer_profile', currentScored.verdict.recommended_buyer_profile)}
          </div>
        )}

        {/* ── DECISION CHECKLIST ── */}
        <div className="no-print" style={{ marginBottom: 32 }}>
          <button
            onClick={() => setChecklistOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '12px 16px', cursor: 'pointer', color: '#e8edf3',
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600,
            }}
          >
            <span style={{ color: '#00b4a0' }}>{checklistOpen ? '▾' : '▸'}</span>
            Decision Checklist
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>
              {Object.values(checklistAnswers).filter(Boolean).length}/{CHECKLIST_QUESTIONS.length} answered
            </span>
          </button>
          {checklistOpen && (
            <div style={{ background: '#112236', border: '1px solid #1e3a5f', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 20 }}>
              {/* Flag badges */}
              {Object.entries(checklistAnswers).filter(([, v]) => v === 'no').length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {CHECKLIST_QUESTIONS.filter(q => checklistAnswers[q.id] === 'no').map(q => (
                    <span key={q.id} style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      ⚠ {q.id.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {CHECKLIST_QUESTIONS.map(q => {
                  const ans = checklistAnswers[q.id] ?? null
                  return (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1 }}>{q.label}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['yes', 'no', 'unsure'] as const).map(opt => (
                          <button
                            key={opt}
                            className="checklist-btn"
                            onClick={() => setChecklistAnswer(q.id, ans === opt ? null : opt)}
                            style={{
                              padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              cursor: 'pointer', border: '1px solid',
                              fontFamily: "'DM Sans', sans-serif",
                              background: ans === opt
                                ? opt === 'yes' ? 'rgba(34,197,94,0.2)' : opt === 'no' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'
                                : 'transparent',
                              borderColor: ans === opt
                                ? opt === 'yes' ? '#22c55e' : opt === 'no' ? '#ef4444' : '#f59e0b'
                                : 'rgba(255,255,255,0.15)',
                              color: ans === opt
                                ? opt === 'yes' ? '#22c55e' : opt === 'no' ? '#ef4444' : '#f59e0b'
                                : 'rgba(255,255,255,0.4)',
                            }}
                          >
                            {opt === 'yes' ? '✓ Yes' : opt === 'no' ? '✗ No' : '? Unsure'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── NOTES & TAGS ── */}
        <div className="no-print" style={{ marginBottom: 40 }}>
          <button
            onClick={() => setNotesOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '12px 16px', cursor: 'pointer', color: '#e8edf3',
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600,
            }}
          >
            <span style={{ color: '#00b4a0' }}>{notesOpen ? '▾' : '▸'}</span>
            Notes & Tags
            {notesSaving && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>saving…</span>}
          </button>
          {notesOpen && (
            <div style={{ background: '#112236', border: '1px solid #1e3a5f', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 20 }}>
              <textarea
                placeholder="Add notes about this deal…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={() => saveNotesAndTags(notes, tags)}
                style={{
                  width: '100%', minHeight: 100, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: '#e8edf3', fontSize: 13, padding: 12, resize: 'vertical',
                  fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tags</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {tags.map(tag => (
                    <span key={tag} style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      background: 'rgba(0,180,160,0.1)', color: '#00b4a0',
                      border: '1px solid rgba(0,180,160,0.2)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        style={{ background: 'none', border: 'none', color: '#00b4a0', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                      >×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    placeholder="Add tag…"
                    value={tagsInput}
                    onChange={e => setTagsInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagsInput) } }}
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, color: '#e8edf3', fontSize: 13, padding: '6px 10px',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  <button
                    onClick={() => addTag(tagsInput)}
                    style={{
                      background: 'rgba(0,180,160,0.1)', border: '1px solid rgba(0,180,160,0.25)',
                      borderRadius: 6, padding: '6px 14px', color: '#00b4a0',
                      fontSize: 12, cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>{/* end report-content */}

      {/* ── SCORE INTERPRETATION ── */}
      <div className="score-interpretation" style={{
        margin: '0 40px 40px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, padding: '24px 28px',
      }}>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.3)', marginBottom: 16,
        }}>How to Read This Score</div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>
          Acquira scores are calibrated against the realities of the Australian childcare acquisition market.
          Due to structural factors — typical EBITDA multiples of 3–6×, competitive inner-metro supply,
          and owner-operator management risk — <strong style={{ color: 'rgba(255,255,255,0.7)' }}>a score above 72 represents an exceptional deal</strong>.
          Most quality acquisitions score between 58–72.
        </p>
        <div className="score-interpretation-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { range: '72–100', label: 'Strong Buy', desc: 'Exceptional deal. Strong fundamentals across occupancy, margin, lease, and market. Rare.', color: '#22c55e' },
            { range: '62–71', label: 'Attractive', desc: 'Quality acquisition with clear upside. Minor risks are manageable or priceable.', color: '#00b4a0' },
            { range: '52–61', label: 'Worth Investigating', desc: 'Viable deal with identifiable risks. Requires deeper due diligence before proceeding.', color: '#f59e0b' },
            { range: '42–51', label: 'High Scrutiny', desc: 'Meaningful flags present. Proceed only with strong mitigation plan or price adjustment.', color: '#f97316' },
            { range: '32–41', label: 'High Risk', desc: 'Significant structural issues. Only suitable for experienced operators at the right price.', color: '#ef4444' },
            { range: '0–31',  label: 'Avoid', desc: 'Critical flags or fundamentals too weak. Not recommended at current terms.', color: '#dc2626' },
          ].map(b => (
            <div key={b.range} style={{
              background: 'rgba(255,255,255,0.02)', borderRadius: 8,
              padding: '12px 14px', borderLeft: `3px solid ${b.color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 700, color: b.color }}>{b.range}</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: b.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{b.label}</span>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>{b.desc}</p>
            </div>
          ))}
        </div>
        <div className="score-interpretation-bottom" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          <div>
            <strong style={{ color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>Why scores don’t reach 100</strong>
            Valuation scores are structurally capped by market pricing (3–6× EBITDA is normal, not a red flag).
            Demand scores in inner-metro areas reflect real LDC utilisation data — not GapMaps theoretical ratios.
            Owner-operator dependency, a near-universal feature of small childcare IMs, reduces management scores.
          </div>
          <div>
            <strong style={{ color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>Demand data methodology</strong>
            The Effective Demand Ratio (EDR) is computed from ABS 2021 Census (0–4 population),
            adjusted for LDC utilisation rates from the Dept of Education (2024 quarter data),
            and divided by ACECQA licensed places in the catchment.
            EDR replaces vendor-supplied GapMaps figures, which systematically overstate real demand.
          </div>
        </div>
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
