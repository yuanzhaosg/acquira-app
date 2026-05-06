'use client'

import { compareRunSnapshots, type ComparableMetric } from '@/lib/runComparison'
import { formatRunDate, formatRunType } from '@/lib/runVersion'
import type { UnderwritingRun, UnderwritingRunSummary } from '@/types/runs'

function metricTone(metric: ComparableMetric): string {
  return metric.changed ? '#f59e0b' : 'rgba(255,255,255,0.58)'
}

function RunHeader({ summary }: { summary: ReturnType<typeof compareRunSnapshots>['left'] }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ color: '#fff', fontSize: 14 }}>{summary.label}</strong>
        <span style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
          {formatRunType(summary.runType)}
        </span>
        <span style={{ color: summary.status === 'completed' ? '#00b4a0' : '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
          {summary.status}
        </span>
        {summary.isCurrent && <span style={{ color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>Current</span>}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12.2, lineHeight: 1.5 }}>
        Completed {formatRunDate(summary.completedAt)} · Promoted {formatRunDate(summary.promotedAt)}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11.8, marginTop: 5 }}>
        Inputs: {summary.inputDocumentCount} document{summary.inputDocumentCount === 1 ? '' : 's'} · {summary.inputSourceCount} source, {summary.inputDiligenceCount} diligence
      </div>
    </div>
  )
}

function ComparisonRow({ metric }: { metric: ComparableMetric }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 0.7fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 10, alignItems: 'start', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '9px 0' }}>
      <div style={{ color: 'rgba(255,255,255,0.44)', fontSize: 12.1 }}>{metric.label}</div>
      <div style={{ color: metricTone(metric), fontSize: 12.4, lineHeight: 1.45 }}>{metric.left}</div>
      <div style={{ color: metricTone(metric), fontSize: 12.4, lineHeight: 1.45 }}>{metric.right}</div>
    </div>
  )
}

function ListBlock({ title, items, empty, tone = 'neutral' }: { title: string; items: string[]; empty: string; tone?: 'neutral' | 'good' | 'warn' }) {
  const color = tone === 'good' ? '#00b4a0' : tone === 'warn' ? '#f59e0b' : 'rgba(255,255,255,0.62)'
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: 12 }}>
      <div style={{ color: 'rgba(255,255,255,0.36)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', marginBottom: 7 }}>
        {title}
      </div>
      {items.length ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {items.slice(0, 6).map((item, index) => (
            <div key={`${item}-${index}`} style={{ color, fontSize: 12.3, lineHeight: 1.45 }}>{item}</div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.36)', fontSize: 12.2 }}>{empty}</div>
      )}
    </div>
  )
}

export default function RunComparisonView({
  leftRun,
  rightRun,
  leftSummary,
  rightSummary,
  promoting,
  onClose,
  onViewSnapshot,
  onPromoteRight,
}: {
  leftRun: UnderwritingRun
  rightRun: UnderwritingRun
  leftSummary: UnderwritingRunSummary
  rightSummary: UnderwritingRunSummary
  promoting?: boolean
  onClose: () => void
  onViewSnapshot: (run: UnderwritingRun, summary: UnderwritingRunSummary) => void
  onPromoteRight?: (summary: UnderwritingRunSummary) => void | Promise<void>
}) {
  const comparison = compareRunSnapshots(leftRun, rightRun, leftSummary, rightSummary)
  const rightCanPromote = rightSummary.status === 'completed' && !rightSummary.is_current && Boolean(onPromoteRight)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare underwriting runs"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(6,12,20,0.78)',
        display: 'grid',
        placeItems: 'center',
        padding: '22px',
      }}
    >
      <div style={{ width: 'min(1180px, 100%)', maxHeight: '92vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.12)', background: '#132338', borderRadius: 8, boxShadow: '0 22px 70px rgba(0,0,0,0.35)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: '#132338', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Underwriting comparison
            </div>
            <h3 style={{ margin: 0, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontSize: 20 }}>
              Run #{leftSummary.run_number} vs Run #{rightSummary.run_number}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => onViewSnapshot(leftRun, leftSummary)} style={buttonStyle('secondary', false)}>View left snapshot</button>
            <button type="button" onClick={() => onViewSnapshot(rightRun, rightSummary)} style={buttonStyle('secondary', false)}>View right snapshot</button>
            {rightCanPromote && (
              <button type="button" disabled={promoting} onClick={() => onPromoteRight?.(rightSummary)} style={buttonStyle('primary', Boolean(promoting))}>
                {promoting ? 'Promoting...' : 'Promote right run'}
              </button>
            )}
            <button type="button" onClick={onClose} style={buttonStyle('secondary', false)}>Close</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14, padding: 16 }}>
          {!rightSummary.is_current && (
            <div style={{ border: '1px solid rgba(245,158,11,0.22)', background: 'rgba(245,158,11,0.07)', borderRadius: 8, padding: '9px 11px', color: '#f59e0b', fontSize: 12.5 }}>
              Right side is a candidate run. It is not current unless explicitly promoted.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <RunHeader summary={comparison.left} />
            <RunHeader summary={comparison.right} />
          </div>

          <section style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Summary</h4>
            <ComparisonRow metric={comparison.summaryMetrics[0]} />
            <ComparisonRow metric={comparison.summaryMetrics[1]} />
            <ComparisonRow metric={comparison.summaryMetrics[2]} />
            <ComparisonRow metric={comparison.summaryMetrics[3]} />
          </section>

          <section style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Key Financials</h4>
            {comparison.financialMetrics.map(metric => <ComparisonRow key={metric.key} metric={metric} />)}
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <ListBlock title="Left blockers" items={comparison.oldBlockers} empty="No blockers stored." />
            <ListBlock title="Right blockers" items={comparison.rightBlockers} empty="No blockers stored." />
            <ListBlock title="Resolved blockers" items={comparison.resolvedBlockers} empty="None resolved." tone="good" />
            <ListBlock title="New blockers" items={comparison.newBlockers} empty="None introduced." tone="warn" />
          </section>

          <section style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Changed Facts</h4>
            {comparison.changedFacts.length ? comparison.changedFacts.slice(0, 10).map(fact => (
              <ComparisonRow key={fact.key} metric={fact} />
            )) : (
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12.4 }}>No changed facts detected in the focused comparison set.</div>
            )}
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            <ListBlock title="Left warnings" items={comparison.warnings.left} empty="No warnings found." tone="warn" />
            <ListBlock title="Right warnings" items={comparison.warnings.right} empty="No warnings found." tone="warn" />
          </section>

          <div style={{ border: '1px solid rgba(0,180,160,0.16)', background: 'rgba(0,180,160,0.055)', borderRadius: 8, padding: '9px 11px', color: 'rgba(255,255,255,0.62)', fontSize: 12.3 }}>
            Evidence references are scoped to each underwriting run. This comparison does not expose document URLs or mutate the current report.
          </div>
        </div>
      </div>
    </div>
  )
}

const sectionStyle = {
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.025)',
  borderRadius: 8,
  padding: '12px 14px',
}

const sectionTitleStyle = {
  margin: '0 0 8px',
  color: 'rgba(255,255,255,0.36)',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 10.5,
  textTransform: 'uppercase' as const,
}

function buttonStyle(kind: 'primary' | 'secondary', disabled: boolean) {
  return {
    border: kind === 'primary' ? '1px solid rgba(0,180,160,0.32)' : '1px solid rgba(255,255,255,0.14)',
    background: disabled ? 'rgba(255,255,255,0.04)' : kind === 'primary' ? 'rgba(0,180,160,0.12)' : 'rgba(255,255,255,0.04)',
    color: disabled ? 'rgba(255,255,255,0.32)' : kind === 'primary' ? '#00b4a0' : '#e8edf3',
    borderRadius: 6,
    padding: '8px 11px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
  }
}
