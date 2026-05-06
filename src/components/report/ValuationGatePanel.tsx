import type { DealWorkflow } from '@/types/workflow'

export default function ValuationGatePanel({ workflow }: { workflow: DealWorkflow }) {
  const gate = workflow.valuation_gate
  const color = gate.status === 'pass' ? '#22c55e' : gate.status === 'blocked' ? '#ef4444' : '#f59e0b'
  const bg = gate.status === 'pass' ? 'rgba(34,197,94,0.07)' : gate.status === 'blocked' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)'
  const title = gate.status === 'blocked'
    ? 'Valuation blocked — insufficient financial evidence.'
    : gate.status === 'needs_review'
    ? 'Valuation needs review'
    : 'Valuation evidence check passed'

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, color: '#fff', marginBottom: 14, fontFamily: "'Space Grotesk', sans-serif" }}>
        Valuation Gate
      </h2>
      <div style={{ background: bg, border: `1px solid ${color}55`, borderRadius: 8, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            {gate.status.replace('_', ' ')}
          </span>
          {!gate.can_show_confident_valuation && (
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#f59e0b', textTransform: 'uppercase' }}>
              illustrative only
            </span>
          )}
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.84)', fontWeight: 700, marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, marginBottom: gate.blockers.length ? 12 : 0 }}>
          {gate.message}
        </div>
        {gate.blockers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {gate.blockers.map((b) => (
              <div key={b.field} style={{ background: 'rgba(0,0,0,0.14)', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 4 }}>{b.reason}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>{b.required_evidence}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
