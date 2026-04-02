'use client'

import { useMemo, useState } from 'react'
import { calculateICValuation } from '@/lib/valuationEngine'
import type { ICValuationResult, ScenarioOutput } from '@/lib/valuationEngine'

function fmtM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n.toLocaleString()}`
}

function fmtPct(n: number, decimals = 0): string {
  return `${n.toFixed(decimals)}%`
}

const REC_CONFIG = {
  proceed: {
    label: 'Proceed',
    icon: '🟢',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
  },
  proceed_with_caution: {
    label: 'Proceed with Caution',
    icon: '🟡',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
  },
  do_not_proceed: {
    label: 'Do Not Proceed',
    icon: '🔴',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
  },
}

const RISK_LEVEL_CONFIG = {
  low:      { color: '#22c55e', label: 'Low' },
  moderate: { color: '#f59e0b', label: 'Moderate' },
  high:     { color: '#ef4444', label: 'High' },
}

interface ICSummaryProps {
  // From demand_context (scored output)
  kids0to4: number
  totalLicensedPlaces: number
  isRegional?: boolean
  // From pipeline_intel / scored output
  pipelineApprovedPlaces?: number
  pipelineLodgedPlaces?: number
  // From centre / extraction
  centreLicensedPlaces: number
  centreCurrentOccupancy?: number   // 0–1
  centreAvgDailyFee?: number
  centreAskingPrice?: number
}

export default function ICSummary({
  kids0to4,
  totalLicensedPlaces,
  isRegional = false,
  pipelineApprovedPlaces = 0,
  pipelineLodgedPlaces = 0,
  centreLicensedPlaces,
  centreCurrentOccupancy,
  centreAvgDailyFee,
  centreAskingPrice,
}: ICSummaryProps) {
  const [showSensitivity, setShowSensitivity] = useState(false)
  const [showMethodology, setShowMethodology] = useState(false)

  const result: ICValuationResult = useMemo(() => calculateICValuation({
    kids_0_to_4: kids0to4,
    total_licensed_places: totalLicensedPlaces,
    pipeline_approved_places: pipelineApprovedPlaces,
    pipeline_lodged_places: pipelineLodgedPlaces,
    centre_licensed_places: centreLicensedPlaces,
    centre_current_occupancy: centreCurrentOccupancy,
    centre_avg_daily_fee: centreAvgDailyFee,
    centre_asking_price: centreAskingPrice,
    is_regional: isRegional,
  }), [kids0to4, totalLicensedPlaces, pipelineApprovedPlaces, pipelineLodgedPlaces,
       centreLicensedPlaces, centreCurrentOccupancy, centreAvgDailyFee, centreAskingPrice, isRegional])

  const { scenarios, pipeline, recommendation, recommendation_rationale } = result
  const rec = REC_CONFIG[recommendation]
  const pipelineRisk = RISK_LEVEL_CONFIG[pipeline.risk_level]

  const ScenarioCol = ({ s }: { s: ScenarioOutput }) => {
    const labelColor = s.label === 'Upside' ? '#22c55e' : s.label === 'Base' ? '#00b4a0' : '#f59e0b'
    return (
      <div style={{
        flex: 1, padding: '14px 16px',
        background: s.label === 'Base' ? 'rgba(0,180,160,0.06)' : 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        border: s.label === 'Base' ? '1px solid rgba(0,180,160,0.2)' : '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 10,
          fontWeight: 700, color: labelColor, textTransform: 'uppercase',
          letterSpacing: '0.1em', marginBottom: 10,
        }}>{s.label}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Occupancy', value: fmtPct(s.stabilised_occupancy) },
            { label: 'Revenue', value: fmtM(s.annual_revenue) },
            { label: 'EBITDA', value: fmtM(s.ebitda), sub: fmtPct(s.ebitda_margin_pct) + ' margin' },
            { label: 'Valuation', value: `${fmtM(s.valuation_low)}–${fmtM(s.valuation_high)}`, sub: `${s.valuation_multiple}× EBITDA` },
            ...(s.cash_on_cash_return != null ? [{ label: '5yr unlevered return', value: fmtPct(s.cash_on_cash_return) }] : []),
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>{row.label}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e8edf3', fontFamily: 'Space Grotesk, sans-serif' }}>{row.value}</span>
                {row.sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{row.sub}</div>}
              </div>
            </div>
          ))}
        </div>
        {s.risk_flags.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {s.risk_flags.map((f, i) => (
              <div key={i} style={{ fontSize: 10, color: '#f59e0b', marginBottom: 2 }}>⚠ {f}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Section label */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.3)', marginBottom: 20,
        paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        IC Valuation Summary
      </div>

      {/* Recommendation banner */}
      <div style={{
        background: rec.bg, border: `1.5px solid ${rec.border}`,
        borderRadius: 10, padding: '16px 20px', marginBottom: 20,
        display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: rec.color, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Recommendation
          </div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 800, color: rec.color }}>
            {rec.icon} {rec.label}
          </div>
        </div>
        <div style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, paddingTop: 20 }}>
          {recommendation_rationale}
        </div>
      </div>

      {/* Pipeline + absorption strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10, marginBottom: 20,
      }}>
        {[
          {
            label: 'Risk-adj. pipeline',
            value: `${pipeline.risk_adjusted_places} places`,
            sub: `${fmtPct(pipeline.supply_shock_pct)}% supply shock`,
            color: pipeline.risk_level === 'low' ? '#22c55e' : pipeline.risk_level === 'moderate' ? '#f59e0b' : '#ef4444',
          },
          {
            label: 'Years to absorb',
            value: pipeline.years_to_absorb >= 99 ? '∞' : `${pipeline.years_to_absorb}yr`,
            sub: `Pipeline risk: ${pipelineRisk.label}`,
            color: pipelineRisk.color,
          },
          {
            label: 'Annual demand growth',
            value: `+${pipeline.annual_demand_growth} kids/yr`,
            sub: '3% catchment growth rate',
            color: '#e8edf3',
          },
          {
            label: 'Base EBITDA',
            value: fmtM(scenarios.base.ebitda),
            sub: `${fmtPct(scenarios.base.ebitda_margin_pct)} margin`,
            color: '#00b4a0',
          },
        ].map(s => (
          <div key={s.label} style={{ background: '#152336', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Scenario columns */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <ScenarioCol s={scenarios.upside} />
        <ScenarioCol s={scenarios.base} />
        <ScenarioCol s={scenarios.downside} />
      </div>

      {/* Sensitivity grid toggle */}
      <button
        onClick={() => setShowSensitivity(v => !v)}
        className="no-print"
        style={{
          width: '100%', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,
          padding: '10px 16px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
          textAlign: 'left', marginBottom: showSensitivity ? 0 : 8,
          display: 'flex', justifyContent: 'space-between',
        }}
      >
        <span>⊞ Sensitivity Analysis — Fee vs Occupancy</span>
        <span>{showSensitivity ? '▲' : '▼'}</span>
      </button>

      {showSensitivity && (
        <div style={{
          background: '#152336', border: '1px solid rgba(255,255,255,0.07)',
          borderTop: 'none', borderRadius: '0 0 8px 8px',
          padding: '16px', marginBottom: 8, overflowX: 'auto',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12, fontFamily: 'IBM Plex Mono, monospace' }}>
            EBITDA / Valuation — rows: fee ±10%, cols: occupancy ±10%
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 400 }}>Fee \ Occ</th>
                {[-0.10, 0, 0.10].map(od => (
                  <th key={od} style={{ padding: '4px 10px', textAlign: 'right', color: od < 0 ? '#ef4444' : od > 0 ? '#22c55e' : '#e8edf3', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>
                    {od === 0 ? 'Base' : od > 0 ? '+10%' : '-10%'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.sensitivity.map((row, ri) => (
                <tr key={ri} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '6px 10px', color: result.sensitivity[ri][0].fee_delta < 0 ? '#ef4444' : result.sensitivity[ri][0].fee_delta > 0 ? '#22c55e' : '#e8edf3', fontFamily: 'IBM Plex Mono, monospace' }}>
                    {row[0].fee_delta === 0 ? 'Base' : row[0].fee_delta > 0 ? 'Fee +10%' : 'Fee -10%'}
                  </td>
                  {row.map((cell, ci) => {
                    const isBase = ri === 1 && ci === 1
                    return (
                      <td key={ci} style={{
                        padding: '6px 10px', textAlign: 'right',
                        background: isBase ? 'rgba(0,180,160,0.08)' : 'transparent',
                        borderRadius: isBase ? 4 : 0,
                      }}>
                        <div style={{ fontWeight: 700, color: '#e8edf3', fontFamily: 'Space Grotesk, sans-serif' }}>{fmtM(cell.ebitda)}</div>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{fmtM(cell.valuation)} · {cell.multiple}×</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Methodology note */}
      <button
        onClick={() => setShowMethodology(v => !v)}
        className="no-print"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: 'rgba(255,255,255,0.2)',
          fontFamily: 'IBM Plex Mono, monospace', padding: '4px 0',
          display: 'flex', gap: 6, alignItems: 'center',
        }}
      >
        <span>{showMethodology ? '▲' : '▼'}</span>
        <span>Methodology & assumptions</span>
      </button>
      {showMethodology && (
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7,
          padding: '10px 14px', background: 'rgba(255,255,255,0.02)',
          borderRadius: 6, marginTop: 6,
        }}>
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Participation rate:</strong> {fmtPct(result.inputs_used.participation_rate * 100)} ({isRegional ? 'regional' : 'metro'} LDC utilisation, DoE CCS March 2024).<br />
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Pipeline weighting:</strong> Approved DAs ×1.0 + Lodged ×0.5 = risk-adjusted supply.<br />
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Revenue:</strong> Stabilised occupancy × {centreLicensedPlaces} places × ${result.inputs_used.avg_daily_fee}/day × 260 operating days.<br />
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>EBITDA margin:</strong> {fmtPct(result.inputs_used.margin * 100)} (base). Scenario range: {isRegional ? '15–24%' : '18–27%'}.<br />
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Multiples:</strong> 5.0–7.2× calibrated to CBRE/JLL/Burgess Rawson Australian transactions 2022–2024.<br />
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Return:</strong> Unlevered 5yr cash-on-cash vs asking price. No debt assumed.<br />
          <em>Indicative only. Not financial advice. Verify all assumptions against current market data.</em>
        </div>
      )}
    </div>
  )
}
