import type { RunDiff, UnderwritingRun, UnderwritingRunSummary } from '@/types/runs'

export interface ComparableMetric {
  key: string
  label: string
  left: string
  right: string
  changed: boolean
}

export interface ComparedFact extends ComparableMetric {
  source?: string | null
  confidence?: string | null
}

export interface RunComparisonSummary {
  run: UnderwritingRun
  label: string
  runNumber: number
  runType: string
  status: string
  isCurrent: boolean
  completedAt?: string | null
  promotedAt?: string | null
  inputSourceCount: number
  inputDiligenceCount: number
  inputDocumentCount: number
  totalScore: string
  recommendation: string
  valuationGateStatus: string
  valuationGateMessage: string
  metrics: ComparableMetric[]
  blockers: string[]
  warnings: string[]
}

export interface RunComparison {
  left: RunComparisonSummary
  right: RunComparisonSummary
  summaryMetrics: ComparableMetric[]
  financialMetrics: ComparableMetric[]
  oldBlockers: string[]
  rightBlockers: string[]
  resolvedBlockers: string[]
  newBlockers: string[]
  changedFacts: ComparedFact[]
  warnings: {
    left: string[]
    right: string[]
  }
}

const FACT_PATHS = [
  { key: 'revenue', label: 'Revenue', paths: ['extracted.financials.fy25.revenue', 'extracted.key_ratios.revenue_fy25', 'scored.financials.revenue'] },
  { key: 'ebitda', label: 'EBITDA', paths: ['extracted.financials.fy25.ebitda', 'extracted.key_ratios.ebitda_fy25', 'scored.financials.ebitda'] },
  { key: 'asking_price', label: 'Asking price', paths: ['extracted.financials.asking_price', 'extracted.key_ratios.asking_price', 'scored.asking_price'] },
  { key: 'occupancy', label: 'Occupancy', paths: ['extracted.occupancy.current_month_pct', 'extracted.occupancy.latest_week_pct', 'extracted.key_ratios.occupancy_latest_4wk_pct', 'extracted.occupancy.avg_4wk_pct'] },
  { key: 'labour_ratio', label: 'Labour ratio', paths: ['extracted.financials.fy25.labour_ratio_pct', 'extracted.key_ratios.labour_ratio_fy25_pct'] },
  { key: 'rent_ratio', label: 'Rent ratio', paths: ['extracted.financials.fy25.rent_ratio_pct', 'extracted.key_ratios.rent_ratio_fy25_pct'] },
  { key: 'licensed_places', label: 'Licensed places', paths: ['extracted.centre.licensed_places', 'extracted.key_ratios.licensed_places'] },
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readPath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => asRecord(node)[part], root)
}

function firstPresent(root: Record<string, unknown>, paths: string[]): unknown {
  for (const path of paths) {
    const value = readPath(root, path)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function primitive(value: unknown): string | number | boolean | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return null
}

export function normalizeComparableValue(value: unknown): string {
  const raw = primitive(value)
  if (raw === null) return 'Not available'
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return 'Not available'
    return Math.abs(raw) >= 1000 ? raw.toLocaleString('en-AU', { maximumFractionDigits: 1 }) : raw.toLocaleString('en-AU', { maximumFractionDigits: 2 })
  }
  return String(raw)
}

function normalizedKey(value: unknown): string {
  const raw = primitive(value)
  if (raw === null) return ''
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw.toFixed(4) : ''
  return String(raw).trim().toLowerCase()
}

function getScore(run: UnderwritingRun): unknown {
  const scored = asRecord(run.scored)
  const total = scored.total_score
  const overall = scored.overall_score
  if (typeof total === 'number') return total
  if (typeof overall === 'number') return overall <= 10 ? overall * 10 : overall
  return null
}

export function getRunValuationGate(run: UnderwritingRun): { status: string; message: string } {
  const gate = asRecord(asRecord(run.workflow).valuation_gate)
  return {
    status: typeof gate.status === 'string' ? gate.status : 'Not available',
    message: typeof gate.message === 'string' ? gate.message : typeof gate.reason === 'string' ? gate.reason : 'Not available',
  }
}

export function getRunRecommendation(run: UnderwritingRun): string {
  const workflow = asRecord(run.workflow)
  const scored = asRecord(run.scored)
  const guard = asRecord(workflow.narrative_guard)
  const verdict = asRecord(scored.verdict)
  const candidates = [
    guard.recommendation,
    guard.analyst_summary,
    scored.recommendation,
    scored.verdict,
    verdict.one_liner,
    verdict.category,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  return 'Not available'
}

function blockerText(value: unknown): string | null {
  const row = asRecord(value)
  const field = typeof row.field === 'string' ? row.field.replace(/_/g, ' ') : null
  const reason = typeof row.reason === 'string' ? row.reason : typeof row.required_evidence === 'string' ? row.required_evidence : null
  if (field && reason) return `${field}: ${reason}`
  return field ?? reason
}

export function getRunBlockers(run: UnderwritingRun): string[] {
  const gate = asRecord(asRecord(run.workflow).valuation_gate)
  return asArray(gate.blockers).map(blockerText).filter((value): value is string => Boolean(value))
}

function warningStrings(value: unknown): string[] {
  return asArray(value).filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
}

export function getRunWarnings(run: UnderwritingRun): string[] {
  const workflow = asRecord(run.workflow)
  const guard = asRecord(workflow.narrative_guard)
  const market = asRecord(workflow.market_audit)
  const pipeline = asRecord(workflow.pipeline_audit)
  return [
    ...warningStrings(workflow.extraction_warnings).map(warning => warning),
    ...warningStrings(guard.warnings),
    ...warningStrings(market.warnings),
    ...warningStrings(pipeline.warnings),
  ].slice(0, 8)
}

function inputSourceCount(run: UnderwritingRun, summary?: UnderwritingRunSummary | null): number {
  return summary?.input_source_count ?? (Array.isArray(run.input_source_paths) ? run.input_source_paths.length : 0)
}

function inputDiligenceCount(run: UnderwritingRun, summary?: UnderwritingRunSummary | null): number {
  return summary?.input_diligence_document_count ?? (Array.isArray(run.input_diligence_document_ids) ? run.input_diligence_document_ids.length : 0)
}

export function extractRunComparisonSummary(run: UnderwritingRun, summary?: UnderwritingRunSummary | null): RunComparisonSummary {
  const gate = getRunValuationGate(run)
  const sourceCount = inputSourceCount(run, summary)
  const diligenceCount = inputDiligenceCount(run, summary)
  const root = { extracted: run.extracted, scored: run.scored, workflow: run.workflow }
  const metrics = FACT_PATHS.map(field => {
    const value = firstPresent(root, field.paths)
    return {
      key: field.key,
      label: field.label,
      left: normalizeComparableValue(value),
      right: normalizeComparableValue(value),
      changed: false,
    }
  })
  return {
    run,
    label: `Run #${summary?.run_number ?? run.run_number}`,
    runNumber: summary?.run_number ?? run.run_number,
    runType: summary?.run_type ?? run.run_type,
    status: summary?.status ?? run.status,
    isCurrent: summary?.is_current ?? run.is_current,
    completedAt: summary?.completed_at ?? run.completed_at,
    promotedAt: summary?.promoted_at ?? run.promoted_at,
    inputSourceCount: sourceCount,
    inputDiligenceCount: diligenceCount,
    inputDocumentCount: summary?.input_document_count ?? run.input_document_count ?? sourceCount + diligenceCount,
    totalScore: normalizeComparableValue(getScore(run)),
    recommendation: getRunRecommendation(run),
    valuationGateStatus: gate.status,
    valuationGateMessage: gate.message,
    metrics,
    blockers: getRunBlockers(run),
    warnings: getRunWarnings(run),
  }
}

function compareMetric(key: string, label: string, left: unknown, right: unknown): ComparableMetric {
  return {
    key,
    label,
    left: normalizeComparableValue(left),
    right: normalizeComparableValue(right),
    changed: normalizedKey(left) !== normalizedKey(right),
  }
}

function diffBlockers(left: string[], right: string[]): { resolved: string[]; added: string[] } {
  const leftSet = new Set(left.map(item => item.toLowerCase()))
  const rightSet = new Set(right.map(item => item.toLowerCase()))
  return {
    resolved: left.filter(item => !rightSet.has(item.toLowerCase())),
    added: right.filter(item => !leftSet.has(item.toLowerCase())),
  }
}

function changedFactsFromDiff(diff: unknown): ComparedFact[] {
  const typed = asRecord(diff) as RunDiff
  return asArray(typed.changed_facts).map((item, index) => {
    const row = asRecord(item)
    const field = typeof row.field === 'string' ? row.field : `changed_fact_${index}`
    const label = field.replace(/_/g, ' ')
    return {
      key: field,
      label,
      left: normalizeComparableValue(row.from ?? row.old ?? row.old_value ?? row.previous_value),
      right: normalizeComparableValue(row.to ?? row.new ?? row.new_value),
      changed: true,
      source: typeof row.source === 'string' ? row.source : null,
      confidence: typeof row.confidence === 'string' ? row.confidence : null,
    }
  }).filter(fact => fact.left !== 'Not available' || fact.right !== 'Not available')
}

export function compareRunSnapshots(
  leftRun: UnderwritingRun,
  rightRun: UnderwritingRun,
  leftSummary?: UnderwritingRunSummary | null,
  rightSummary?: UnderwritingRunSummary | null,
): RunComparison {
  const leftRoot = { extracted: leftRun.extracted, scored: leftRun.scored, workflow: leftRun.workflow }
  const rightRoot = { extracted: rightRun.extracted, scored: rightRun.scored, workflow: rightRun.workflow }
  const leftGate = getRunValuationGate(leftRun)
  const rightGate = getRunValuationGate(rightRun)
  const leftRecommendation = getRunRecommendation(leftRun)
  const rightRecommendation = getRunRecommendation(rightRun)
  const oldBlockers = getRunBlockers(leftRun)
  const rightBlockers = getRunBlockers(rightRun)
  const blockerChanges = diffBlockers(oldBlockers, rightBlockers)

  const financialMetrics = FACT_PATHS.map(field => compareMetric(
    field.key,
    field.label,
    firstPresent(leftRoot, field.paths),
    firstPresent(rightRoot, field.paths),
  ))

  const storedChangedFacts = rightRun.base_run_id === leftRun.id ? changedFactsFromDiff(rightRun.diff) : []
  const computedChangedFacts = financialMetrics
    .filter(metric => metric.changed)
    .map(metric => ({ ...metric }))

  return {
    left: extractRunComparisonSummary(leftRun, leftSummary),
    right: extractRunComparisonSummary(rightRun, rightSummary),
    summaryMetrics: [
      compareMetric('score', 'Score', getScore(leftRun), getScore(rightRun)),
      compareMetric('recommendation', 'Recommendation', leftRecommendation, rightRecommendation),
      compareMetric('valuation_gate_status', 'Valuation gate', leftGate.status, rightGate.status),
      compareMetric('valuation_gate_message', 'Gate message', leftGate.message, rightGate.message),
    ],
    financialMetrics,
    oldBlockers,
    rightBlockers,
    resolvedBlockers: blockerChanges.resolved,
    newBlockers: blockerChanges.added,
    changedFacts: storedChangedFacts.length ? storedChangedFacts : computedChangedFacts,
    warnings: {
      left: getRunWarnings(leftRun),
      right: getRunWarnings(rightRun),
    },
  }
}
