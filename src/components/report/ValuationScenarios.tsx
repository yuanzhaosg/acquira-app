'use client'

import {
  buildScenarios,
  computeLeaseholdMultiple,
  revaluationTriggers,
  COMP_LAST_REVIEWED,
  type LeaseholdInputs,
} from '@/lib/valuationMultiple'

function fmtM(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v.toFixed(0)}`
}

export interface ValuationScenariosProps {
  ebitda?: number | null
  askingPrice?: number | null
  inputs: LeaseholdInputs
  leaseOptionsConfirmed?: boolean | null
  /** API-computed result (acquira-api valuation_multiple). When present and
   *  applicable, it is the source of truth; the local port is the fallback. */
  apiResult?: Record<string, any> | null
}

export default function ValuationScenarios({
  ebitda, askingPrice, inputs, leaseOptionsConfirmed, apiResult,
}: ValuationScenariosProps) {
  const local = computeLeaseholdMultiple(inputs)
  // Prefer the API result when it is present and applicable (single source of truth).
  const usingApi = Boolean(apiResult && apiResult.applicable && apiResult.recommended_multiple)
  const multiple: typeof local = usingApi
    ? {
        band: apiResult!.comp_band ?? local.band,
        midpoint: apiResult!.comp_midpoint ?? local.midpoint,
        netDelta: apiResult!.net_factor_delta ?? local.netDelta,
        recommended: apiResult!.recommended_multiple,
        factors: (apiResult!.factors ?? local.factors) as typeof local.factors,
        interpretation: apiResult!.interpretation ?? local.interpretation,
      }
    : local
  const scenarios = buildScenarios(multiple, ebitda)
  const triggers = revaluationTriggers({
    occupancyPct: inputs.occupancyPct,
    occupancyDeclining: inputs.occupancyDeclining,
    leaseYearsRemaining: inputs.leaseYearsRemaining,
    leaseOptionsConfirmed,
  })
  const firedTriggers = triggers.filter(t => t.fires)

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: 18, marginBottom: 16,
  }
  const sectionLabel: React.CSSProperties = {
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12,
  }

  const scenarioColors: Record<string, string> = { upside: '#22c55e', base: '#00b4a0', downside: '#f59e0b' }

  return (
    <div style={card}>
      <div style={sectionLabel}>Valuation scenarios · leasehold going concern · {multiple.recommended.mid}× base</div>

      {/* Scenario columns */}
      {scenarios ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 6 }}>
          {scenarios.map(s => {
            const c = scenarioColors[s.key]
            const vsAsk = askingPrice && askingPrice > 0 ? s.valuation / askingPrice - 1 : null
            return (
              <div key={s.key} style={{
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${c}55`,
                borderRadius: 8, padding: '13px 14px',
              }}>
                <div style={{ color: c, fontSize: 12, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 6 }}>
                  {s.label}
                </div>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.1 }}>
                  {fmtM(s.valuation)}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', marginTop: 4 }}>
                  {s.multiple}× × {fmtM(s.ebitda)}
                </div>
                {vsAsk != null && (
                  <div style={{ color: vsAsk >= 0 ? '#22c55e' : '#ef4444', fontSize: 11, marginTop: 5, fontWeight: 600 }}>
                    {vsAsk >= 0 ? '+' : ''}{(vsAsk * 100).toFixed(0)}% vs ask
                  </div>
                )}
                <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 10.5, lineHeight: 1.4, marginTop: 7 }}>
                  {s.basis}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.5, lineHeight: 1.5 }}>
          Enter a normalised EBITDA to compute upside / base / downside valuations. Multiple range
          is <strong style={{ color: '#fff' }}>{multiple.recommended.low}–{multiple.recommended.high}×</strong> ({multiple.interpretation}).
        </div>
      )}

      {askingPrice != null && askingPrice > 0 && scenarios && (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5, marginTop: 4, marginBottom: 14 }}>
          Asking <strong style={{ color: '#e8edf3' }}>{fmtM(askingPrice)}</strong> sits{' '}
          {askingPrice > scenarios[0].valuation
            ? <span style={{ color: '#ef4444' }}>above the upside case</span>
            : askingPrice < scenarios[2].valuation
            ? <span style={{ color: '#22c55e' }}>below the downside case</span>
            : 'inside the scenario range'} — apply to buyer-normalised EBITDA, not the vendor's figure.
        </div>
      )}

      {/* Re-valuation triggers */}
      {firedTriggers.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={sectionLabel}>Re-valuation triggers</div>
          {firedTriggers.map(t => (
            <div key={t.field} style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
              borderRadius: 8, padding: '9px 11px', marginBottom: 7,
              color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.5,
            }}>
              <strong style={{ color: '#f59e0b' }}>{t.label}: </strong>{t.reason}
            </div>
          ))}
        </div>
      )}

      {/* Factor trail */}
      <div style={sectionLabel}>How the multiple was set</div>
      <div style={{ display: 'grid', gap: 5 }}>
        {multiple.factors.map(f => {
          const c = f.direction === 'up' ? '#22c55e' : f.direction === 'down' ? '#f59e0b' : 'rgba(255,255,255,0.4)'
          const arrow = f.direction === 'up' ? '▲' : f.direction === 'down' ? '▼' : '–'
          return (
            <div key={f.name} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12, lineHeight: 1.45 }}>
              <span style={{ color: c, fontFamily: 'IBM Plex Mono, monospace', minWidth: 52 }}>
                {arrow} {f.delta >= 0 ? '+' : ''}{f.delta.toFixed(2)}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'IBM Plex Mono, monospace', minWidth: 78, textTransform: 'capitalize' }}>
                {f.name}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{f.rationale}</span>
            </div>
          )
        })}
      </div>

      <div style={{ color: 'rgba(255,255,255,0.32)', fontSize: 10.5, marginTop: 12, fontFamily: 'IBM Plex Mono, monospace' }}>
        Comp band 3.0–5.0× adj EBITDA · single leasehold centre · reviewed {COMP_LAST_REVIEWED} · freehold valued on yield (out of scope) · {usingApi ? 'multiple from API' : 'multiple computed locally'}
      </div>
    </div>
  )
}
