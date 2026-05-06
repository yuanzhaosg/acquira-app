import type { DiligenceItem } from '@/types/diligence'
import type { DealWorkflow, ValuationBlocker } from '@/types/workflow'
import type { EvidenceRequestPriority, EvidenceRequestSuggestion, EvidenceRequestType } from '@/types/evidenceRequests'

const CLOSED_DILIGENCE_STATUSES = new Set(['received', 'verified', 'waived', 'rejected'])

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function centreLabel(centreName?: string | null): string {
  return centreName?.trim() || 'the centre'
}

function dealSummaryCentreName(workflow?: DealWorkflow | null): string | null {
  const summary = workflow?.deal_summary
  if (!summary) return null
  return asString(summary.centre_name) ?? asString(summary.name) ?? asString(summary.centre)
}

function requiredEvidenceLabel(blocker: ValuationBlocker): string {
  const evidence = asString(blocker.required_evidence)
  if (evidence) return evidence
  const field = blocker.field.replace(/_/g, ' ')
  return `${field} evidence`
}

function blockerLabel(field: string): string {
  const normalized = field.toLowerCase().replace(/[_-]+/g, ' ')
  if (/ebitda/.test(normalized)) return 'EBITDA'
  if (/payroll|labou?r/.test(normalized)) return 'payroll/labour cost'
  if (/occupancy/.test(normalized)) return 'occupancy history'
  if (/revenue/.test(normalized)) return 'revenue'
  return normalized
}

function uniqueLines(lines: string[]): string[] {
  return Array.from(new Set(lines.map(line => line.trim()).filter(Boolean)))
}

function suggestionId(prefix: string, value: string): string {
  return `${prefix}_${value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 56)}`
}

function makeSuggestion(
  id: string,
  request_type: EvidenceRequestType,
  title: string,
  body: string,
  priority: EvidenceRequestPriority,
  source_label: string,
  runId?: string | null,
  diligenceItemId?: string | null,
): EvidenceRequestSuggestion {
  return {
    id,
    request_type,
    title,
    body,
    priority,
    source_label,
    run_id: runId ?? null,
    diligence_item_id: diligenceItemId ?? null,
  }
}

function valuationBlockerSuggestion(
  workflow: DealWorkflow,
  centreName: string,
  runId?: string | null,
): EvidenceRequestSuggestion | null {
  const blockers = workflow.valuation_gate?.blockers ?? []
  if (blockers.length === 0) return null
  const labels = uniqueLines(blockers.map(blocker => blockerLabel(blocker.field)))
  const evidenceLines = uniqueLines(blockers.map(requiredEvidenceLabel))
  const title = `Request valuation evidence for ${centreName}`
  const body = [
    `Hi - to progress underwriting on ${centreName}, could you please provide:`,
    ...evidenceLines.map((line, index) => `${index + 1}. ${line}`),
    'These are needed to clear the current valuation gate and prepare the IC memo.',
  ].join('\n')
  return makeSuggestion(
    'valuation_gate_blockers',
    'valuation_blocker',
    title,
    body,
    'high',
    labels.length ? `Valuation gate: ${labels.join(', ')}` : 'Valuation gate',
    runId,
  )
}

function diligenceSuggestion(item: DiligenceItem, centreName: string, runId?: string | null): EvidenceRequestSuggestion {
  const request = asString(item.request) ?? asString(item.question) ?? 'Please provide the requested diligence evidence.'
  const bodyParts = [
    `Hi - to progress diligence on ${centreName}, could you please provide the following item:`,
    `1. ${request}`,
  ]
  if (item.why_it_matters) {
    bodyParts.push(`This is required because ${item.why_it_matters}`)
  }
  bodyParts.push('Once received, we will add it to the diligence workspace and refresh underwriting if needed.')
  return makeSuggestion(
    suggestionId('diligence', item.id || item.question || request),
    'diligence_item',
    `Request ${item.category || 'diligence'} evidence`,
    bodyParts.join('\n'),
    item.priority,
    `Diligence item: ${item.category || 'general'}`,
    runId,
    item.id,
  )
}

function marketWarnings(workflow?: DealWorkflow | null): string[] {
  const warnings: string[] = []
  warnings.push(...(workflow?.market_audit?.warnings ?? []))
  warnings.push(...(workflow?.market_audit?.competitor_supply?.warnings ?? []))
  if (workflow?.market_audit?.competitor_supply?.material_difference) {
    warnings.push('Competitor supply differs materially from postcode fallback and needs source confirmation.')
  }
  if (workflow?.market_audit?.pipeline_places?.search_required) {
    warnings.push('DA/pipeline search is required to confirm future supply.')
  }
  return uniqueLines(warnings)
}

function pipelineWarnings(workflow?: DealWorkflow | null): string[] {
  const warnings = [...(workflow?.pipeline_audit?.warnings ?? [])]
  if (workflow?.pipeline_audit?.search_required) {
    warnings.push('DA/pipeline search is required for the catchment.')
  }
  return uniqueLines(warnings)
}

function warningSuggestion(
  type: EvidenceRequestType,
  id: string,
  title: string,
  warnings: string[],
  centreName: string,
  runId?: string | null,
): EvidenceRequestSuggestion | null {
  if (warnings.length === 0) return null
  const body = [
    `Hi - to complete market diligence for ${centreName}, could you please help provide source support for:`,
    ...warnings.slice(0, 6).map((warning, index) => `${index + 1}. ${warning}`),
    'Council DA search results, competitor schedules, broker notes, or source links are suitable if available.',
  ].join('\n')
  return makeSuggestion(id, type, title, body, 'medium', title, runId)
}

export function generateEvidenceRequestSuggestions({
  workflow,
  diligenceItems,
  centreName,
  runId,
}: {
  workflow?: DealWorkflow | null
  diligenceItems: DiligenceItem[]
  centreName?: string | null
  runId?: string | null
}): EvidenceRequestSuggestion[] {
  const centre = centreLabel(centreName ?? dealSummaryCentreName(workflow))
  const currentRunId = runId ?? workflow?.run_id ?? null
  const suggestions: EvidenceRequestSuggestion[] = []
  const valuation = workflow ? valuationBlockerSuggestion(workflow, centre, currentRunId) : null
  if (valuation) suggestions.push(valuation)

  for (const item of diligenceItems) {
    if (CLOSED_DILIGENCE_STATUSES.has(item.status)) continue
    if (item.priority !== 'high' && item.status !== 'not_requested' && item.status !== 'requested') continue
    suggestions.push(diligenceSuggestion(item, centre, currentRunId))
  }

  const market = warningSuggestion(
    'market_gap',
    'market_gap_warnings',
    'Request market evidence support',
    marketWarnings(workflow),
    centre,
    currentRunId,
  )
  if (market) suggestions.push(market)

  const pipeline = warningSuggestion(
    'pipeline_gap',
    'pipeline_gap_warnings',
    'Request DA and pipeline evidence',
    pipelineWarnings(workflow),
    centre,
    currentRunId,
  )
  if (pipeline) suggestions.push(pipeline)

  const seen = new Set<string>()
  return suggestions.filter(suggestion => {
    const key = `${suggestion.request_type}:${suggestion.diligence_item_id ?? ''}:${suggestion.title}:${suggestion.body}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
