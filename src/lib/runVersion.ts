import type { RunDiff, UnderwritingRun, UnderwritingRunSummary, UnderwritingRunType } from '@/types/runs'

export interface RunDiffSummary {
  resolvedBlockers: string[]
  newBlockers: string[]
  scoreChange: string | null
  valuationGateChange: string | null
  recommendationChange: string | null
  warnings: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function blockerLabel(value: unknown): string | null {
  const row = asRecord(value)
  return stringValue(row.field)?.replace(/_/g, ' ') ?? stringValue(row.reason)
}

export function formatRunLabel(run?: Pick<UnderwritingRunSummary, 'run_number'> | null): string {
  return run ? `Run #${run.run_number}` : 'Run unavailable'
}

export function formatRunShortId(id?: string | null): string {
  return id ? id.slice(0, 8) : 'unknown'
}

export function formatRunType(type?: UnderwritingRunType | string | null): string {
  if (type === 'reunderwrite') return 'Re-underwrite'
  if (type === 'initial') return 'Initial'
  return 'Unknown'
}

export function formatRunDate(value?: string | null): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRunBytes(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'Size unavailable'
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function summarizeRunDiff(diff?: unknown | null): RunDiffSummary | null {
  const row = asRecord(diff)
  if (!Object.keys(row).length) return null
  const typed = row as RunDiff
  const scoreChange = asRecord(typed.score_change)
  const valuationChange = asRecord(typed.valuation_gate_change)
  const recommendationChange = asRecord(typed.recommendation_change)
  const delta = numberValue(scoreChange.delta)
  const fromScore = numberValue(scoreChange.from)
  const toScore = numberValue(scoreChange.to)
  const valuationFrom = stringValue(valuationChange.from)
  const valuationTo = stringValue(valuationChange.to)
  const recFrom = stringValue(recommendationChange.from)
  const recTo = stringValue(recommendationChange.to)

  return {
    resolvedBlockers: Array.isArray(typed.resolved_blockers)
      ? typed.resolved_blockers.map(blockerLabel).filter((value): value is string => Boolean(value))
      : [],
    newBlockers: Array.isArray(typed.new_blockers)
      ? typed.new_blockers.map(blockerLabel).filter((value): value is string => Boolean(value))
      : [],
    scoreChange: delta != null
      ? `${fromScore != null ? fromScore.toFixed(1) : '?'} -> ${toScore != null ? toScore.toFixed(1) : '?'} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)})`
      : null,
    valuationGateChange: valuationFrom || valuationTo ? `${valuationFrom ?? 'unknown'} -> ${valuationTo ?? 'unknown'}` : null,
    recommendationChange: recFrom || recTo ? `${recFrom ?? 'none'} -> ${recTo ?? 'none'}` : null,
    warnings: Array.isArray(typed.warnings) ? typed.warnings.filter((warning): warning is string => typeof warning === 'string') : [],
  }
}

export function diffFromRun(run?: Pick<UnderwritingRun, 'diff'> | null): RunDiffSummary | null {
  return summarizeRunDiff(run?.diff)
}
