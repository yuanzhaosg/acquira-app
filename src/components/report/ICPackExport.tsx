import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'
import type { UnderwritingRun, UnderwritingRunSummary } from '@/types/runs'
import type { DealWorkflow, MarketAudit, PipelineAudit, PipelineProject, WorkflowFact } from '@/types/workflow'
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
}

type EvidenceRequirement = 'revenue' | 'ebitda' | 'payroll_labour_cost' | 'occupancy_history'

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

function factValue(fact: WorkflowFact): string {
  if (fact.value == null || fact.value === '') return 'Missing'
  if (fact.unit === 'aud' && typeof fact.value === 'number') return money(fact.value)
  if (fact.unit === 'percent' && typeof fact.value === 'number') return pct(fact.value)
  if (fact.unit === 'places' && typeof fact.value === 'number') return `${fact.value.toLocaleString('en-AU')} places`
  return String(fact.value)
}

function confidenceLabel(fact: WorkflowFact): string {
  const source = fact.source?.label ?? fact.source_label ?? 'Source pending'
  const compactSource = source.split('/').pop()?.replace(/\s+/g, ' ').slice(0, 64) ?? source
  return `${fact.confidence.toUpperCase()} · ${compactSource}`
}

function scoreValue(scored: ScoredDeal): number {
  if (typeof scored.total_score === 'number') return scored.total_score
  if (typeof scored.overall_score === 'number') return scored.overall_score * 10
  return 0
}

function decisionLabel(workflow: DealWorkflow | null | undefined, scored: ScoredDeal): string {
  const gate = workflow?.valuation_gate
  const score = scoreValue(scored)
  if (gate?.status === 'blocked') return 'Cannot underwrite yet'
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
  if (blocked) return 'Valuation blocked pending financial evidence'
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

function compactText(value: string | null | undefined): string | null {
  const compact = value?.replace(/\s+/g, ' ').trim()
  return compact || null
}

function formatDimensionKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function componentScoreRows(scored: ScoredDeal): Array<{ id: string; label: string; score: string; summary: string }> {
  return Object.entries(scored.dimensions ?? {})
    .map(([id, dimension]) => {
      const entry = dimension as DimensionEntry
      return {
        id,
        label: compactText(entry.label) ?? formatDimensionKey(id),
        score: typeof entry.score === 'number' ? `${entry.score.toFixed(1)}/10` : 'Not scored',
        summary: compactText(entry.summary) ?? 'No component explanation available.',
      }
    })
    .filter(row => row.label || row.summary)
}

function riskItem(key: string, title: string | null | undefined, detail: string | null | undefined, tone: RiskItem['tone'] = 'risk'): RiskItem | null {
  const cleanTitle = compactText(title)
  const cleanDetail = compactText(detail)
  if (!cleanTitle && !cleanDetail) return null
  return {
    key,
    title: cleanTitle ?? 'Underwriting warning',
    detail: cleanDetail ?? 'Review before IC reliance.',
    tone,
  }
}

function uniqueRiskItems(items: Array<RiskItem | null>): RiskItem[] {
  const seen = new Set<string>()
  const output: RiskItem[] = []
  for (const item of items) {
    if (!item) continue
    const signature = `${item.title.toLowerCase()}|${item.detail.toLowerCase()}`
    if (seen.has(signature)) continue
    seen.add(signature)
    output.push(item)
  }
  return output
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
          'Geospatial competitor supply differs materially from postcode comparison; verify catchment methodology before relying on demand conclusions.',
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
  const rows = componentScoreRows(scored)
  const blocked = isValuationBlocked(extracted, workflow)
  const triggeredFlags = scored.deal_breaker_flags?.flags?.filter(flag => flag.triggered) ?? []
  const criticalFlags = triggeredFlags.filter(flag => flag.severity === 'critical')
  const hardFlags = extracted.hard_flags ?? []
  const guard = workflow?.narrative_guard
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
          value={blocked ? 'Valuation blocked pending financial evidence' : workflow?.narrative_guard?.recommendation ?? scored.verdict?.category?.replace(/_/g, ' ') ?? scored.overall_verdict ?? 'Not available'}
          note={blocked ? 'Recovery thesis cannot be underwritten until required evidence is provided.' : scored.verdict?.one_liner ?? undefined}
        />
        <KeyValue
          label="Red flags"
          value={`${triggeredFlags.length + hardFlags.length}`}
          note={criticalFlags.length ? `${criticalFlags.length} critical flag${criticalFlags.length === 1 ? '' : 's'}` : 'No critical scored flags'}
        />
        <KeyValue
          label="Data quality"
          value={extracted.meta?.data_quality ?? scored.audit_trail?.confidence ?? 'Not available'}
          note={scored.scoring_version ? `Scoring version ${scored.scoring_version}` : scored.audit_trail?.confidence_note ?? undefined}
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
          {rows.map(row => (
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

function FactRows({ facts }: { facts: WorkflowFact[] }) {
  if (!facts.length) return <p className="ic-pack-muted">No source-backed workflow facts available.</p>
  return (
    <div className="ic-pack-table">
      <div className="ic-pack-table-head">
        <span>Fact</span>
        <span>Value</span>
        <span>Source / Confidence</span>
      </div>
      {facts.map(fact => (
        <div key={fact.id} className={fact.blocker || fact.confidence === 'missing' ? 'ic-pack-table-row ic-pack-row-warning' : 'ic-pack-table-row'}>
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
  const warnings = audit.warnings ?? []
  const supply = audit.competitor_supply
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
        <KeyValue label="Competitors" value={audit.competitor_count?.value != null ? audit.competitor_count.value.toLocaleString('en-AU') : 'Not available'} note={audit.competitor_count?.source ?? undefined} />
        <KeyValue
          label="Pipeline places"
          value={audit.pipeline_places?.value != null ? audit.pipeline_places.value.toLocaleString('en-AU') : 'Not available'}
          note={[audit.pipeline_places?.source, audit.pipeline_places?.confidence ? `${audit.pipeline_places.confidence} confidence` : null].filter(Boolean).join(' · ')}
        />
        <KeyValue label="EDR" value={audit.edr?.value != null ? String(audit.edr.value) : 'Not available'} note={audit.edr?.interpretation ?? undefined} />
        <KeyValue label="EDR formula" value="Kids x utilisation / places" note={audit.edr?.formula ?? undefined} />
      </div>
      {supply && (
        <>
          <div className="ic-pack-grid-4">
            <KeyValue
              label="Competitor supply source"
              value={supplySourceLabel(supply.source)}
              note={supply.confidence ? `${supply.confidence} confidence` : undefined}
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
              label="Competitor supply"
              value={[
                supply.competitor_count != null ? `${supply.competitor_count.toLocaleString('en-AU')} centres` : null,
                supply.total_licensed_places != null ? `${supply.total_licensed_places.toLocaleString('en-AU')} places` : null,
              ].filter(Boolean).join(' / ') || 'Not available'}
              note={supply.confidence ? `${supply.confidence} confidence` : undefined}
            />
            <KeyValue
              label="Postcode comparison"
              value={[
                supply.compared_to_postcode?.competitor_count != null ? `${supply.compared_to_postcode.competitor_count.toLocaleString('en-AU')} centres` : null,
                supply.compared_to_postcode?.total_licensed_places != null ? `${supply.compared_to_postcode.total_licensed_places.toLocaleString('en-AU')} places` : null,
              ].filter(Boolean).join(' / ') || 'Not available'}
              note={supply.compared_to_postcode?.edr != null ? `Postcode EDR ${supply.compared_to_postcode.edr}` : undefined}
            />
          </div>
          {supply.material_difference && (
            <div className="ic-pack-list" style={{ marginBottom: '4mm' }}>
              <div className="ic-pack-list-item ic-pack-missing">
                <strong>Competitor supply mismatch</strong>
                <span>Supply differs materially from postcode comparison — verify catchment methodology.</span>
              </div>
            </div>
          )}
          {(supply.warnings?.length ?? 0) > 0 && (
            <div className="ic-pack-list" style={{ marginBottom: '4mm' }}>
              {(supply.warnings ?? []).slice(0, 3).map((warning, index) => (
                <div key={`${warning}-${index}`} className="ic-pack-list-item ic-pack-missing">
                  <strong>Supply warning</strong>
                  <span>{investorWarning(warning)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {warnings.length > 0 && (
        <div className="ic-pack-list">
          {warnings.slice(0, 5).map((warning, index) => (
            <div key={`${warning}-${index}`} className="ic-pack-list-item ic-pack-missing">
              <strong>Market audit warning</strong>
              <span>{investorWarning(warning)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
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
  const extractedMissingFields = extracted.meta?.missing_fields ?? []
  const gate = workflow?.valuation_gate
  const facts = workflow?.facts ?? workflow?.extracted_facts ?? []
  const knownFacts = facts.filter(f => f.confidence !== 'missing' && f.value != null).slice(0, 14)
  const missingFacts = [
    ...(workflow?.missing_fields ?? []),
    ...(gate?.blockers.map(b => b.reason) ?? []),
  ]
  const requests = workflow?.diligence_checklist ?? workflow?.diligence_requests ?? []
  const market = scoredExport.market_context ?? scoredExport.demand_context
  const marketAudit = workflow?.market_audit ?? scored.market_audit
  const pipelineAudit = workflow?.pipeline_audit ?? scoredExport.pipeline_audit
  const pipelineProjects = workflow?.pipeline_projects ?? scoredExport.pipeline_projects
  const guard = workflow?.narrative_guard
  const missingRequiredEvidence = missingValuationEvidence(extracted, workflow)
  const valuationBlocked = isValuationBlocked(extracted, workflow)
  const isIllustrative = valuationBlocked || (gate ? !gate.can_show_confident_valuation : false)
  const blockedMessage = 'Cannot underwrite yet — valuation blocked pending financial evidence.'
  const decision = investorSafeVerdictLabel(valuationBlocked, workflow, scored)
  const guardedSummary = valuationBlocked
    ? investorSafeCoverBody(true, missingRequiredEvidence, guard?.analyst_summary ?? scored.analyst_summary)
    : guard?.analyst_summary ?? scored.analyst_summary
  const guardedValuationNote = investorSafeValuationCopy(valuationBlocked, missingRequiredEvidence, guard?.valuation_note ?? gate?.message)
  const fallbackRequests = [
    ...(scoredExport.next_steps?.ask_broker_for ?? []),
    ...(scoredExport.next_steps?.due_diligence_priorities ?? []),
  ]
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

  const fallbackFactRows: WorkflowFact[] = facts.length ? [] : [
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
  const exportFacts = knownFacts.length ? knownFacts : fallbackFactRows
  const blockerFacts = facts.filter(f => f.blocker || f.confidence === 'missing').slice(0, 10)
  const evidenceState = valuationEvidenceState(extracted, workflow)

  return (
    <article className="ic-pack-export" aria-label="IC pack export">
      <header className="ic-pack-cover">
        <div>
          <div className="ic-pack-brand">Acquira IC Pack</div>
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

      <ExportSection number="1" title="Cover / Investment Verdict">
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
          <strong>{valuationBlocked ? 'Evidence required before underwriting' : scored.verdict?.one_liner ?? guardedSummary ?? decision}</strong>
          <p>{investorSafeCoverBody(valuationBlocked, missingRequiredEvidence, guardedSummary)}</p>
          {isIllustrative && <div className="ic-pack-label">Illustrative only — not underwritten.</div>}
        </div>
        <div className="ic-pack-alert">
          <strong>Printable summary scope</strong>
          <p>This IC Pack is a printable investment summary. Interactive app-only elements such as maps, evidence drawers, and diligence controls are summarized rather than reproduced.</p>
        </div>
        <div className="ic-pack-grid-4">
          <KeyValue label="Score" value={`${Math.round(scoreValue(scored))}/100`} />
          <KeyValue label="Licensed places" value={centre.licensed_places ? `${centre.licensed_places}` : 'Not provided'} />
          <KeyValue label="Current utilisation" value={pct(occupancy.current_month_pct ?? occupancy.latest_week_pct ?? occupancy.avg_4wk_pct)} />
          <KeyValue label="Asking price" value={money(financials.asking_price ?? ratios.asking_price)} />
        </div>
      </ExportSection>

      <ExportSection number="2" title="Underwriting Version / Audit Trail">
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
              {historicalMode && <KeyValue label="Current status" value={isRunCurrent ? 'This run is current' : 'Historical only'} note={isRunCurrent ? undefined : `Current promoted run: ${currentRunLabel ?? 'not available'}`} />}
              {historicalMode && <KeyValue label="Export generated" value={exportGeneratedAt} />}
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
                {runDiff.scoreChange && (
                  <div className="ic-pack-list-item ic-pack-request">
                    <strong>Score change</strong>
                    <span>{runDiff.scoreChange}</span>
                  </div>
                )}
                {runDiff.valuationGateChange && (
                  <div className="ic-pack-list-item ic-pack-request">
                    <strong>Valuation gate</strong>
                    <span>{runDiff.valuationGateChange}</span>
                  </div>
                )}
                {runDiff.recommendationChange && (
                  <div className="ic-pack-list-item ic-pack-request">
                    <strong>Recommendation change</strong>
                    <span>{runDiff.recommendationChange}</span>
                  </div>
                )}
                {runDiff.resolvedBlockers.slice(0, 5).map(blocker => (
                  <div key={`resolved-${blocker}`} className="ic-pack-list-item ic-pack-request">
                    <strong>Resolved blocker</strong>
                    <span>{blocker}</span>
                  </div>
                ))}
                {runDiff.newBlockers.slice(0, 5).map(blocker => (
                  <div key={`new-${blocker}`} className="ic-pack-list-item ic-pack-missing">
                    <strong>New blocker</strong>
                    <span>{blocker}</span>
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

      <ExportSection number="3" title="Scoring Breakdown">
        <ScoringBreakdown extracted={extracted} scored={scored} workflow={workflow} />
      </ExportSection>

      <ExportSection number="4" title="Deal Facts & Source Confidence">
        <FactRows facts={exportFacts} />
      </ExportSection>

      <ExportSection number="5" title="Risks & Red Flags">
        {riskItems.length ? (
          <div className="ic-pack-list">
            {riskItems.slice(0, 14).map(item => (
              <div
                key={item.key}
                className={`ic-pack-list-item ${item.tone === 'request' ? 'ic-pack-request' : item.tone === 'missing' ? 'ic-pack-missing' : 'ic-pack-risk'}`}
              >
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ic-pack-muted">No material red flags or warnings were generated for this underwriting run. This is not a substitute for diligence.</p>
        )}
      </ExportSection>

      <ExportSection number="6" title="Market / Competitor Audit">
        <p className="ic-pack-muted">Interactive map markers are summarized here; the printable export does not reproduce the map itself.</p>
        {marketAudit ? (
          <AuditRows audit={marketAudit} />
        ) : (
          <div className="ic-pack-grid-4">
            <KeyValue label="Adjusted demand ratio" value={market?.edr_mid != null ? String(market.edr_mid) : 'Not available'} note={market?.zone ?? undefined} />
            <KeyValue label="Competitors" value={scoredExport.market_context?.competitor_count != null ? String(scoredExport.market_context.competitor_count) : 'Not available'} />
            <KeyValue label="Pipeline places" value={scoredExport.market_context?.approved_pipeline_places != null ? String(scoredExport.market_context.approved_pipeline_places) : 'Not available'} />
            <KeyValue label="Demand confidence" value={market?.confidence ?? scored.audit_trail?.confidence ?? 'Not available'} />
          </div>
        )}
        <PipelineRows audit={pipelineAudit} projects={pipelineProjects} />
        {guard?.pipeline_note && <p>{guard.pipeline_note}</p>}
        {guard?.market_note && <p>{guard.market_note}</p>}
        <p>{scored.dimensions?.market_position?.summary ?? scored.dimensions?.occupancy_demand?.summary ?? 'Market summary unavailable.'}</p>
      </ExportSection>

      <ExportSection number="7" title="Valuation Gate & Assumptions" breakBefore>
        <div className={valuationBlocked ? 'ic-pack-alert ic-pack-alert-red' : 'ic-pack-alert'}>
          <strong>{investorSafeValuationCopy(valuationBlocked, missingRequiredEvidence, guardedValuationNote)}</strong>
          {valuationBlocked && (
            <p>The asking price may appear distressed, but no valuation conclusion can be reached without financial evidence.</p>
          )}
          {isIllustrative && <div className="ic-pack-label">Illustrative only — not underwritten.</div>}
        </div>
        <div className="ic-pack-grid-4">
          <KeyValue label="Revenue evidence" value={valuationBlocked || gate ? (evidenceState.revenue ? 'Present' : 'Missing') : money(financials.fy25?.revenue ?? ratios.revenue_fy25)} />
          <KeyValue label="EBITDA evidence" value={valuationBlocked || gate ? (evidenceState.ebitda ? 'Present' : 'Missing') : money(financials.fy25?.ebitda ?? ratios.ebitda_fy25)} />
          <KeyValue label="Payroll / labour" value={valuationBlocked || gate ? (evidenceState.payroll_labour_cost ? 'Present' : 'Missing') : pct(ratios.labour_ratio_fy25_pct)} />
          <KeyValue label="Occupancy history" value={valuationBlocked || gate ? (evidenceState.occupancy_history ? 'Present' : 'Missing') : pct(occupancy.avg_13wk_pct ?? occupancy.avg_4wk_pct)} />
        </div>
        <p>{valuationBlocked ? 'Recovery thesis depends on evidence. Potential turnaround language should be read as a diligence hypothesis, not an investable valuation conclusion.' : guardedValuationNote ?? scored.dimensions?.valuation_structure?.summary ?? 'Valuation assumptions require supporting evidence before IC reliance.'}</p>
      </ExportSection>

      <ExportSection number="8" title="Missing Information">
        {missingFacts.length || blockerFacts.length ? (
          <>
            <div className="ic-pack-list">
              {missingFacts.slice(0, 12).map(field => (
                <div key={field} className="ic-pack-list-item ic-pack-missing">
                  <strong>{field.replace(/_/g, ' ')}</strong>
                  <span>Required before confident underwriting.</span>
                </div>
              ))}
            </div>
            {blockerFacts.length > 0 && <FactRows facts={blockerFacts} />}
          </>
        ) : extractedMissingFields.length ? (
          <div className="ic-pack-list">
            {extractedMissingFields.slice(0, 12).map(field => (
              <div key={field} className="ic-pack-list-item ic-pack-missing">
                <strong>{field.replace(/_/g, ' ')}</strong>
                <span>Missing from extracted report.</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ic-pack-muted">No missing fields were flagged in the current report.</p>
        )}
      </ExportSection>

      <ExportSection number="9" title="Broker Diligence Requests" breakBefore>
        {requests.length ? (
          <div className="ic-pack-list">
            {requests.slice(0, 12).map(item => (
              <div key={item.id} className="ic-pack-list-item ic-pack-request">
                <strong>{item.question || item.request}</strong>
                <span>{item.priority.toUpperCase()} priority · {item.category}</span>
              </div>
            ))}
          </div>
        ) : fallbackRequests.length ? (
          <div className="ic-pack-list">
            {fallbackRequests.slice(0, 12).map((request, index) => (
              <div key={`${request}-${index}`} className="ic-pack-list-item ic-pack-request">
                <strong>{request}</strong>
                <span>Generated from legacy next steps.</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="ic-pack-muted">No broker request list is available.</p>
        )}
      </ExportSection>

      <ExportSection number="10" title="IC Recommendation">
        <div className={valuationBlocked ? 'ic-pack-alert ic-pack-alert-red' : 'ic-pack-alert'}>
          <strong>{decision}</strong>
          <p>
            {valuationBlocked
              ? 'Do not proceed to IC valuation until required financial evidence is provided. This can remain a potential turnaround opportunity for experienced operators, but the recovery thesis depends on source-backed financial and occupancy evidence.'
              : scoredExport.next_steps?.deal_structuring_notes ?? scored.verdict?.recommended_buyer_profile ?? 'Proceed only with evidence-backed diligence conditions.'}
          </p>
          {guard?.pipeline_note && <p>{guard.pipeline_note}</p>}
          {guard?.market_note && <p>{guard.market_note}</p>}
          {isIllustrative && <div className="ic-pack-label">Illustrative only — not underwritten.</div>}
        </div>
      </ExportSection>

      <footer className="ic-pack-footer">
        Acquira acquisition intelligence · Generated {exportGeneratedAt} · {historicalMode ? 'Historical snapshot · ' : ''}{currentRun ? `${formatRunLabel(currentRun)} (${formatRunShortId(currentRun.id)})` : metadataFallbackLabel} · Source quality: {extracted.meta?.data_quality ?? 'Not available'}
      </footer>
    </article>
  )
}
