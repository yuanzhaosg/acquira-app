'use client'

import DiligenceWorkspace from '@/components/diligence/DiligenceWorkspace'
import DiligenceChecklist from '@/components/report/DiligenceChecklist'
import type { DealWorkflow } from '@/types/workflow'

function countItems(workflow?: DealWorkflow | null) {
  const items = workflow?.diligence_checklist ?? workflow?.diligence_requests ?? []
  return {
    total: items.length,
    doFirst: items.filter(item => item.priority === 'high').length,
    thisWeek: items.filter(item => item.priority === 'medium').length,
    beforeOffer: items.filter(item => item.priority === 'low').length,
  }
}

export default function DiligenceActionScreen({
  dealId,
  workflow,
}: {
  dealId?: string | null
  workflow?: DealWorkflow | null
}) {
  const counts = countItems(workflow)

  return (
    <section className="no-print" style={{ display: 'grid', gap: 18, marginBottom: 38 }}>
      <div style={{
        border: '1px solid rgba(255,255,255,0.1)',
        background: '#132338',
        borderRadius: 8,
        padding: 18,
      }}>
        <div style={{
          color: '#00b4a0',
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          What to verify before offer
        </div>
        <h2 style={{ margin: 0, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontSize: 22 }}>
          Diligence action workspace
        </h2>
        <p style={{ margin: '9px 0 0', color: 'rgba(255,255,255,0.58)', fontSize: 13.5, lineHeight: 1.6, maxWidth: 780 }}>
          Use this screen to request broker evidence, track follow-up uploads, and decide what blocks confidence before moving to an offer.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {[
          ['Do first', counts.doFirst, 'Critical broker evidence or blockers.'],
          ['This week', counts.thisWeek, 'Important follow-up requests to keep diligence moving.'],
          ['Before offer', counts.beforeOffer, 'Verification items to resolve before submitting terms.'],
          ['Open actions', counts.total, 'Generated checklist and broker evidence requests.'],
        ].map(([label, value, body]) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '13px 14px',
          }}>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</div>
            <div style={{ color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', marginTop: 6 }}>{label}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12.2, lineHeight: 1.45, marginTop: 5 }}>{body}</div>
          </div>
        ))}
      </div>

      <DiligenceWorkspace dealId={dealId} workflow={workflow} />
      {workflow && <DiligenceChecklist workflow={workflow} />}
    </section>
  )
}
