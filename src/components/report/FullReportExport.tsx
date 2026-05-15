import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'
import type { DealWorkflow, PipelineProject, WorkflowFact } from '@/types/workflow'
import type { UnderwritingRun, UnderwritingRunSummary } from '@/types/runs'
import type React from 'react'

const FULL_REPORT_EXPORT_VERSION = 'FULL_REPORT_EXPORT_VERSION ledger-v2 / commit 95178a5'

type ScoredForReport = ScoredDeal & {
  market_context?: {
    competitor_count?: number | null
    approved_pipeline_places?: number | null
    edr_mid?: number | null
    confidence?: string | null
    zone?: string | null
  }
  demand_context?: {
    edr_mid?: number | null
    confidence?: string | null
    zone?: string | null
  }
  next_steps?: {
    ask_broker_for?: string[]
    due_diligence_priorities?: string[]
    deal_structuring_notes?: string
  }
}

function scoreValue(scored: ScoredDeal): number {
  return typeof scored.total_score === 'number' ? scored.total_score : (scored.overall_score ?? 0) * 10
}

function money(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return 'Not provided'
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString('en-AU')}`
}

function pct(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return 'Not provided'
  return `${value.toLocaleString('en-AU', { maximumFractionDigits: 1 })}%`
}

function valueLabel(value: unknown): string {
  if (value == null || value === '') return 'Not provided'
  if (typeof value === 'number') return value.toLocaleString('en-AU', { maximumFractionDigits: 2 })
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function useLabel(value?: string | null): string {
  if (!value) return 'Not provided'
  return value.replace(/_/g, ' ')
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not available'
  return new Date(value).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function workflowFacts(workflow?: DealWorkflow | null): WorkflowFact[] {
  return workflow?.facts ?? workflow?.extracted_facts ?? workflow?.evidence_ledger ?? []
}

function evidenceCounts(workflow?: DealWorkflow | null) {
  const facts = workflowFacts(workflow)
  return {
    accepted: facts.filter(fact => fact.underwriting_use === 'accepted').length,
    review: facts.filter(fact => fact.underwriting_use === 'review_required' && fact.trust !== 'disputed').length,
    missing: facts.filter(fact => fact.underwriting_use === 'blocked' || fact.blocker || fact.confidence === 'missing' || fact.value == null || fact.value === '').length,
    conflicting: facts.filter(fact => fact.trust === 'disputed' || fact.conflicts?.length).length,
    excluded: facts.filter(fact => fact.underwriting_use === 'excluded').length,
  }
}

function decisionLabel(workflow: DealWorkflow | null | undefined, scored: ScoredDeal): string {
  const score = scoreValue(scored)
  if (workflow?.valuation_gate?.status === 'blocked') return 'Blocked'
  if (workflow?.valuation_gate?.status === 'needs_review') return 'Proceed with caution'
  if (score >= 62) return 'Proceed to diligence'
  if (score >= 42) return 'Proceed with caution'
  return 'Do not proceed'
}

function firstAction(workflow?: DealWorkflow | null): string {
  const diligence = [
    ...(workflow?.diligence_requests ?? []),
    ...(workflow?.diligence_checklist ?? []),
  ]
  const critical = diligence.find(item => item.priority === 'high' && !['received', 'verified', 'waived'].includes(item.status))
  if (critical) return critical.request || critical.question
  const blocker = workflowFacts(workflow).find(fact => fact.next_action || fact.blocker || fact.confidence === 'missing')
  if (blocker?.next_action) return blocker.next_action
  if (blocker) return `Request source evidence for ${blocker.label}.`
  return 'Review the memo, confirm evidence quality, and progress priority diligence requests.'
}

function KeyValue({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="ic-pack-kv">
      <div className="ic-pack-kv-label">{label}</div>
      <div className="ic-pack-kv-value">{value}</div>
      {note && <div className="ic-pack-kv-note">{note}</div>}
    </div>
  )
}

function ReportSection({
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

function evidenceRows(workflow?: DealWorkflow | null): WorkflowFact[] {
  return workflowFacts(workflow)
    .filter(fact => fact.underwriting_use !== 'excluded')
    .slice(0, 12)
}

function runChangeItems(run?: UnderwritingRun | null): string[] {
  const diff = run?.diff as Record<string, unknown> | null | undefined
  if (!diff) return []
  const changeLabel = (label: string, value: unknown) => {
    if (!value || typeof value !== 'object') return `${label}: ${valueLabel(value)}`
    const record = value as Record<string, unknown>
    const before = record.from ?? record.previous ?? record.old ?? record.before
    const after = record.to ?? record.current ?? record.new ?? record.after
    if (before != null || after != null) return `${label}: ${valueLabel(before)} -> ${valueLabel(after)}`
    return `${label}: changed`
  }
  return [
    diff.score_change ? changeLabel('Score changed', diff.score_change) : null,
    diff.valuation_gate_change ? changeLabel('Valuation readiness changed', diff.valuation_gate_change) : null,
    diff.recommendation_change ? changeLabel('Recommendation changed', diff.recommendation_change) : null,
  ].filter(Boolean) as string[]
}

export default function FullReportExport({
  extracted,
  scored,
  workflow,
  currentRun,
  currentRunSnapshot,
  staleDocumentCount = 0,
}: {
  extracted: ExtractedDeal
  scored: ScoredDeal
  workflow?: DealWorkflow | null
  currentRun?: UnderwritingRunSummary | null
  currentRunSnapshot?: UnderwritingRun | null
  staleDocumentCount?: number
}) {
  const scoredReport = scored as ScoredForReport
  const centre = extracted.centre
  const financials = extracted.financials
  const occupancy = extracted.occupancy
  const counts = evidenceCounts(workflow)
  const facts = evidenceRows(workflow)
  const requests = workflow?.diligence_checklist ?? workflow?.diligence_requests ?? []
  const risks = workflow?.risks ?? []
  const marketAudit = workflow?.market_audit ?? scored.market_audit
  const publicBenchmark = marketAudit?.public_market_benchmark
  const localCapacity = marketAudit?.local_demand_supply
  const pipelineProjects: PipelineProject[] = workflow?.pipeline_projects ?? scored.pipeline_projects ?? []
  const runChanges = runChangeItems(currentRunSnapshot)
  const generatedAt = new Date().toLocaleString('en-AU')
  const decision = decisionLabel(workflow, scored)

  return (
    <article className="full-report-export" aria-label="Full report export">
      <header className="ic-pack-cover">
        <div>
          <div className="ic-pack-brand">Acquira Full Report</div>
          <h1>{centre.name || scored.centre_name}</h1>
          <p>{centre.address || [centre.suburb, centre.state].filter(Boolean).join(', ') || 'Childcare acquisition report'}</p>
          <p>Full diligence and evidence review pack following the report journey: Decision, Memo, Underwriting, Evidence, Diligence, and Run History.</p>
        </div>
        <div className={workflow?.valuation_gate?.status === 'blocked' ? 'ic-pack-decision ic-pack-decision-blocked' : 'ic-pack-decision'}>
          <span>Investment decision</span>
          <strong>{decision}</strong>
          <em>Generated {generatedAt}</em>
        </div>
      </header>

      <ReportSection number="1" title="Decision Dashboard">
        <div className="ic-pack-grid-4">
          <KeyValue label="Decision" value={decision} />
          <KeyValue label="Score" value={`${Math.round(scoreValue(scored))}/100`} />
          <KeyValue label="Valuation readiness" value={workflow?.valuation_gate?.status ? useLabel(workflow.valuation_gate.status) : 'Review required'} note={workflow?.valuation_gate?.message} />
          <KeyValue label="Evidence readiness" value={`${counts.accepted} accepted`} note={`${counts.review} review · ${counts.missing} missing · ${counts.conflicting} conflicting · ${counts.excluded} excluded`} />
        </div>
        <div className="ic-pack-alert">
          <strong>Next best action</strong>
          <p>{firstAction(workflow)}</p>
        </div>
      </ReportSection>

      <ReportSection number="2" title="Memo">
        <div className="ic-pack-alert">
          <strong>Investment story</strong>
          <p>{workflow?.narrative_guard?.analyst_summary ?? scored.analyst_summary ?? scored.verdict?.one_liner ?? 'Memo narrative unavailable for this report.'}</p>
        </div>
        <div className="ic-pack-grid-4">
          <KeyValue label="Licensed places" value={centre.licensed_places ? String(centre.licensed_places) : 'Not provided'} />
          <KeyValue label="Current utilisation" value={pct(occupancy.current_month_pct ?? occupancy.latest_week_pct ?? occupancy.avg_4wk_pct)} />
          <KeyValue label="Revenue" value={money(financials.fy25?.revenue ?? extracted.key_ratios.revenue_fy25)} />
          <KeyValue label="EBITDA" value={money(financials.fy25?.ebitda ?? extracted.key_ratios.ebitda_fy25)} />
        </div>
        {risks.length > 0 && (
          <div className="ic-pack-list">
            {risks.slice(0, 5).map((risk, index) => (
              <div key={`${risk.id ?? risk.title ?? index}`} className="ic-pack-list-item ic-pack-risk">
                <strong>{risk.title || risk.reason || 'Risk'}</strong>
                <span>{risk.reason || 'Review in diligence.'}</span>
              </div>
            ))}
          </div>
        )}
      </ReportSection>

      <ReportSection number="3" title="Underwriting">
        <div className="ic-pack-alert">
          <strong>Judgement logic</strong>
          <p>{scored.dimensions?.valuation_structure?.summary ?? workflow?.valuation_gate?.reason ?? 'Underwriting summary unavailable.'}</p>
        </div>
        <div className="ic-pack-table">
          <div className="ic-pack-table-head">
            <div>Dimension</div>
            <div>Score</div>
            <div>Rationale</div>
          </div>
          {Object.entries(scored.dimensions).slice(0, 12).map(([id, dim]) => (
            <div key={id} className="ic-pack-table-row">
              <strong>{dim.label || useLabel(id)}</strong>
              <span>{typeof dim.score === 'number' ? `${dim.score.toFixed(1)}/10` : 'Not scored'}</span>
              <span>{dim.summary || 'No rationale supplied.'}</span>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection number="4" title="Evidence" breakBefore>
        <div className="ic-pack-alert">
          <strong>How to read market evidence</strong>
          <p>EDR is an internal capacity screen. CCS benchmark data is public aggregate market evidence showing realised CCS usage and CBDC pricing benchmark context. Competitive Map data is local supply context, while pipeline evidence indicates future supply pressure. These metrics are not interchangeable.</p>
        </div>
        <div className="ic-pack-grid-4">
          <KeyValue label="Public market benchmark" value={publicBenchmark?.sa3_name ?? publicBenchmark?.sa3_code ?? 'Not available'} note={publicBenchmark ? 'public aggregate market evidence · realised CCS usage · CBDC pricing benchmark' : 'Only shown when explicit SA3 context is supplied.'} />
          <KeyValue label="Capacity screen" value={localCapacity?.market_capacity_signal ?? 'Not available'} note="Remains absent unless explicitly supplied." />
          <KeyValue label="Competitive summary" value={scoredReport.market_context?.competitor_count != null ? `${scoredReport.market_context.competitor_count} competitors` : 'See market evidence'} note="Interactive map is summarized, not reproduced." />
          <KeyValue label="Pipeline summary" value={pipelineProjects.length ? `${pipelineProjects.length} project${pipelineProjects.length === 1 ? '' : 's'}` : 'No pipeline list'} note="Supply/pipeline map is summarized for print." />
        </div>
        <div className="ic-pack-table">
          <div className="ic-pack-table-head">
            <div>Fact</div>
            <div>Status</div>
            <div>Source / action</div>
          </div>
          {facts.map(fact => (
            <div key={fact.id} className={fact.underwriting_use === 'blocked' || fact.trust === 'disputed' ? 'ic-pack-table-row ic-pack-row-warning' : 'ic-pack-table-row'}>
              <strong>{fact.label}: {valueLabel(fact.value)}</strong>
              <span>{useLabel(fact.underwriting_use ?? fact.confidence)}</span>
              <span>{fact.source?.label ?? fact.source_label ?? fact.next_action ?? 'Source not provided'}</span>
            </div>
          ))}
          {!facts.length && (
            <div className="ic-pack-table-row">
              <strong>Evidence ledger</strong>
              <span>Unavailable</span>
              <span>No workflow evidence facts are present in this report payload.</span>
            </div>
          )}
        </div>
      </ReportSection>

      <ReportSection number="5" title="Diligence">
        <div className="ic-pack-alert">
          <strong>What to verify before offer</strong>
          <p>Diligence should focus on broker evidence requests, missing source documents, and items that affect valuation confidence.</p>
        </div>
        <div className="ic-pack-list">
          {requests.slice(0, 10).map(item => (
            <div key={item.id} className={item.priority === 'high' ? 'ic-pack-list-item ic-pack-missing' : 'ic-pack-list-item ic-pack-request'}>
              <strong>{item.priority === 'high' ? 'Do first' : item.priority === 'medium' ? 'This week' : 'Before offer'} · {item.category}</strong>
              <span>{item.request || item.question} {item.why_it_matters ? `Why it matters: ${item.why_it_matters}` : ''}</span>
            </div>
          ))}
          {!requests.length && (
            <div className="ic-pack-list-item ic-pack-request">
              <strong>No generated diligence checklist</strong>
              <span>Review evidence readiness and broker requests in the app.</span>
            </div>
          )}
        </div>
      </ReportSection>

      <ReportSection number="6" title="Run History">
        {currentRun ? (
          <>
            <div className="ic-pack-grid-4">
              <KeyValue label="Current run" value={`Run #${currentRun.run_number}`} note={currentRun.is_current ? 'Promoted current run' : 'Historical run'} />
              <KeyValue label="Status" value={currentRun.status} />
              <KeyValue label="Completed" value={formatDate(currentRun.completed_at)} />
              <KeyValue label="Promoted" value={formatDate(currentRun.promoted_at)} />
            </div>
            {staleDocumentCount > 0 && (
              <div className="ic-pack-alert ic-pack-alert-red">
                <strong>Newer diligence documents are excluded from this run.</strong>
                <p>{staleDocumentCount} document{staleDocumentCount === 1 ? '' : 's'} were uploaded after this underwriting run.</p>
              </div>
            )}
            <div className="ic-pack-list">
              {runChanges.slice(0, 4).map((change, index) => (
                <div key={`run-change-${index}`} className="ic-pack-list-item ic-pack-request">
                  <strong>What changed</strong>
                  <span>{change}</span>
                </div>
              ))}
              {!runChanges.length && (
                <div className="ic-pack-list-item ic-pack-request">
                  <strong>Run change summary</strong>
                  <span>Detailed run diff is unavailable for this current snapshot. Run comparisons appear from Run 2 onwards.</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="ic-pack-alert">
            <strong>Run metadata unavailable</strong>
            <p>Save this deal to create immutable underwriting run history.</p>
          </div>
        )}
      </ReportSection>

      <footer className="ic-pack-footer">
        {FULL_REPORT_EXPORT_VERSION} · Full Report PDF · Acquira acquisition intelligence · Generated {generatedAt}
      </footer>
    </article>
  )
}
