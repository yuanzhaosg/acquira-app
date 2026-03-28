'use client'

const DIMENSIONS = [
  { id: 'occupancy_demand',       label: 'Occupancy & Demand' },
  { id: 'profitability_cashflow', label: 'Profitability & Cashflow' },
  { id: 'revenue_pricing',        label: 'Revenue & Pricing' },
  { id: 'staffing_resilience',    label: 'Staffing & Labour' },
  { id: 'lease_economics',        label: 'Lease Economics' },
  { id: 'regulatory_quality',     label: 'Regulatory Quality' },
  { id: 'market_position',        label: 'Market Position' },
  { id: 'management_systems',     label: 'Management Systems' },
  { id: 'valuation_structure',    label: 'Valuation Structure' },
  { id: 'upside_levers',          label: 'Upside Levers' },
  { id: 'ccs_risk',               label: 'CCS / Subsidy Risk' },
  { id: 'lease_tail',             label: 'Lease Tail' },
  { id: 'capex_liability',        label: 'CAPEX Liability' },
  { id: 'staff_qualification_mix',label: 'Staff Qualifications' },
  { id: 'fee_benchmarking',       label: 'Fee Benchmarking' },
  { id: 'operator_quality',       label: 'Operator Quality' },
  { id: 'enrolment_trend',        label: 'Enrolment Trend' },
] as const

interface DealRow {
  id: string
  centre_name: string | null
  total_score: number | null
  scored: unknown
}

interface CompareViewProps {
  deals: DealRow[]
  onBack: () => void
}

function getDimScore(scored: unknown, dimId: string): number | null {
  if (!scored || typeof scored !== 'object') return null
  const s = scored as Record<string, unknown>
  const dims = s.dimensions as Record<string, unknown> | undefined
  if (!dims) return null
  const dim = dims[dimId] as Record<string, unknown> | undefined
  if (!dim) return null
  const sc = dim.score
  return typeof sc === 'number' ? sc : null
}

function getTotalScore(scored: unknown): number | null {
  if (!scored || typeof scored !== 'object') return null
  const s = scored as Record<string, unknown>
  if (typeof s.total_score === 'number') return s.total_score
  if (typeof s.overall_score === 'number') return (s.overall_score as number) * 10
  return null
}

function scoreColor(s: number): string {
  if (s >= 7) return '#22c55e'
  if (s >= 5.5) return '#00b4a0'
  if (s >= 4) return '#f59e0b'
  return '#ef4444'
}

export default function CompareView({ deals, onBack }: CompareViewProps) {
  if (!deals.length) return null

  // For each dimension, find the max score across all deals
  function maxDimScore(dimId: string): number {
    return Math.max(...deals.map(d => getDimScore(d.scored, dimId) ?? 0))
  }
  function maxTotal(): number {
    return Math.max(...deals.map(d => getTotalScore(d.scored) ?? 0))
  }

  const totalMax = maxTotal()

  return (
    <div style={{
      minHeight: '100vh', background: '#0d1b2a',
      fontFamily: "'DM Sans', sans-serif", color: '#fff',
      padding: '0 0 80px',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,27,42,0.98)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,180,160,0.15)',
        padding: '0 24px', height: 54,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7, padding: '6px 14px', color: 'rgba(255,255,255,0.7)',
            fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ← Back
        </button>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700 }}>
          Deal Comparison
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {deals.length} deals · Teal = highest score per row
        </span>
      </div>

      <div style={{ overflowX: 'auto', padding: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 600 }}>
          <colgroup>
            <col style={{ width: 200 }} />
            {deals.map(d => <col key={d.id} style={{ width: 180 }} />)}
          </colgroup>

          {/* Deal name headers */}
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                Dimension
              </th>
              {deals.map(deal => {
                const total = getTotalScore(deal.scored)
                const isTopTotal = total !== null && total === totalMax && deals.length > 1
                return (
                  <th key={deal.id} style={{
                    padding: '12px 16px',
                    background: isTopTotal ? 'rgba(0,180,160,0.08)' : 'rgba(255,255,255,0.02)',
                    borderRadius: 8, textAlign: 'center',
                    borderBottom: '2px solid rgba(0,180,160,0.2)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e8edf3', marginBottom: 4 }}>
                      {deal.centre_name ?? 'Unnamed'}
                    </div>
                    {total !== null && (
                      <div style={{
                        fontSize: 22, fontWeight: 700,
                        fontFamily: "'Space Grotesk', sans-serif",
                        color: isTopTotal ? '#00b4a0' : '#94a3b8',
                      }}>
                        {total.toFixed(1)}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {DIMENSIONS.map((dim, rowIdx) => {
              const maxScore = maxDimScore(dim.id)
              return (
                <tr key={dim.id} style={{ background: rowIdx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                  <td style={{
                    padding: '10px 16px', fontSize: 12, color: '#94a3b8', fontWeight: 500,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    {dim.label}
                  </td>
                  {deals.map(deal => {
                    const sc = getDimScore(deal.scored, dim.id)
                    const isHighest = sc !== null && sc === maxScore && maxScore > 0 && deals.length > 1
                    return (
                      <td key={deal.id} style={{
                        padding: '10px 16px', textAlign: 'center',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isHighest ? 'rgba(0,180,160,0.08)' : 'transparent',
                      }}>
                        {sc !== null ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{
                              fontSize: 15, fontWeight: 700,
                              fontFamily: "'Space Grotesk', sans-serif",
                              color: isHighest ? '#00b4a0' : scoreColor(sc),
                            }}>
                              {sc.toFixed(1)}
                            </span>
                            <div style={{
                              width: 40, height: 3, borderRadius: 2,
                              background: 'rgba(255,255,255,0.08)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${(sc / 10) * 100}%`,
                                height: '100%',
                                background: isHighest ? '#00b4a0' : scoreColor(sc),
                                borderRadius: 2,
                              }} />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
