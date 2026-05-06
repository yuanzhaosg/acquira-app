import type { DealWorkflow } from '@/types/workflow'

const priorityColor: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#00b4a0',
}

export default function DiligenceChecklist({ workflow }: { workflow: DealWorkflow }) {
  const items = workflow.diligence_checklist ?? workflow.diligence_requests ?? []
  if (!items.length) return null

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, color: '#fff', marginBottom: 14, fontFamily: "'Space Grotesk', sans-serif" }}>
        Diligence Checklist
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {items.slice(0, 12).map(item => (
          <div key={item.id} style={{ background: '#152336', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' }}>
                {item.category}
              </span>
              <span style={{ fontSize: 11, color: priorityColor[item.priority] ?? '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', fontWeight: 700 }}>
                {item.priority}
              </span>
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#00b4a0', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Request
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, marginBottom: 8 }}>
              {item.question || item.request}
            </div>
            {item.why_it_matters && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.45 }}>
                <strong style={{ color: 'rgba(255,255,255,0.56)' }}>Why it matters: </strong>
                {item.why_it_matters}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
