'use client'

import RunHistoryDrawer from '@/components/report/RunHistoryDrawer'
import type { ManualContextFields } from '@/components/report/ReunderwriteModal'
import type { UnderwritingRun, UnderwritingRunSummary } from '@/types/runs'

export default function RunHistoryScreen({
  dealId,
  manualContextFields,
  onPromoted,
  onViewSnapshot,
}: {
  dealId?: string | null
  manualContextFields?: ManualContextFields
  onPromoted?: () => void
  onViewSnapshot?: (run: UnderwritingRun, summary: UnderwritingRunSummary, currentRun?: UnderwritingRunSummary | null) => void
}) {
  return (
    <section className="no-print" style={{ display: 'grid', gap: 16, marginBottom: 36 }}>
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
          What changed since last run
        </div>
        <h2 style={{ margin: 0, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontSize: 22 }}>
          Version history and change trail
        </h2>
        <p style={{ margin: '9px 0 0', color: 'rgba(255,255,255,0.58)', fontSize: 13.5, lineHeight: 1.6, maxWidth: 760 }}>
          Use this screen to see which run is current, what evidence or blockers changed, and whether the recommendation moved where the existing run data supports it.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        {[
          ['Current run', 'Confirm which underwriting view is the source of truth.'],
          ['Compare changes', 'Review score, gate, evidence, blocker, and recommendation changes when available.'],
          ['Promote carefully', 'Promote only the run that should become the active decision record.'],
        ].map(([title, body]) => (
          <div key={title} style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '13px 14px',
          }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 800, marginBottom: 5 }}>{title}</div>
            <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: 12.3, lineHeight: 1.45 }}>{body}</div>
          </div>
        ))}
      </div>

      <RunHistoryDrawer
        dealId={dealId}
        manualContextFields={manualContextFields}
        defaultOpen
        screenMode
        onPromoted={onPromoted}
        onViewSnapshot={onViewSnapshot}
      />
    </section>
  )
}
