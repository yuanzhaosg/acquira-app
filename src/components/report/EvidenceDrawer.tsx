import type { WorkflowEvidence, WorkflowFact } from '@/types/workflow'
import { attachRunEvidenceMetadata, getLocalEvidenceId, makeRunEvidenceId } from '@/lib/evidenceIdentity'

function formatValue(fact: WorkflowFact): string {
  const v = fact.value
  if (v == null || v === '') return 'Missing'
  if (fact.unit === 'aud' && typeof v === 'number') return `$${v.toLocaleString('en-AU')}`
  if (fact.unit === 'percent' && typeof v === 'number') return `${v.toLocaleString('en-AU')}%`
  if (fact.unit === 'places' && typeof v === 'number') return `${v.toLocaleString('en-AU')} places`
  return String(v)
}

export default function EvidenceDrawer({
  fact,
  evidence = [],
  runId,
  runLabel,
  onClose,
}: {
  fact: WorkflowFact | null
  evidence?: WorkflowEvidence[]
  runId?: string | null
  runLabel?: string | null
  onClose: () => void
}) {
  if (!fact) return null

  const factEvidenceId = getLocalEvidenceId(fact.evidence_id)
  const matchedEvidence = evidence.find(e =>
    getLocalEvidenceId(e.id) === factEvidenceId || e.fact_id === fact.id || e.field === fact.field
  )
  const evidenceWithRun = matchedEvidence ? attachRunEvidenceMetadata(matchedEvidence, runId) : null
  const factRunEvidenceId = makeRunEvidenceId(runId ?? evidenceWithRun?.run_id ?? fact.run_id, factEvidenceId)
  const source = fact.source?.label || fact.source?.excerpt
    ? fact.source
    : evidenceWithRun?.source
  const sourceLabel = source?.label ?? evidenceWithRun?.source_label ?? fact.source_label ?? 'Source pending'
  const excerpt = source?.excerpt ?? evidenceWithRun?.excerpt
  const confidence = fact.confidence ?? evidenceWithRun?.confidence
  const hasPreciseLocation = source?.page != null || Boolean(source?.sheet || source?.row_label)
  const provenanceLabel = runId || evidenceWithRun?.run_id || fact.run_id
    ? runLabel ?? 'Evidence from current run'
    : 'Legacy evidence reference'

  return (
    <div className="no-print" role="dialog" aria-modal="true" aria-label={`Evidence for ${fact.label}`} style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'rgba(4,10,18,0.58)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <button
        aria-label="Close evidence drawer"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
      />
      <aside style={{
        position: 'relative', width: 'min(520px, calc(100vw - 20px))', maxWidth: '100%', height: '100%',
        background: '#102033', borderLeft: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '-24px 0 70px rgba(0,0,0,0.35)', padding: '22px clamp(16px, 4vw, 24px)',
        overflowY: 'auto', color: '#e8edf3',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Evidence
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, margin: 0 }}>{fact.label}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close evidence drawer"
            style={{
              minWidth: 72, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)',
              cursor: 'pointer', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase',
            }}
          >
            Close
          </button>
        </div>

        {[
          ['Value', formatValue(fact)],
          ['Confidence', confidence],
          ['Run scope', provenanceLabel],
          ['Source file', sourceLabel],
          ['Page', source?.page != null ? String(source.page) : 'Not available'],
          ['Sheet', source?.sheet ?? 'Not available'],
          ['Extraction', fact.extraction_method ?? evidenceWithRun?.extraction_method ?? 'Not specified'],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>{value}</span>
          </div>
        ))}

        {!hasPreciseLocation && (
          <div style={{
            marginTop: 18, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
            fontSize: 12.5, color: 'rgba(255,255,255,0.62)', lineHeight: 1.5,
          }}>
            <strong style={{ color: '#f59e0b' }}>Location note:</strong> Evidence available only at file/excerpt level.
          </div>
        )}

        {factRunEvidenceId && (
          <div style={{
            marginTop: 18, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(0,180,160,0.06)', border: '1px solid rgba(0,180,160,0.18)',
            fontSize: 12.5, color: 'rgba(255,255,255,0.62)', lineHeight: 1.5,
          }}>
            Evidence references are scoped to this run. Legacy reports may only show local evidence anchors.
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Excerpt
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: 14, minHeight: 110,
            fontSize: 13, color: 'rgba(255,255,255,0.68)', lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
          }}>
            {excerpt || (
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                No excerpt available for this fact yet. Use the source file reference above as the evidence anchor.
              </span>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
