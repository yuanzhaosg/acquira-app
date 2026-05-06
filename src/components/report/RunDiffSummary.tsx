'use client'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function textValue(value: unknown): string {
  if (value == null || value === '') return 'Not available'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function firstFields(rows: unknown[]): string {
  const fields = rows
    .map(row => asRecord(row).field)
    .filter((field): field is string => typeof field === 'string' && field.length > 0)
  return fields.length ? fields.slice(0, 4).join(', ') : 'None'
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' }) {
  const color = tone === 'good' ? '#00b4a0' : tone === 'warn' ? '#f59e0b' : 'rgba(255,255,255,0.72)'
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ color: 'rgba(255,255,255,0.36)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 12.5, lineHeight: 1.45 }}>{value}</div>
    </div>
  )
}

export default function RunDiffSummary({ diff, runId }: { diff?: unknown | null; runId?: string | null }) {
  const data = asRecord(diff)
  if (!Object.keys(data).length) {
    return <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 12.5 }}>No diff was stored for this run.</div>
  }

  const scoreChange = asRecord(data.score_change)
  const valuationChange = asRecord(data.valuation_gate_change)
  const recommendationChange = asRecord(data.recommendation_change)
  const missingChange = asRecord(data.missing_fields_change)
  const resolvedBlockers = asArray(data.resolved_blockers)
  const newBlockers = asArray(data.new_blockers)
  const changedFacts = asArray(data.changed_facts)
  const warnings = asArray(data.warnings).filter((warning): warning is string => typeof warning === 'string')
  const delta = typeof scoreChange.delta === 'number' ? `${scoreChange.delta > 0 ? '+' : ''}${scoreChange.delta.toFixed(1)}` : 'Not available'

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {runId && (
        <div style={{ border: '1px solid rgba(0,180,160,0.16)', background: 'rgba(0,180,160,0.055)', borderRadius: 8, padding: '8px 10px', color: 'rgba(255,255,255,0.6)', fontSize: 12.2 }}>
          Evidence references are scoped to this run.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <SummaryCard label="Score change" value={`${textValue(scoreChange.from)} -> ${textValue(scoreChange.to)} (${delta})`} tone={typeof scoreChange.delta === 'number' && scoreChange.delta >= 0 ? 'good' : 'warn'} />
        <SummaryCard label="Valuation gate" value={`${textValue(valuationChange.from)} -> ${textValue(valuationChange.to)}`} tone={valuationChange.to === 'pass' ? 'good' : 'warn'} />
        <SummaryCard label="Resolved blockers" value={firstFields(resolvedBlockers)} tone={resolvedBlockers.length ? 'good' : 'neutral'} />
        <SummaryCard label="New blockers" value={firstFields(newBlockers)} tone={newBlockers.length ? 'warn' : 'neutral'} />
      </div>

      <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, background: 'rgba(255,255,255,0.025)' }}>
        <div style={{ color: 'rgba(255,255,255,0.36)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', marginBottom: 6 }}>
          Recommendation
        </div>
        <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12.5, lineHeight: 1.5 }}>
          {textValue(recommendationChange.to)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <SummaryCard label="Changed facts" value={firstFields(changedFacts)} />
        <SummaryCard label="Missing fields removed" value={asArray(missingChange.removed).map(textValue).join(', ') || 'None'} tone={asArray(missingChange.removed).length ? 'good' : 'neutral'} />
        <SummaryCard label="Missing fields added" value={asArray(missingChange.added).map(textValue).join(', ') || 'None'} tone={asArray(missingChange.added).length ? 'warn' : 'neutral'} />
      </div>

      {warnings.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {warnings.slice(0, 4).map((warning, index) => (
            <div key={`${warning}-${index}`} style={{ border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.06)', borderRadius: 8, padding: '8px 10px', color: '#f59e0b', fontSize: 12.2 }}>
              {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
