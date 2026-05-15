'use client'

import { useEffect } from 'react'
import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'
import type { UnderwritingRun, UnderwritingRunSummary } from '@/types/runs'
import type { CanonicalEvidenceFact, DealWorkflow, MarketAudit, PipelineAudit, PipelineProject, ValuationGateSummaryRow, WorkflowFact } from '@/types/workflow'
import { investorWarning, supplySourceLabel } from '@/components/report/MarketAuditPanel'
import {
  formatRunBytes,
  formatRunDate,
  formatRunLabel,
  formatRunShortId,
  formatRunType,
  summarizeRunDiff,
} from '@/lib/runVersion'

type ScoredForExport = ScoredDeal & {
  demand_context?: {
    estimated_kids_0_to_4?: number | null
    total_licensed_places?: number | null
    edr_mid?: number | null
    zone?: string | null
    confidence?: string | null
  }
  market_context?: {
    edr_mid?: number | null
    zone?: string | null
    competitor_count?: number | null
    approved_pipeline_places?: number | null
    pipeline_ratio_subject?: number | null
    confidence?: string | null
  }
  pipeline_projects?: PipelineProject[]
  pipeline_audit?: PipelineAudit | null
  next_steps?: {
    deal_structuring_notes?: string | null
    ask_broker_for?: string[]
    due_diligence_priorities?: string[]
  }
}

type DimensionEntry = {
  score?: number | null
  weight?: number | null
  label?: string | null
  summary?: string | null
  data_used?: string[]
}

type RiskItem = {
  key: string
  title: string
  detail: string
  tone: 'risk' | 'missing' | 'request'
  severity?: string
}

type EvidenceRequirement = 'revenue' | 'ebitda' | 'payroll_labour_cost' | 'occupancy_history'
type DisplayFact = WorkflowFact | CanonicalEvidenceFact
const IC_PACK_EXPORT_VERSION = 'IC_PACK_EXPORT_VERSION ledger-v2 / commit 7e5985a'

function money(value: number | null | undefined): string {
  if (value == null) return 'Not provided'
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString('en-AU')}`
}

function pct(value: number | null | undefined): string {
  if (value == null) return 'Not provided'
  return `${value.toLocaleString('en-AU', { maximumFractionDigits: 1 })}%`
}

function factValue(fact: DisplayFact): string {
  if (fact.value == null || fact.value === '') return 'Missing'
  if (fact.unit === 'aud' && typeof fact.value === 'number') return money(fact.value)
  if (fact.unit === 'percent' && typeof fact.value === 'number') return pct(fact.value)
  if (fact.unit === 'places' && typeof fact.value === 'number') return `${fact.value.toLocaleString('en-AU')} places`
  return String(fact.value)
}

function rawFactValue(value: unknown, unit?: string | null): string {
  if (value == null || value === '') return 'Missing'
  if (unit === 'aud' && typeof value === 'number') return money(value)
  if (unit === 'percent' && typeof value === 'number') return pct(value)
  if (unit === 'places' && typeof value === 'number') return `${value.toLocaleString('en-AU')} places`
  if (typeof value === 'number') return value.toLocaleString('en-AU')
  return String(value)
}

function confidenceLabel(fact: DisplayFact): string {
  const source = 'source' in fact ? fact.source?.label ?? fact.source_label ?? 'Source pending' : fact.source_refs?.[0]?.file_name ?? fact.source_type ?? 'Source pending'
  const compactSource = source.split('/').pop()?.replace(/\s+/g, ' ').slice(0, 64) ?? source
  const trust = 'trust' in fact && fact.trust ? String(fact.trust).toUpperCase() : 'confidence' in fact ? fact.confidence.toUpperCase() : 'REVIEW'
  const use = fact.underwriting_use ? ` · ${useLabel(fact.underwriting_use)}` : ''
  return `${trust}${use} · ${compactSource}`
}

function scoreValue(scored: ScoredDeal): number {
  if (typeof scored.total_score === 'number') return scored.total_score
  if (typeof scored.overall_score === 'number') return scored.overall_score * 10
  return 0
}

function decisionLabel(workflow: DealWorkflow | null | undefined, scored: ScoredDeal): string {
  const gate = workflow?.valuation_gate
  const score = scoreValue(scored)
  if (gate?.status === 'blocked') return 'Investigate only with conditions'
  if (gate?.status === 'needs_review' || gate?.can_show_confident_valuation === false) return 'Investigate only with conditions'
  if (score < 42) return 'Pass unless financial evidence is provided'
  if (score < 58) return 'Operator-led turnaround only'
  return 'Proceed to IC review'
}

function hasNumber(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function valuationEvidenceState(extracted: ExtractedDeal, workflow?: DealWorkflow | null): Record<EvidenceRequirement, boolean> {
  const gate = workflow?.valuation_gate
  if (gate?.required_evidence) return gate.required_evidence
  const fy25 = extracted.financials?.fy25
  const ratios = extracted.key_ratios
  const occupancy = extracted.occupancy
  return {
    revenue: hasNumber(fy25?.revenue) || hasNumber(ratios?.revenue_fy25),
    ebitda: hasNumber(fy25?.ebitda) || hasNumber(ratios?.ebitda_fy25),
    payroll_labour_cost: hasNumber(fy25?.total_labour_cost) || hasNumber(fy25?.labour_ratio_pct) || hasNumber(ratios?.labour_ratio_fy25_pct),
    occupancy_history: hasNumber(occupancy?.avg_13wk_pct) || hasNumber(occupancy?.avg_52wk_pct) || hasNumber(occupancy?.fy25_avg_pct) || hasNumber(ratios?.occupancy_fy25_avg_pct),
  }
}

function missingValuationEvidence(extracted: ExtractedDeal, workflow?: DealWorkflow | null): EvidenceRequirement[] {
  const evidence = valuationEvidenceState(extracted, workflow)
  return (Object.entries(evidence) as Array<[EvidenceRequirement, boolean]>)
    .filter(([, present]) => !present)
    .map(([field]) => field)
}

function isValuationBlocked(extracted: ExtractedDeal, workflow?: DealWorkflow | null): boolean {
  return workflow?.valuation_gate?.status === 'blocked' || missingValuationEvidence(extracted, workflow).length > 0
}

function evidenceLabel(field: EvidenceRequirement): string {
  if (field === 'payroll_labour_cost') return 'payroll/labour cost'
  if (field === 'occupancy_history') return 'occupancy history'
  return field.toUpperCase()
}

function investorSafeVerdictLabel(blocked: boolean, workflow: DealWorkflow | null | undefined, scored: ScoredDeal): string {
  if (blocked) return 'Investigate only with conditions'
  return workflow?.narrative_guard?.recommendation ?? decisionLabel(workflow, scored)
}

function investorSafeCoverBody(blocked: boolean, missing: EvidenceRequirement[], fallback?: string | null): string {
  if (!blocked) return fallback ?? 'Proceed subject to evidence review and IC conditions.'
  const missingText = missing.length ? ` Missing: ${missing.map(evidenceLabel).join(', ')}.` : ''
  return `Do not proceed to IC valuation until required financial evidence is provided.${missingText}`
}

function investorSafeValuationCopy(blocked: boolean, missing: EvidenceRequirement[], fallback?: string | null): string {
  if (!blocked) return fallback ?? 'Valuation is based on extracted scoring data.'
  const missingText = missing.length ? ` Required evidence still missing: ${missing.map(evidenceLabel).join(', ')}.` : ''
  return `Valuation blocked — required financial evidence is missing.${missingText}`
}

function isMissingLike(value: unknown): boolean {
  return value == null || value === '' || value === 'Not provided' || value === 'Missing'
}

function hasUsableFact(workflow: DealWorkflow | null | undefined, field: string): boolean {
  const fact = canonicalFact(workflow, field)
  return Boolean(fact && !isMissingLike(fact.value) && fact.underwriting_use !== 'excluded')
}

function askingPriceMissing(workflow: DealWorkflow | null | undefined, extracted: ExtractedDeal): boolean {
  const fact = canonicalFact(workflow, 'asking_price')
  if (fact) return isMissingLike(fact.value) || fact.underwriting_use === 'blocked' || fact.provenance === 'missing'
  return !hasNumber(extracted.financials?.asking_price ?? extracted.key_ratios?.asking_price)
}

function buildCoverNarrative({
  workflow,
  extracted,
}: {
  workflow?: DealWorkflow | null
  extracted: ExtractedDeal
}): { headline: string; body: string; valuationNote: string; decisionDetail: string } {
  const priceMissing = askingPriceMissing(workflow, extracted)
  const revenue = canonicalValue(workflow, 'revenue')
  const profit = canonicalValue(workflow, 'ebitda')
  const normalised = canonicalValue(workflow, 'normalised_ebitda')
  const occupancy = canonicalValue(workflow, 'current_occupancy')
  const hasFinancialEvidence = ['revenue', 'ebitda', 'normalised_ebitda', 'payroll_labour_cost', 'rent'].some(field => hasUsableFact(workflow, field))
  const financialText = hasFinancialEvidence
    ? `Financial evidence is observed${revenue !== 'Not provided' ? `, including ${revenue} revenue` : ''}${profit !== 'Not provided' ? ` and ${profit} reported profit / EBITDA proxy` : ''}${normalised !== 'Not provided' ? `, with ${normalised} normalised profit / EBITDA proxy` : ''}.`
    : 'Financial evidence has not been adequately observed.'
  const body = priceMissing
    ? `Valuation multiple cannot be assessed until asking price is confirmed. ${financialText} Underwriting remains review-required because source verification, payroll reconciliation, occupancy trend, NQS position, and market/DA methodology still need diligence.`
    : `${financialText} Valuation remains review-required until source accounts, payroll definition, occupancy trend, and market/DA methodology are verified.`
  const occupancyText = occupancy !== 'Not provided' ? ` Current occupancy is ${occupancy}; verify trend with source utilisation exports.` : ' Occupancy trend should be verified with source utilisation exports.'
  return {
    headline: priceMissing ? 'Investigate only with conditions — valuation multiple blocked until asking price is confirmed.' : 'Investigate with conditions — valuation depends on source verification.',
    body: `${body}${occupancyText}`,
    valuationNote: priceMissing
      ? 'Illustrative only — valuation multiple blocked pending asking price.'
      : 'Illustrative only — verify source evidence before relying on valuation.',
    decisionDetail: priceMissing
      ? 'Do not submit a binding offer until asking price, source accounts, payroll reconciliation, lease/options, occupancy trend, NQS remediation, and DA/pipeline search are verified. If the recovery thesis drives price, consider deferred consideration or an earnout tied to occupancy or EBITDA recovery.'
      : 'Proceed only with evidence-backed conditions: source P&L verification, payroll reconciliation, lease/options confirmation, NQS remediation plan, occupancy recovery evidence, and DA/pipeline search. Use deferred consideration or an earnout where recovery is central to value.',
  }
}

function compactText(value: string | null | undefined): string | null {
  const compact = value?.replace(/\s+/g, ' ').trim()
  return compact || null
}

function useLabel(value: string | null | undefined): string {
  if (!value) return 'Review required'
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function evidenceQuality(workflow: DealWorkflow | null | undefined, extracted: ExtractedDeal) {
  const reliability = workflow?.evidence_quality?.underwriting_reliability
    ?? (workflow?.valuation_gate?.status === 'blocked' ? 'Blocked' : workflow?.valuation_gate?.status === 'needs_review' ? 'Review required' : 'Review required')
  const extraction = workflow?.evidence_quality?.extraction_completeness ?? extracted.meta?.data_quality ?? 'Not available'
  const quality = workflow?.evidence_quality?.evidence_quality ?? (reliability === 'Accepted' ? 'High' : 'Mixed')
  return { reliability, extraction, quality }
}

function canonicalFact(workflow: DealWorkflow | null | undefined, field: string): CanonicalEvidenceFact | undefined {
  return workflow?.canonical_facts?.[field]
}

function canonicalValue(workflow: DealWorkflow | null | undefined, field: string): string {
  const fact = canonicalFact(workflow, field)
  return fact ? factValue(fact) : 'Not provided'
}

function factNeedsTrustWarning(fact?: DisplayFact): boolean {
  return Boolean(
    fact
      && (
        fact.trust === 'disputed'
        || Boolean(fact.conflicts?.length)
        || fact.underwriting_use === 'review_required'
        || fact.underwriting_use === 'blocked'
        || fact.trust === 'low'
      )
  )
}

function financialFactsNeedReconciliation(workflow: DealWorkflow | null | undefined): boolean {
  return ['revenue', 'ebitda', 'normalised_ebitda', 'payroll_labour_cost']
    .some(field => factNeedsTrustWarning(canonicalFact(workflow, field)))
}

function canonicalRows(workflow: DealWorkflow | null | undefined, facts: WorkflowFact[]): DisplayFact[] {
  const preferred = [
    'revenue',
    'ebitda',
    'normalised_ebitda',
    'payroll_labour_cost',
    'rent',
    'current_occupancy',
    'avg_4wk_occupancy',
    'avg_13wk_occupancy',
    'licensed_places',
    'asking_price',
    'lease_expiry',
  ]
  const rows = preferred
    .map(field => workflow?.canonical_facts?.[field])
    .filter((fact): fact is CanonicalEvidenceFact => Boolean(fact && fact.underwriting_use !== 'excluded'))
  if (rows.length) return rows
  return facts.filter(f => f.confidence !== 'missing' && f.value != null && f.underwriting_use !== 'excluded').slice(0, 14)
}

function isTechnicalText(value: string): boolean {
  return /\b(42703|column .* does not exist|postgres|supabase|rpc|schema cache|PGRST|KeyError|Traceback|Exception|\{.*\})\b/i.test(value)
}

function sanitizeReportText(value: string | null | undefined): string {
  const text = compactText(value) ?? ''
  if (!text) return ''
  if (isTechnicalText(text)) {
    if (/competitor|acecqa|geospatial|service_approval/i.test(text)) {
      return 'Competitor lookup failed due to market-data configuration. Postcode fallback was used; verify competitor methodology before relying on market score.'
    }
    return 'A data provider lookup failed. Review methodology before relying on this section.'
  }
  return text
    .replace(/convert children aged 0-4 into likely long-day-care demand/gi, 'estimate long-day-care participation')
    .replace(/Occupancy & Demand/g, 'Occupancy & Enrolment')
    .replace(/estimated demand ratio/gi, 'EDR capacity screen')
    .replace(/adjusted demand ratio/gi, 'EDR capacity screen')
    .replace(/demand fundamentals/gi, 'market capacity position')
    .replace(/demand conclusions/gi, 'market capacity conclusions')
}

function requestText(item: { question?: string; request?: string }, fallback: string): string {
  const text = sanitizeReportText(item.question || item.request || fallback).replace(/\b[a-z]+(_[a-z0-9]+)+\b/g, match => match.replace(/_/g, ' '))
  if (/resolve conflicting source values/i.test(text)) {
    return 'Reconcile labour cost: confirm FY2025 payroll basis and provide payroll summary or source accounts.'
  }
  if (/occupancy|utilisation/i.test(text) && /4|13|week|history|average/i.test(text)) {
    return 'Upload weekly occupancy/utilisation export if 4-week or 13-week averages are required.'
  }
  if (/lease|assignment/i.test(text)) {
    return 'Upload executed lease, variations/options schedule, and assignment deed if not already source-backed.'
  }
  if (/normalis|add.?back|maintenance/i.test(text)) {
    return 'Upload support for one-off maintenance add-backs and normalisation adjustments.'
  }
  if (/asking price|price guide/i.test(text)) {
    return 'Confirm asking price or price guide.'
  }
  return text
}

function valuationRows(workflow: DealWorkflow | null | undefined, extracted: ExtractedDeal): ValuationGateSummaryRow[] {
  const summaryRows = workflow?.valuation_gate_summary?.rows
  if (summaryRows?.length) return summaryRows
  const evidence = valuationEvidenceState(extracted, workflow)
  return [
    { field: 'revenue', label: 'Revenue', evidence: evidence.revenue ? 'found' : 'missing', underwriting_use: evidence.revenue ? 'review_required' : 'blocked', reason: evidence.revenue ? 'Evidence observed; review source and period before IC reliance.' : 'Revenue evidence not found.' },
    { field: 'ebitda', label: 'EBITDA / operating profit', evidence: evidence.ebitda ? 'found' : 'missing', underwriting_use: evidence.ebitda ? 'review_required' : 'blocked', reason: evidence.ebitda ? 'Evidence observed; review source and period before IC reliance.' : 'EBITDA evidence not found.' },
    { field: 'payroll_labour_cost', label: 'Payroll / labour cost', evidence: evidence.payroll_labour_cost ? 'found' : 'missing', underwriting_use: evidence.payroll_labour_cost ? 'review_required' : 'blocked', reason: evidence.payroll_labour_cost ? 'Evidence observed; reconcile payroll period and source.' : 'Payroll/labour evidence not found.' },
    { field: 'occupancy_history', label: 'Occupancy history', evidence: evidence.occupancy_history ? 'found' : 'missing', underwriting_use: evidence.occupancy_history ? 'review_required' : 'blocked', reason: evidence.occupancy_history ? 'Occupancy evidence observed; verify observation window.' : 'Occupancy history not found or insufficient.' },
  ]
}

function formatDimensionKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function componentScoreRows(scored: ScoredDeal, workflow?: DealWorkflow | null): Array<{ id: string; label: string; score: string; summary: string }> {
  const hasCanonicalFinancials = Boolean(workflow?.canonical_facts?.revenue || workflow?.canonical_facts?.payroll_labour_cost || workflow?.canonical_facts?.ebitda)
  return Object.entries(scored.dimensions ?? {})
    .map(([id, dimension]) => {
      const entry = dimension as DimensionEntry
      const rawSummary = compactText(entry.summary) ?? 'No component explanation available.'
      const suppressLegacyFinancialNarrative = hasCanonicalFinancials
        && /(profit|financial|cashflow|cash_flow|valuation|payroll|labou?r|occupancy|market|capacity)/i.test(id)
        && /\$|revenue|payroll|labou?r|ebitda|occupancy|utilisation|margin|grew|increased|decreased/i.test(rawSummary)
      return {
        id,
        label: compactText(entry.label) ?? formatDimensionKey(id),
        score: typeof entry.score === 'number' ? `${entry.score.toFixed(1)}/10` : 'Not scored',
        summary: suppressLegacyFinancialNarrative
          ? 'Refer to canonical underwriting facts, conflicts, and valuation gate above.'
          : rawSummary,
      }
    })
    .filter(row => row.label || row.summary)
}

function riskItem(key: string, title: string | null | undefined, detail: string | null | undefined, tone: RiskItem['tone'] = 'risk', severity?: string): RiskItem | null {
  const cleanTitle = compactText(title)
  const cleanDetail = compactText(detail)
  if (!cleanTitle && !cleanDetail) return null
  return {
    key,
    title: cleanTitle ?? 'Underwriting warning',
    detail: cleanDetail ?? 'Review before IC reliance.',
    tone,
    severity,
  }
}

function uniqueRiskItems(items: Array<RiskItem | null>): RiskItem[] {
  const seen = new Set<string>()
  const output: RiskItem[] = []
  for (const item of items) {
    if (!item) continue
    const signature = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (seen.has(signature)) continue
    seen.add(signature)
    output.push(item)
  }
  return output
}

function conflictTitle(fact: DisplayFact): string {
  const label = fact.label || fact.field || 'Fact'
  if (/payroll|labou?r/i.test(label)) return 'Labour cost conflict'
  if (/rent/i.test(label)) return 'Rent conflict'
  if (/occupancy|utilisation/i.test(label)) return 'Occupancy source conflict'
  if (/revenue/i.test(label)) return 'Revenue source conflict'
  return `${label} conflict`
}

function conflictDetail(fact: DisplayFact, conflict: NonNullable<DisplayFact['conflicts']>[number]): string {
  const selected = factValue(fact)
  const alternate = rawFactValue(conflict.value, fact.unit)
  if (/payroll|labou?r/i.test(fact.label || fact.field || '')) {
    return `One source indicates ${selected}; another indicates ${alternate}. Reconcile payroll definition and source accounts before relying on labour ratio.`
  }
  return `Selected evidence indicates ${selected}; alternate evidence indicates ${alternate}. ${sanitizeReportText(conflict.reason ?? 'Resolve source period and authority before relying on this value.')}`
}

function buildRiskItems({
  extracted,
  scored,
  workflow,
  marketAudit,
  pipelineAudit,
}: {
  extracted: ExtractedDeal
  scored: ScoredDeal
  workflow?: DealWorkflow | null
  marketAudit?: MarketAudit | null
  pipelineAudit?: PipelineAudit | null
}): RiskItem[] {
  const triggeredFlags = scored.deal_breaker_flags?.flags?.filter(flag => flag.triggered) ?? []
  const legacyFlags = scored.hard_flags_triggered ?? []
  const hardFlags = extracted.hard_flags ?? []
  const supply = marketAudit?.competitor_supply

  return uniqueRiskItems([
    ...(workflow?.risks ?? []).map(risk => riskItem(
      `workflow-${risk.id}`,
      risk.title,
      risk.reason ?? risk.severity,
      'risk',
    )),
    ...triggeredFlags.map(flag => riskItem(
      `scored-${flag.id}`,
      flag.label,
      [flag.severity?.toUpperCase(), flag.reason].filter(Boolean).join(' · '),
      flag.severity === 'critical' ? 'risk' : 'missing',
    )),
    ...legacyFlags.map((flag, index) => riskItem(
      `legacy-${flag}-${index}`,
      flag.replace(/_/g, ' '),
      'Legacy score flag triggered.',
      'risk',
    )),
    ...hardFlags.map(flag => riskItem(
      `hard-${flag.id}`,
      flag.description,
      [flag.severity, flag.dimension].filter(Boolean).join(' · '),
      'risk',
    )),
    ...(workflow?.narrative_guard?.warnings ?? []).map((warning, index) => riskItem(
      `guard-${index}`,
      'Narrative consistency warning',
      warning,
      'missing',
    )),
    ...(workflow?.extraction_warnings ?? []).map(warning => riskItem(
      `extraction-${warning.id}`,
      warning.field ? `Extraction warning: ${warning.field.replace(/_/g, ' ')}` : 'Extraction warning',
      [warning.severity?.toUpperCase(), warning.message].filter(Boolean).join(' · '),
      warning.severity === 'critical' || warning.severity === 'high' ? 'risk' : 'missing',
    )),
    ...(marketAudit?.warnings ?? []).map((warning, index) => riskItem(
      `market-${index}`,
      'Market audit warning',
      investorWarning(warning),
      'missing',
    )),
    ...(supply?.warnings ?? []).map((warning, index) => riskItem(
      `supply-${index}`,
      'Competitor supply warning',
      investorWarning(warning),
      'missing',
    )),
    supply?.material_difference
      ? riskItem(
          'supply-material-difference',
          'Competitor supply mismatch',
          'Geospatial competitor supply differs materially from postcode comparison; verify catchment methodology before relying on market capacity conclusions.',
          'risk',
        )
      : null,
    ...(pipelineAudit?.warnings ?? []).map((warning, index) => riskItem(
      `pipeline-${index}`,
      'Pipeline warning',
      investorWarning(warning),
      'missing',
    )),
  ])
}

function ScoringBreakdown({
  extracted,
  scored,
  workflow,
}: {
  extracted: ExtractedDeal
  scored: ScoredDeal
  workflow?: DealWorkflow | null
}) {
  const rows = componentScoreRows(scored, workflow)
  const blocked = isValuationBlocked(extracted, workflow)
  const triggeredFlags = scored.deal_breaker_flags?.flags?.filter(flag => flag.triggered) ?? []
  const criticalFlags = triggeredFlags.filter(flag => flag.severity === 'critical')
  const hardFlags = extracted.hard_flags ?? []
  const guard = workflow?.narrative_guard
  const quality = evidenceQuality(workflow, extracted)
  const explanation = compactText(guard?.analyst_summary)
    ?? compactText(scored.analyst_summary)
    ?? compactText(scored.verdict?.one_liner)
    ?? compactText(scored.dimensions?.profitability_cashflow?.summary)
    ?? compactText(scored.dimensions?.occupancy_demand?.summary)
    ?? 'Score explanation unavailable.'

  return (
    <>
      <div className="ic-pack-grid-4">
        <KeyValue label="Overall score" value={`${Math.round(scoreValue(scored))}/100`} />
        <KeyValue
          label="Verdict / category"
          value={blocked ? 'Valuation multiple blocked pending asking price' : workflow?.narrative_guard?.recommendation ?? scored.verdict?.category?.replace(/_/g, ' ') ?? scored.overall_verdict ?? 'Not available'}
          note={blocked ? 'Financial evidence may be observed; verify source accounts, payroll, occupancy, and price before reliance.' : scored.verdict?.one_liner ?? undefined}
        />
        <KeyValue
          label="Red flags"
          value={`${triggeredFlags.length + hardFlags.length}`}
          note={criticalFlags.length ? `${criticalFlags.length} critical flag${criticalFlags.length === 1 ? '' : 's'}` : 'No critical scored flags'}
        />
        <KeyValue
          label="Extraction completeness"
          value={quality.extraction}
          note={scored.scoring_version ? `Scoring version ${scored.scoring_version}` : scored.audit_trail?.confidence_note ?? undefined}
        />
        <KeyValue
          label="Underwriting reliability"
          value={quality.reliability}
          note={workflow?.evidence_quality?.reason ?? undefined}
        />
      </div>
      <div className="ic-pack-alert">
        <strong>What drove the score</strong>
        <p>{explanation}</p>
      </div>
      {rows.length ? (
        <div className="ic-pack-table">
          <div className="ic-pack-table-head">
            <span>Component</span>
            <span>Score</span>
            <span>Driver</span>
          </div>
          {rows.slice(0, 6).map(row => (
            <div key={row.id} className="ic-pack-table-row">
              <span>{row.label}</span>
              <strong>{row.score}</strong>
              <span>{row.summary}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="ic-pack-muted">Detailed scoring breakdown unavailable.</p>
      )}
    </>
  )
}

function ExportSection({
  number,
  title,
  children,
  breakBefore = false,
}: {
  number: string
  title: string
  children: React.ReactNode
  breakBefore?: boolean
}) {
  return (
    <section className={`ic-pack-section ic-pack-section-${number}${breakBefore ? ' ic-pack-section-break' : ''}`}>
      <div className="ic-pack-section-kicker">{number}</div>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function KeyValue({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="ic-pack-kv">
      <div className="ic-pack-kv-label">{label}</div>
      <div className="ic-pack-kv-value">{value}</div>
      {note && <div className="ic-pack-kv-note">{note}</div>}
    </div>
  )
}

function FactRows({ facts }: { facts: DisplayFact[] }) {
  if (!facts.length) return <p className="ic-pack-muted">No source-backed workflow facts available.</p>
  return (
    <div className="ic-pack-table">
      <div className="ic-pack-table-head">
        <span>Fact</span>
        <span>Value</span>
        <span>Source / Confidence</span>
      </div>
      {facts.map((fact, index) => (
        <div key={'id' in fact ? fact.id : fact.fact_id ?? `${fact.field}-${index}`} className={('blocker' in fact && fact.blocker) || ('confidence' in fact && fact.confidence === 'missing') || fact.underwriting_use === 'blocked' || fact.trust === 'disputed' ? 'ic-pack-table-row ic-pack-row-warning' : 'ic-pack-table-row'}>
          <span>{fact.label}</span>
          <strong>{factValue(fact)}</strong>
          <span>{confidenceLabel(fact)}</span>
        </div>
      ))}
    </div>
  )
}

function AuditRows({ audit }: { audit?: MarketAudit | null }) {
  if (!audit) return null
  const supply = audit.competitor_supply
  const combinedWarnings = Array.from(new Set([
    ...(audit.warnings ?? []).map(sanitizeReportText),
    ...(supply?.warnings ?? []).map(sanitizeReportText),
  ])).filter(Boolean)
  const supplyUnavailable = supply?.source === 'unavailable' || (supply?.confidence === 'low' && supply?.competitor_count == null && Boolean(supply?.compared_to_postcode))
  const postcodeCompetitors = supply?.compared_to_postcode?.competitor_count
  const postcodePlaces = supply?.compared_to_postcode?.total_licensed_places
  return (
    <>
      <div className="ic-pack-grid-4">
        <KeyValue label="Catchment radius" value={audit.catchment_radius_km != null ? `${audit.catchment_radius_km}km` : 'Not available'} note={audit.radius_reason ?? undefined} />
        <KeyValue
          label="Kids 0-4"
          value={audit.kids_0_4?.value != null ? audit.kids_0_4.value.toLocaleString('en-AU') : 'Not available'}
          note={[audit.kids_0_4?.source, audit.kids_0_4?.confidence ? `${audit.kids_0_4.confidence} confidence` : null].filter(Boolean).join(' · ')}
        />
        <KeyValue
          label="LDC utilisation"
          value={audit.ldc_utilisation_rate?.value != null ? `${Math.round(audit.ldc_utilisation_rate.value * 100)}%` : 'Not available'}
          note={audit.ldc_utilisation_rate?.rationale ?? audit.ldc_utilisation_rate?.source ?? undefined}
        />
        <KeyValue label="Licensed places" value={audit.licensed_places?.value != null ? audit.licensed_places.value.toLocaleString('en-AU') : 'Not available'} note={audit.licensed_places?.source ?? undefined} />
        <KeyValue label="Market method" value={supplyUnavailable ? 'Postcode fallback' : supplySourceLabel(supply?.scoring_source ?? supply?.source ?? 'unavailable')} note={supplyUnavailable ? 'Geospatial competitor supply unavailable.' : audit.competitor_count?.source ?? undefined} />
        <KeyValue label="Competitors" value={supplyUnavailable && postcodeCompetitors != null ? `${postcodeCompetitors.toLocaleString('en-AU')} postcode fallback` : audit.competitor_count?.value != null ? audit.competitor_count.value.toLocaleString('en-AU') : 'Not available'} note={supplyUnavailable ? 'Review catchment before relying on score.' : audit.competitor_count?.source ?? undefined} />
        <KeyValue
          label="Pipeline places"
          value={audit.pipeline_places?.value != null ? audit.pipeline_places.value.toLocaleString('en-AU') : 'Not available'}
          note={[audit.pipeline_places?.source, audit.pipeline_places?.confidence ? `${audit.pipeline_places.confidence} confidence` : null].filter(Boolean).join(' · ')}
        />
        <KeyValue label="EDR capacity screen" value={audit.edr?.value != null ? String(audit.edr.value) : 'Not available'} note={audit.edr?.interpretation ?? undefined} />
        <KeyValue label="EDR formula" value="Children x utilisation / places" note={audit.edr?.formula ?? undefined} />
      </div>
      {supply && (
        <>
          <div className="ic-pack-grid-4">
            <KeyValue
              label="Geospatial competitor supply"
              value={supplyUnavailable ? 'Unavailable' : supplySourceLabel(supply.source)}
              note={supplyUnavailable ? 'Postcode fallback used for scoring.' : supply.confidence ? `${supply.confidence} confidence` : undefined}
            />
            <KeyValue
              label="Scoring source"
              value={supplySourceLabel(supply.scoring_source ?? supply.source)}
              note={supply.scoring_confidence ? `${supply.scoring_confidence} confidence` : undefined}
            />
            <KeyValue label="Supply radius" value={supply.radius_km != null ? `${supply.radius_km}km` : 'Not available'} />
            <KeyValue label="Geocode method" value={supply.target_geocode_method ? supply.target_geocode_method.replace(/_/g, ' ') : 'Not available'} />
            <KeyValue label="Exclusion method" value={supply.exclusion_method ? supply.exclusion_method.replace(/_/g, ' ') : 'Not available'} />
            <KeyValue
              label="Geospatial supply result"
              value={supplyUnavailable ? 'Not available' : [
                supply.competitor_count != null ? `${supply.competitor_count.toLocaleString('en-AU')} centres` : null,
                supply.total_licensed_places != null ? `${supply.total_licensed_places.toLocaleString('en-AU')} places` : null,
              ].filter(Boolean).join(' / ') || 'Not available'}
              note={supplyUnavailable ? 'Geospatial competitor supply failed; postcode fallback retained.' : supply.confidence ? `${supply.confidence} confidence` : undefined}
            />
            <KeyValue
              label="Postcode fallback competitors"
              value={[
                postcodeCompetitors != null ? `${postcodeCompetitors.toLocaleString('en-AU')} centres` : null,
                postcodePlaces != null ? `${postcodePlaces.toLocaleString('en-AU')} places` : null,
              ].filter(Boolean).join(' / ') || 'Not available'}
              note={supply.compared_to_postcode?.edr != null ? `Postcode EDR ${supply.compared_to_postcode.edr}` : undefined}
            />
          </div>
          {supplyUnavailable && (
            <div className="ic-pack-alert">
              <strong>Market method summary</strong>
              <p>Geospatial competitor supply was unavailable. Postcode fallback was used for market scoring; verify catchment, competitor list, and DA pipeline before relying on the market score.</p>
            </div>
          )}
          {supply.material_difference && (
            <div className="ic-pack-list" style={{ marginBottom: '4mm' }}>
              <div className="ic-pack-list-item ic-pack-missing">
                <strong>Competitor supply mismatch</strong>
                <span>Supply differs materially from postcode comparison — verify catchment methodology.</span>
              </div>
            </div>
          )}
        </>
      )}
      {combinedWarnings.length > 0 && (
        <div className="ic-pack-list">
          {combinedWarnings.slice(0, 5).map((warning, index) => (
            <div key={`${warning}-${index}`} className="ic-pack-list-item ic-pack-missing">
              <strong>Market / supply warning</strong>
              <span>{investorWarning(warning)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function EvidenceReadinessRows({ workflow }: { workflow?: DealWorkflow | null }) {
  const readiness = workflow?.evidence_readiness
  if (!readiness) return <p className="ic-pack-muted">Evidence readiness ledger unavailable for this report.</p>
  const identityFields = new Set(['centre_name', 'trading_name', 'address', 'suburb', 'postcode', 'state', 'licensed_places'])
  const seen = new Set<string>()
  const itemKey = (item: { field?: string; label?: string }) => item.field || item.label || ''
  const normalizeItem = (item: NonNullable<typeof readiness[keyof typeof readiness]>[number]) => {
    const field = item.field ?? ''
    if (identityFields.has(field) && item.provenance !== 'missing' && item.trust !== 'disputed') {
      return { ...item, underwriting_use: 'accepted', trust: item.trust === 'low' ? 'medium' : item.trust }
    }
    if (field === 'asking_price' && (item.provenance === 'missing' || item.underwriting_use === 'excluded' || isMissingLike(item.value))) {
      return { ...item, underwriting_use: 'blocked', provenance: 'missing', trust: 'unknown', reason: item.reason ?? 'Asking price or price guide has not been confirmed.' }
    }
    return item
  }
  const allItems = Object.values(readiness).flat().map(normalizeItem)
  const itemsFor = (group: string) => allItems.filter(item => {
    const key = itemKey(item)
    if (!key) return false
    if (/fy\d{2,4}.*occupancy|52.*occupancy|avg_52wk|fy\d+_avg/i.test(key)) {
      if (seen.has('occupancy-fy-unavailable')) return false
      if (group !== 'blocked') return false
      seen.add('occupancy-fy-unavailable')
      return true
    }
    const use = item.underwriting_use
    const provenance = item.provenance
    const target =
      group === 'accepted' ? use === 'accepted'
      : group === 'review_required' ? use === 'review_required'
      : group === 'disputed' ? item.trust === 'disputed'
      : group === 'blocked_missing' ? use === 'blocked' || provenance === 'missing'
      : group === 'excluded' ? use === 'excluded' && provenance !== 'missing'
      : group === 'manual_context' ? provenance === 'manual_context'
      : false
    if (!target) return false
    const dedupe = `${group}:${key}`
    if (seen.has(dedupe)) return false
    seen.add(dedupe)
    return true
  })
  const groups = [
    ['accepted', 'Accepted'],
    ['review_required', 'Review required'],
    ['disputed', 'Disputed'],
    ['blocked_missing', 'Blocked / Missing'],
    ['excluded', 'Excluded from underwriting'],
    ['manual_context', 'Manual context'],
  ] as const
  return (
    <div className="ic-pack-list">
      {groups.map(([key, label]) => {
        const items = itemsFor(key)
        if (!items.length) return null
        return (
          <div key={key} className={`ic-pack-list-item ${key === 'accepted' ? 'ic-pack-request' : key === 'disputed' || key === 'blocked_missing' ? 'ic-pack-missing' : 'ic-pack-risk'}`}>
            <strong>{label}</strong>
            <span>{items.slice(0, 6).map(item => {
              const label = item.label || item.field
              if (/4.*week|13.*week/i.test(label ?? '') && item.provenance === 'missing') return `${label}: weekly export not supplied`
              if (/occupancy/i.test(label ?? '') && item.provenance === 'missing') return `${label}: not available from supplied monthly IM data`
              if (item.reason) return `${label}: ${sanitizeReportText(item.reason)}`
              return label
            }).filter(Boolean).join('; ')}</span>
          </div>
        )
      })}
    </div>
  )
}

function ValuationGateRows({ rows }: { rows: ValuationGateSummaryRow[] }) {
  return (
    <div className="ic-pack-table">
      <div className="ic-pack-table-head">
        <span>Input</span>
        <span>Status</span>
        <span>Evidence / reason</span>
      </div>
      {rows.map(row => (
        <div key={row.field} className={row.underwriting_use === 'accepted' ? 'ic-pack-table-row' : 'ic-pack-table-row ic-pack-row-warning'}>
          <span>{row.label}</span>
          <strong>{useLabel(row.underwriting_use)}</strong>
          <span>
            {row.evidence === 'found' ? 'Evidence found' : 'Evidence missing'}
            {row.reason ? ` · ${sanitizeReportText(row.reason)}` : ''}
            {row.next_action ? ` · Next: ${sanitizeReportText(row.next_action)}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

function uniqueTexts(items: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const item of items.map(sanitizeReportText).map(text => text.trim()).filter(Boolean)) {
    const key = item.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(item)
  }
  return output
}

function recommendationChangeItems({
  workflow,
  extracted,
}: {
  workflow?: DealWorkflow | null
  extracted: ExtractedDeal
}): Array<{ title: string; detail: string }> {
  const items = [
    askingPriceMissing(workflow, extracted) ? { title: 'Confirm asking price or price guide', detail: 'Valuation multiple, price per place, and yield cannot be assessed without price.' } : null,
    { title: 'Verify FY2025 financials against source accounts', detail: 'IM/vendor-prepared financials are useful evidence, but source P&L or management accounts should verify revenue and profit.' },
    { title: 'Resolve payroll conflict and labour cost definition', detail: 'Confirm whether labour cost should use wages plus super, total payroll, leave accrual, agency/casual labour, or another FY2025 basis.' },
    { title: 'Provide weekly occupancy/utilisation export', detail: 'Monthly occupancy history is useful, but weekly data is needed for 4-week and 13-week trend underwriting.' },
    { title: 'Confirm NQS remediation plan and timing', detail: 'Working Towards NQS should be diligenced for remediation cost, timing, and operational impact.' },
    { title: 'Complete DA and competitor pipeline search', detail: 'Market conclusions remain review-required until catchment and pipeline methodology are verified.' },
  ].filter(Boolean) as Array<{ title: string; detail: string }>
  return items
}

function uncertaintyItems({
  workflow,
  extracted,
}: {
  workflow?: DealWorkflow | null
  extracted: ExtractedDeal
}): string[] {
  return uniqueTexts([
    askingPriceMissing(workflow, extracted) ? 'We do not know the asking price or price guide.' : '',
    'We do not know whether vendor-indicated add-backs are acceptable without source-account support.',
    'We do not know whether pipeline or waitlist opportunities convert into actual enrolments.',
    'We do not know whether NQS issues are easily remediated, or whether remediation affects occupancy recovery.',
    'We do not know whether DA/pipeline risk is material until market methodology is verified.',
  ])
}

function brokerRequestItems({
  requests,
  fallbackRequests,
  workflow,
  extracted,
}: {
  requests: Array<{ id: string; question?: string; request?: string; priority: string; category: string }>
  fallbackRequests: string[]
  workflow?: DealWorkflow | null
  extracted: ExtractedDeal
}): Array<{ id: string; text: string; meta: string }> {
  const base = [
    askingPriceMissing(workflow, extracted) ? 'Confirm asking price or price guide.' : '',
    'Upload source FY2025 P&L / management accounts to verify IM financial summary.',
    'Upload payroll report matching FY2025 period, including wages, super, leave accrual, and casual/agency labour if applicable.',
    'Upload weekly occupancy/utilisation export if 4-week/13-week averages are required.',
    'Upload NQS remediation plan and any correspondence about Working Towards items.',
    'Complete or upload DA pipeline search and known competitor/pipeline intelligence.',
    'Upload executed lease, variations/options schedule, and assignment deed if not already source-backed.',
    ...requests.map(item => requestText(item, 'Upload supporting diligence evidence.')),
    ...fallbackRequests,
  ]
  return uniqueTexts(base).slice(0, 10).map((text, index) => ({ id: `request-${index}`, text, meta: index < 7 ? 'IC diligence request' : 'Generated from workflow request' }))
}

function thesisItems({ workflow, extracted, scored }: { workflow?: DealWorkflow | null; extracted: ExtractedDeal; scored: ScoredDeal }): string[] {
  const revenue = canonicalValue(workflow, 'revenue')
  const profit = canonicalValue(workflow, 'ebitda')
  const normalised = canonicalValue(workflow, 'normalised_ebitda')
  const rent = canonicalValue(workflow, 'rent')
  const currentOccupancy = canonicalValue(workflow, 'current_occupancy')
  const occupancyPeak = extracted.occupancy?.peak_pct != null ? pct(extracted.occupancy.peak_pct) : null
  const pipelineText = /pipeline|waitlist|opportunit/i.test(JSON.stringify(scored)) ? 'Pipeline or waitlist opportunities may support occupancy recovery, subject to conversion evidence.' : ''
  const financialReconciliationRequired = financialFactsNeedReconciliation(workflow)
  return uniqueTexts([
    financialReconciliationRequired
      ? 'Reported profitability may be attractive, but financial evidence is disputed or review-required and must be reconciled before relying on valuation or offer assumptions.'
      : revenue !== 'Not provided' || profit !== 'Not provided'
      ? `Reported profitability is meaningful${revenue !== 'Not provided' ? `, with ${revenue} revenue` : ''}${profit !== 'Not provided' ? ` and ${profit} reported profit / EBITDA proxy` : ''}.`
      : scored.dimensions?.profitability_cashflow?.summary ?? '',
    !financialReconciliationRequired && normalised !== 'Not provided' ? `Vendor-indicated normalised profit / EBITDA proxy is ${normalised}, subject to add-back verification.` : '',
    rent !== 'Not provided' ? `Rent economics appear attractive at ${rent}, subject to lease and rent ledger verification.` : '',
    currentOccupancy !== 'Not provided' ? `Occupancy upside may exist if the centre can improve from ${currentOccupancy}${occupancyPeak ? ` toward prior peak of ${occupancyPeak}` : ''}.` : '',
    pipelineText,
    sanitizeReportText(scored.dimensions?.market_position?.summary ?? scored.dimensions?.occupancy_demand?.summary ?? ''),
  ]).slice(0, 6)
}

function PipelineRows({ audit, projects }: { audit?: PipelineAudit | null; projects?: PipelineProject[] }) {
  if (!audit && !(projects?.length)) return null
  return (
    <>
      <div className="ic-pack-grid-4">
        <KeyValue label="DA source status" value={audit?.source_type?.replace(/_/g, ' ') ?? 'Not provided'} note={audit?.search_required ? 'DA search required' : audit?.searched ? 'Manual source provided' : undefined} />
        <KeyValue label="Approved places" value={audit?.approved_places != null ? audit.approved_places.toLocaleString('en-AU') : 'Not available'} />
        <KeyValue label="Lodged places" value={audit?.lodged_places != null ? audit.lodged_places.toLocaleString('en-AU') : 'Not available'} />
        <KeyValue label="Risk-adjusted places" value={audit?.risk_adjusted_places != null ? audit.risk_adjusted_places.toLocaleString('en-AU') : 'Not available'} note={audit?.lodged_weight != null ? `Lodged weighted at ${Math.round(audit.lodged_weight * 100)}%` : undefined} />
      </div>
      {(audit?.warnings?.length ?? 0) > 0 && (
        <div className="ic-pack-list">
          {(audit?.warnings ?? []).slice(0, 5).map((warning, index) => (
            <div key={`${warning}-${index}`} className="ic-pack-list-item ic-pack-missing">
              <strong>Pipeline warning</strong>
              <span>{investorWarning(warning)}</span>
            </div>
          ))}
        </div>
      )}
      {projects?.length ? (
        <div className="ic-pack-table">
          <div className="ic-pack-table-head">
            <span>Project</span>
            <span>Status</span>
            <span>Places / source</span>
          </div>
          {projects.map((project, index) => (
            <div key={project.id ?? `${project.status}-${project.name ?? project.address ?? index}`} className="ic-pack-table-row">
              <span>{project.name || project.address || 'Pipeline project'}</span>
              <strong>{project.status.replace(/_/g, ' ')}</strong>
              <span>
                {project.proposed_places != null ? `${project.proposed_places.toLocaleString('en-AU')} places` : 'Places unknown'}
                {project.confidence ? ` · ${project.confidence} confidence` : ''}
                {project.source_url ? ` · source URL provided` : project.source_file ? ` · ${project.source_file}` : project.source_type ? ` · ${project.source_type.replace(/_/g, ' ')}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}

export default function ICPackExport({
  extracted,
  scored,
  workflow,
  currentRun,
  currentRunSnapshot,
  staleDocumentCount = 0,
  mode = 'current',
  currentRunLabel,
  isSavedDeal = false,
  runMetadataLoaded = true,
}: {
  extracted: ExtractedDeal
  scored: ScoredDeal
  workflow?: DealWorkflow | null
  currentRun?: UnderwritingRunSummary | null
  currentRunSnapshot?: UnderwritingRun | null
  staleDocumentCount?: number
  mode?: 'current' | 'historical'
  currentRunLabel?: string | null
  isSavedDeal?: boolean
  runMetadataLoaded?: boolean
}) {
  const scoredExport = scored as ScoredForExport
  const centre = extracted.centre
  const financials = extracted.financials
  const ratios = extracted.key_ratios
  const occupancy = extracted.occupancy
  const lease = extracted.lease
  const sourceFiles = extracted.meta?.source_files ?? []
  const gate = workflow?.valuation_gate
  const facts = workflow?.facts ?? workflow?.extracted_facts ?? []
  const quality = evidenceQuality(workflow, extracted)
  const exportFacts = canonicalRows(workflow, facts)
  const valuationSummaryRows = valuationRows(workflow, extracted)
  const requests = workflow?.diligence_checklist ?? workflow?.diligence_requests ?? []
  const market = scoredExport.market_context ?? scoredExport.demand_context
  const marketAudit = workflow?.market_audit ?? scored.market_audit
  const pipelineAudit = workflow?.pipeline_audit ?? scoredExport.pipeline_audit
  const pipelineProjects = workflow?.pipeline_projects ?? scoredExport.pipeline_projects
  const guard = workflow?.narrative_guard
  const missingRequiredEvidence = missingValuationEvidence(extracted, workflow)
  const valuationBlocked = isValuationBlocked(extracted, workflow)
  const isIllustrative = valuationBlocked || (gate ? !gate.can_show_confident_valuation : false)
  const coverNarrative = buildCoverNarrative({ workflow, extracted })
  const blockedMessage = coverNarrative.headline
  const decision = investorSafeVerdictLabel(valuationBlocked, workflow, scored)
  const guardedSummary = valuationBlocked
    ? coverNarrative.body
    : guard?.analyst_summary ?? scored.analyst_summary
  const guardedValuationNote = valuationBlocked ? coverNarrative.valuationNote : investorSafeValuationCopy(false, missingRequiredEvidence, guard?.valuation_note ?? gate?.message)
  const fallbackRequests = [
    ...(scoredExport.next_steps?.ask_broker_for ?? []),
    ...(scoredExport.next_steps?.due_diligence_priorities ?? []),
  ]
  const recommendationItems = recommendationChangeItems({ workflow, extracted })
  const uncertaintyList = uncertaintyItems({ workflow, extracted })
  const brokerRequests = brokerRequestItems({ requests, fallbackRequests, workflow, extracted })
  const thesisList = thesisItems({ workflow, extracted, scored })
  const runDiff = summarizeRunDiff(currentRunSnapshot?.diff)
  const riskItems = buildRiskItems({ extracted, scored, workflow, marketAudit, pipelineAudit })
  const inputSourceCount = currentRun?.input_source_count ?? 0
  const inputDiligenceCount = currentRun?.input_diligence_document_count ?? 0
  const inputDocumentCount = currentRun?.input_document_count ?? inputSourceCount + inputDiligenceCount
  const exportGeneratedAt = new Date().toLocaleString('en-AU')
  const historicalMode = mode === 'historical'
  const isRunCurrent = Boolean(currentRun?.is_current)
  const metadataFallbackLabel = !isSavedDeal
    ? 'Unsaved report snapshot'
    : !runMetadataLoaded
    ? 'Run metadata loading'
    : 'Legacy report'
  const metadataFallbackBody = !isSavedDeal
    ? 'Save this deal to create immutable underwriting run metadata.'
    : !runMetadataLoaded
    ? 'Run metadata is still loading; regenerate the export after the report finishes loading.'
    : 'Legacy report — underwriting run metadata unavailable.'

  const fallbackFactRows: WorkflowFact[] = facts.length || exportFacts.length ? [] : [
    {
      id: 'fallback-occupancy',
      field: 'occupancy',
      category: 'occupancy',
      label: 'Current occupancy / utilisation',
      value: occupancy.current_month_pct ?? occupancy.latest_week_pct ?? occupancy.avg_4wk_pct,
      unit: 'percent',
      source: { label: sourceFiles[0] ?? 'Extracted report' },
      confidence: extracted.meta?.data_quality === 'HIGH' ? 'high' : extracted.meta?.data_quality === 'MEDIUM' ? 'medium' : 'low',
      status: 'extracted',
    },
    {
      id: 'fallback-revenue',
      field: 'revenue',
      category: 'financials',
      label: 'Revenue',
      value: financials.fy25?.revenue ?? ratios.revenue_fy25,
      unit: 'aud',
      source: { label: sourceFiles[0] ?? 'Extracted report' },
      confidence: financials.fy25?.revenue || ratios.revenue_fy25 ? 'medium' : 'missing',
      status: 'extracted',
      blocker: !(financials.fy25?.revenue || ratios.revenue_fy25),
    },
    {
      id: 'fallback-ebitda',
      field: 'ebitda',
      category: 'financials',
      label: 'EBITDA',
      value: financials.fy25?.ebitda ?? ratios.ebitda_fy25,
      unit: 'aud',
      source: { label: sourceFiles[0] ?? 'Extracted report' },
      confidence: financials.fy25?.ebitda || ratios.ebitda_fy25 ? 'medium' : 'missing',
      status: 'extracted',
      blocker: !(financials.fy25?.ebitda || ratios.ebitda_fy25),
    },
    {
      id: 'fallback-lease',
      field: 'lease',
      category: 'lease',
      label: 'Lease tenure',
      value: lease.options ? `${lease.term_years ?? 'Unknown'}yr + ${lease.options}` : lease.remaining_term_years ?? lease.expiry_date,
      source: { label: sourceFiles[0] ?? 'Extracted report' },
      confidence: lease.expiry_date || lease.remaining_term_years ? 'medium' : 'missing',
      status: 'extracted',
    },
  ]
  const displayFacts = exportFacts.length ? exportFacts : fallbackFactRows
  const currentOccupancyFact = canonicalFact(workflow, 'current_occupancy')
  const latestOccupancyFact = canonicalFact(workflow, 'avg_4wk_occupancy') ?? canonicalFact(workflow, 'avg_13wk_occupancy')
  const occupancyConflictNote = currentOccupancyFact && latestOccupancyFact && currentOccupancyFact.value !== latestOccupancyFact.value
    ? `Broker/current statement ${factValue(currentOccupancyFact)}; occupancy history ${factValue(latestOccupancyFact)}. Review source period before underwriting.`
    : undefined
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    console.debug('[ic-pack-export] ledger summary', {
      component: 'ICPackExport',
      export_version: 'ledger-v2',
      has_canonical_facts: Boolean(workflow?.canonical_facts),
      has_valuation_gate_summary: Boolean(workflow?.valuation_gate_summary?.rows?.length),
      has_evidence_readiness: Boolean(workflow?.evidence_readiness),
      has_evidence_quality: Boolean(workflow?.evidence_quality),
      fact_keys: Object.keys(workflow?.canonical_facts ?? {}),
      valuation_gate_fields: valuationSummaryRows.map(row => row.field),
      evidence_readiness_group_counts: Object.fromEntries(
        Object.entries(workflow?.evidence_readiness ?? {}).map(([key, value]) => [key, value.length]),
      ),
      has_grouped_requests: requests.some(item => item.source === 'missing_fields_grouped'),
      export_component_path: 'src/components/report/ICPackExport.tsx',
      run_id: workflow?.run_id ?? currentRun?.id ?? currentRunSnapshot?.id ?? null,
    })
  }, [workflow, valuationSummaryRows, requests, currentRun, currentRunSnapshot])

  return (
    <article className="ic-pack-export" aria-label="IC pack export">
      <header className="ic-pack-cover">
        <div>
          <div className="ic-pack-brand">Acquira IC Pack</div>
          <div className="ic-pack-version-marker">{IC_PACK_EXPORT_VERSION}</div>
          {historicalMode && <div className="ic-pack-label" style={{ marginBottom: '6mm' }}>Historical underwriting snapshot</div>}
          <h1>{centre.name || scored.centre_name}</h1>
          <p>{centre.address || [centre.suburb, centre.state].filter(Boolean).join(', ') || 'Childcare acquisition report'}</p>
        </div>
        <div className={valuationBlocked ? 'ic-pack-decision ic-pack-decision-blocked' : 'ic-pack-decision'}>
          <span>{historicalMode ? 'Snapshot verdict' : 'Investment verdict'}</span>
          <strong>{decision}</strong>
          {valuationBlocked && <em>{blockedMessage}</em>}
          {historicalMode && <em>Historical underwriting snapshot — not current unless promoted.</em>}
        </div>
      </header>

      <ExportSection number="1" title="Recommendation and Confidence">
        {historicalMode && (
          <div className="ic-pack-alert ic-pack-alert-red">
            <strong>Historical underwriting snapshot — not current unless promoted.</strong>
            <p>
              This IC Pack was generated from {currentRun ? formatRunLabel(currentRun) : 'a historical run snapshot'}.
              {' '}
              {isRunCurrent
                ? 'This run is currently promoted.'
                : `Current promoted run is ${currentRunLabel ?? 'not shown here'}; this export is ${currentRun ? formatRunLabel(currentRun) : 'the selected historical run'}.`}
            </p>
          </div>
        )}
        <div className={valuationBlocked ? 'ic-pack-alert ic-pack-alert-red' : 'ic-pack-alert'}>
          <strong>{coverNarrative.headline}</strong>
          <p>{valuationBlocked ? coverNarrative.body : guardedSummary ?? coverNarrative.body}</p>
          {isIllustrative && <div className="ic-pack-label">Illustrative only — not underwritten.</div>}
        </div>
        <div className="ic-pack-alert">
          <strong>Printable summary scope</strong>
          <p>This IC Pack is a printable investment summary. Interactive app-only elements such as maps, evidence drawers, and diligence controls are summarized rather than reproduced.</p>
        </div>
        <div className="ic-pack-grid-4">
          <KeyValue label="Score" value={`${Math.round(scoreValue(scored))}/100`} />
          <KeyValue label="Licensed places" value={centre.licensed_places ? `${centre.licensed_places}` : 'Not provided'} />
          <KeyValue label="Current utilisation" value={canonicalValue(workflow, 'current_occupancy') !== 'Not provided' ? canonicalValue(workflow, 'current_occupancy') : pct(occupancy.current_month_pct ?? occupancy.latest_week_pct ?? occupancy.avg_4wk_pct)} note={occupancyConflictNote} />
          <KeyValue label="Asking price" value={canonicalValue(workflow, 'asking_price') !== 'Not provided' ? canonicalValue(workflow, 'asking_price') : money(financials.asking_price ?? ratios.asking_price)} />
        </div>
      </ExportSection>

      <ExportSection number="2" title="Why This Deal Can Fail / Conflicts">
        {riskItems.length ? (
          <div className="ic-pack-list">
            {riskItems.slice(0, 10).map(item => (
              <div
                key={item.key}
                className={`ic-pack-list-item ${item.tone === 'request' ? 'ic-pack-request' : item.tone === 'missing' ? 'ic-pack-missing' : 'ic-pack-risk'}`}
              >
                <strong>{item.title}</strong>
                <span>{sanitizeReportText(item.detail)}</span>
              </div>
            ))}
            {displayFacts.flatMap(fact => (fact.conflicts ?? []).map(conflict => ({ fact, conflict }))).slice(0, 6).map(({ fact, conflict }, index) => (
              <div key={`canonical-conflict-${index}`} className="ic-pack-list-item ic-pack-missing">
                <strong>{conflictTitle(fact)}</strong>
                <span>{conflictDetail(fact, conflict)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ic-pack-muted">No material red flags or conflicts were generated for this underwriting run. This is not a substitute for diligence.</p>
        )}
      </ExportSection>

      <ExportSection number="3" title="What Would Change The Recommendation">
        <div className="ic-pack-list">
          {recommendationItems.map(item => (
            <div key={`change-${item.title}`} className="ic-pack-list-item ic-pack-request">
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
          ))}
          {workflow?.partner_judgement_prompts?.slice(0, 4).map(prompt => (
            <div key={prompt.id} className="ic-pack-list-item ic-pack-request">
              <strong>{prompt.question}</strong>
              <span>{prompt.why_it_matters ?? 'Partner judgement required.'}</span>
            </div>
          ))}
        </div>
      </ExportSection>

      <ExportSection number="4" title="Evidence Readiness">
        <div className="ic-pack-grid-4" style={{ marginBottom: '4mm' }}>
          <KeyValue label="Evidence quality" value={quality.quality} />
          <KeyValue label="Extraction completeness" value={quality.extraction} />
          <KeyValue label="Underwriting confidence" value={quality.reliability} note={workflow?.evidence_quality?.reason ?? undefined} />
          <KeyValue label="Valuation status" value={gate?.status ? useLabel(gate.status) : 'Review required'} />
        </div>
        <EvidenceReadinessRows workflow={workflow} />
      </ExportSection>

      <ExportSection number="5" title="Key Underwriting Facts">
        <FactRows facts={displayFacts} />
      </ExportSection>

      <ExportSection number="6" title="Why This Deal Could Work">
        <div className="ic-pack-list">
          {thesisList.length ? thesisList.map((item, index) => (
            <div key={`thesis-${index}`} className="ic-pack-list-item ic-pack-request">
              <strong>{index === 0 ? 'Investment case' : 'Supporting point'}</strong>
              <span>{item}</span>
            </div>
          )) : (
            <div className="ic-pack-list-item ic-pack-request">
              <strong>Investment case requires review</strong>
              <span>Positive thesis points require further evidence review.</span>
            </div>
          )}
        </div>
      </ExportSection>

      <ExportSection number="7" title="Scoring Detail">
        <ScoringBreakdown extracted={extracted} scored={scored} workflow={workflow} />
      </ExportSection>

      <ExportSection number="8" title="Market & Competitive Position">
        <p className="ic-pack-muted">Interactive map markers are summarized here; the printable export does not reproduce the map itself.</p>
        {marketAudit ? (
          <AuditRows audit={marketAudit} />
        ) : (
          <div className="ic-pack-grid-4">
            <KeyValue label="EDR capacity screen" value={market?.edr_mid != null ? String(market.edr_mid) : 'Not available'} note={market?.zone ?? undefined} />
            <KeyValue label="Competitors" value={scoredExport.market_context?.competitor_count != null ? String(scoredExport.market_context.competitor_count) : 'Not available'} />
            <KeyValue label="Pipeline places" value={scoredExport.market_context?.approved_pipeline_places != null ? String(scoredExport.market_context.approved_pipeline_places) : 'Not available'} />
            <KeyValue label="Market confidence" value={market?.confidence ?? scored.audit_trail?.confidence ?? 'Not available'} />
          </div>
        )}
        <PipelineRows audit={pipelineAudit} projects={pipelineProjects} />
        {guard?.pipeline_note && <p>{sanitizeReportText(guard.pipeline_note)}</p>}
        {guard?.market_note && <p>{sanitizeReportText(guard.market_note)}</p>}
        <p>{sanitizeReportText(scored.dimensions?.market_position?.summary ?? scored.dimensions?.occupancy_demand?.summary ?? 'Market summary unavailable.')}</p>
      </ExportSection>

      <ExportSection number="9" title="Valuation Gate & Assumptions" breakBefore>
        <div className={valuationBlocked ? 'ic-pack-alert ic-pack-alert-red' : 'ic-pack-alert'}>
          <strong>{guardedValuationNote}</strong>
          {valuationBlocked && (
            <p>Financial evidence may be observed, but valuation multiple and return analysis require asking price and source verification.</p>
          )}
          {isIllustrative && <div className="ic-pack-label">Illustrative only — not underwritten.</div>}
        </div>
        <ValuationGateRows rows={valuationSummaryRows} />
        <p>{valuationBlocked ? 'Monthly or IM-derived evidence can support a diligence hypothesis, but source accounts, payroll reconciliation, asking price, and occupancy trend must be verified before IC reliance.' : guardedValuationNote ?? scored.dimensions?.valuation_structure?.summary ?? 'Valuation assumptions require supporting evidence before IC reliance.'}</p>
      </ExportSection>

      <ExportSection number="10" title="What We Do Not Know">
        <div className="ic-pack-list">
          {uncertaintyList.map((item, index) => (
            <div key={`unknown-${index}`} className="ic-pack-list-item ic-pack-missing">
              <strong>Open IC question</strong>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </ExportSection>

      <ExportSection number="11" title="Broker / Seller Request List">
        {brokerRequests.length ? (
          <div className="ic-pack-list">
            {brokerRequests.map(item => (
              <div key={item.id} className="ic-pack-list-item ic-pack-request">
                <strong>{item.text}</strong>
                <span>{item.meta}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ic-pack-muted">No broker request list is available.</p>
        )}
      </ExportSection>

      <ExportSection number="12" title="IC Decision & Deal Structure Recommendation">
        <div className={valuationBlocked ? 'ic-pack-alert ic-pack-alert-red' : 'ic-pack-alert'}>
          <strong>{decision}</strong>
          <p>
            {valuationBlocked
              ? coverNarrative.decisionDetail
              : scoredExport.next_steps?.deal_structuring_notes ?? scored.verdict?.recommended_buyer_profile ?? 'Proceed only with evidence-backed diligence conditions.'}
          </p>
          {guard?.pipeline_note && <p>{guard.pipeline_note}</p>}
          {guard?.market_note && <p>{guard.market_note}</p>}
          {isIllustrative && <div className="ic-pack-label">Illustrative only — not underwritten.</div>}
        </div>
      </ExportSection>

      <ExportSection number="13" title="Appendix / Audit Trail">
        {currentRun ? (
          <>
            <div className="ic-pack-grid-4">
              <KeyValue label={historicalMode ? 'Exported snapshot' : 'Current underwriting'} value={formatRunLabel(currentRun)} note={`Run ID ${formatRunShortId(currentRun.id)}`} />
              <KeyValue label="Run type" value={formatRunType(currentRun.run_type)} note={currentRun.base_run_id ? `Base ${formatRunShortId(currentRun.base_run_id)}` : undefined} />
              <KeyValue label="Completed" value={formatRunDate(currentRun.completed_at)} />
              <KeyValue label="Promoted" value={formatRunDate(currentRun.promoted_at)} />
              <KeyValue label="Input documents" value={`${inputDocumentCount}`} note={`${inputSourceCount} retained source · ${inputDiligenceCount} diligence`} />
              <KeyValue label="Input size" value={formatRunBytes(currentRun.input_total_bytes)} />
              <KeyValue label="Run status" value={currentRun.status} note={currentRun.progress_message ?? undefined} />
              <KeyValue label="Evidence provenance" value="Run-scoped" note="Evidence references are scoped to this underwriting run." />
            </div>
            {staleDocumentCount > 0 && (
              <div className="ic-pack-alert ic-pack-alert-red">
                <strong>This IC Pack excludes newer uploaded diligence documents.</strong>
                <p>
                  {staleDocumentCount} document{staleDocumentCount === 1 ? '' : 's'} were uploaded after {formatRunDate(currentRun.completed_at)} and are not included in this underwriting run.
                </p>
              </div>
            )}
            {runDiff && (
              <div className="ic-pack-list">
                {[runDiff.scoreChange, runDiff.valuationGateChange, runDiff.recommendationChange].filter(Boolean).map((change, index) => (
                  <div key={`run-change-${index}`} className="ic-pack-list-item ic-pack-request">
                    <strong>Run change</strong>
                    <span>{change}</span>
                  </div>
                ))}
                {runDiff.warnings.slice(0, 4).map((warning, index) => (
                  <div key={`${warning}-${index}`} className="ic-pack-list-item ic-pack-missing">
                    <strong>Run warning</strong>
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="ic-pack-alert">
            <strong>{metadataFallbackLabel}</strong>
            <p>{metadataFallbackBody}</p>
          </div>
        )}
      </ExportSection>

      <footer className="ic-pack-footer">
        {IC_PACK_EXPORT_VERSION} · Acquira acquisition intelligence · Generated {exportGeneratedAt} · {historicalMode ? 'Historical snapshot · ' : ''}{currentRun ? `${formatRunLabel(currentRun)} (${formatRunShortId(currentRun.id)})` : metadataFallbackLabel} · Extraction completeness: {quality.extraction} · Underwriting confidence: {quality.reliability}
      </footer>
    </article>
  )
}
