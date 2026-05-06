import type { DealWorkflow, WorkflowFact } from '@/types/workflow'

function formatFactValue(fact: WorkflowFact): string {
  const v = fact.value
  if (v == null || v === '') return 'Missing'
  if (fact.unit === 'aud' && typeof v === 'number') return `$${v.toLocaleString('en-AU')}`
  if (fact.unit === 'percent' && typeof v === 'number') return `${v.toLocaleString('en-AU')}%`
  if (fact.unit === 'places' && typeof v === 'number') return `${v.toLocaleString('en-AU')} places`
  return String(v)
}

const confidenceColor: Record<string, string> = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#f97316',
  missing: '#ef4444',
}

function hasEvidence(fact: WorkflowFact): boolean {
  return Boolean(fact.source?.label || fact.source?.excerpt || fact.evidence_id)
}

export default function FactsReviewPanel({
  workflow,
  onOpenEvidence,
}: {
  workflow: DealWorkflow
  onOpenEvidence?: (fact: WorkflowFact) => void
}) {
  const facts = workflow.facts ?? workflow.extracted_facts ?? []
  if (!facts.length) return null

  const visibleFacts = facts.filter(f => f.confidence !== 'missing' || f.blocker).slice(0, 18)

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, color: '#fff', marginBottom: 14, fontFamily: "'Space Grotesk', sans-serif" }}>
        Extracted Facts
      </h2>
      <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflowX: 'auto', background: '#152336' }}>
        {visibleFacts.map((fact) => (
          <button
            type="button"
            key={fact.id}
            onClick={() => hasEvidence(fact) && onOpenEvidence?.(fact)}
            disabled={!hasEvidence(fact) || !onOpenEvidence}
            aria-label={hasEvidence(fact) ? `Open evidence for ${fact.label}` : `${fact.label}: evidence unavailable`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(150px, 1.15fr) minmax(170px, 1fr) minmax(96px, auto) minmax(150px, 1fr)',
              gap: 12,
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              borderTop: 0,
              borderLeft: 0,
              borderRight: 0,
              alignItems: 'center',
              width: '100%',
              minWidth: 680,
              background: hasEvidence(fact) && onOpenEvidence ? 'rgba(0,180,160,0.025)' : 'transparent',
              color: 'inherit',
              cursor: hasEvidence(fact) && onOpenEvidence ? 'pointer' : 'default',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{fact.label}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' }}>
                {fact.category}
              </div>
            </div>
            <div style={{ fontSize: 13, color: fact.blocker ? '#f59e0b' : 'rgba(255,255,255,0.72)' }}>
              {formatFactValue(fact)}
            </div>
            <div style={{ fontSize: 11, color: confidenceColor[fact.confidence] ?? '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' }}>
              {fact.blocker ? 'Blocker' : fact.confidence}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'IBM Plex Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fact.source?.label ?? fact.source_label ?? 'Source pending'}
              </span>
              {hasEvidence(fact) && onOpenEvidence && (
                <span style={{ color: '#00b4a0', fontSize: 10.5, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Evidence
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
