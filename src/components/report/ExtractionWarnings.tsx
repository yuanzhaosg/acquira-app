import type { DealWorkflow } from '@/types/workflow'

export default function ExtractionWarnings({ workflow }: { workflow: DealWorkflow }) {
  const warnings = workflow.extraction_warnings ?? []
  if (!warnings.length) return null

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {warnings.map(w => (
          <div
            key={w.id}
            style={{
              background: w.severity === 'info' ? 'rgba(0,180,160,0.06)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${w.severity === 'info' ? 'rgba(0,180,160,0.18)' : 'rgba(245,158,11,0.22)'}`,
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.62)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: w.severity === 'info' ? '#00b4a0' : '#f59e0b', textTransform: 'uppercase', marginRight: 8 }}>
              {w.severity}
            </span>
            {w.message}
          </div>
        ))}
      </div>
    </section>
  )
}
