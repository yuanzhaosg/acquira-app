'use client'

import {
  formatRunBytes,
  formatRunDate,
  formatRunLabel,
  formatRunShortId,
  formatRunType,
  summarizeRunDiff,
} from '@/lib/runVersion'
import type { UnderwritingRun, UnderwritingRunSummary } from '@/types/runs'

export default function RunVersionBanner({
  currentRun,
  currentRunSnapshot,
  staleDocumentCount,
  mode = 'current',
  currentRunLabel,
}: {
  currentRun?: UnderwritingRunSummary | null
  currentRunSnapshot?: UnderwritingRun | null
  staleDocumentCount?: number
  mode?: 'current' | 'historical'
  currentRunLabel?: string | null
}) {
  if (!currentRun) return null
  const diff = summarizeRunDiff(currentRunSnapshot?.diff)
  const sourceCount = currentRun.input_source_count ?? 0
  const diligenceCount = currentRun.input_diligence_document_count ?? 0
  const totalCount = currentRun.input_document_count ?? sourceCount + diligenceCount
  const staleCount = staleDocumentCount ?? 0

  return (
    <section className="no-print" style={{
      border: `1px solid ${mode === 'historical' || staleCount > 0 ? 'rgba(245,158,11,0.28)' : 'rgba(0,180,160,0.18)'}`,
      background: mode === 'historical' || staleCount > 0 ? 'rgba(245,158,11,0.065)' : 'rgba(0,180,160,0.045)',
      borderRadius: 8,
      padding: '14px 16px',
      marginBottom: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
            Underwriting version
          </div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>
            {mode === 'historical' ? 'Viewing historical snapshot' : 'Current underwriting'}: {formatRunLabel(currentRun)}
            <span style={{ color: 'rgba(255,255,255,0.42)', fontWeight: 500 }}> · {formatRunType(currentRun.run_type)} · {currentRun.status}</span>
            {currentRun.is_current && <span style={{ color: '#00b4a0', fontWeight: 700 }}> · Current</span>}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12.2, marginTop: 5, lineHeight: 1.45 }}>
            ID {formatRunShortId(currentRun.id)} · Completed {formatRunDate(currentRun.completed_at)} · Promoted {formatRunDate(currentRun.promoted_at)}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 4, minWidth: 230, color: 'rgba(255,255,255,0.58)', fontSize: 12.2 }}>
          <span>{totalCount} input document{totalCount === 1 ? '' : 's'} · {formatRunBytes(currentRun.input_total_bytes)}</span>
          <span>{sourceCount} retained source · {diligenceCount} diligence</span>
          <span>Evidence references are scoped to this underwriting run.</span>
        </div>
      </div>
      {staleCount > 0 && (
        <div style={{ marginTop: 10, color: '#f59e0b', fontSize: 12.3, lineHeight: 1.5 }}>
          Current underwriting excludes {staleCount} newer uploaded diligence document{staleCount === 1 ? '' : 's'}.
        </div>
      )}
      {mode === 'historical' && !currentRun.is_current && (
        <div style={{ marginTop: 10, color: '#f59e0b', fontSize: 12.3, lineHeight: 1.5 }}>
          Historical snapshot only. The current deal report is still {currentRunLabel ?? 'the promoted current run'} unless this run is explicitly promoted.
        </div>
      )}
      {diff && (
        <div style={{ display: 'grid', gap: 6, marginTop: 11, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
            Changed since prior run
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: 'rgba(255,255,255,0.62)', fontSize: 12.2 }}>
            {diff.scoreChange && <span>Score {diff.scoreChange}</span>}
            {diff.valuationGateChange && <span>Gate {diff.valuationGateChange}</span>}
            {diff.recommendationChange && <span>Recommendation changed</span>}
            {diff.resolvedBlockers.length > 0 && <span>{diff.resolvedBlockers.length} blocker{diff.resolvedBlockers.length === 1 ? '' : 's'} resolved</span>}
            {diff.newBlockers.length > 0 && <span>{diff.newBlockers.length} new blocker{diff.newBlockers.length === 1 ? '' : 's'}</span>}
          </div>
        </div>
      )}
    </section>
  )
}
