import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'
import type { DealWorkflow, WorkflowFact } from '@/types/workflow'
import { MarketAuditSummary, PipelineSummary } from '@/components/report/MarketAuditPanel'

type ScoredWithNextSteps = ScoredDeal & {
  next_steps?: {
    verdict_plain?: string
    ask_broker_for?: string[]
    due_diligence_priorities?: string[]
    deal_structuring_notes?: string | null
  }
}

function factValue(fact: WorkflowFact): string {
  const v = fact.value
  if (v == null || v === '') return 'Missing'
  if (fact.unit === 'aud' && typeof v === 'number') return `$${v.toLocaleString('en-AU')}`
  if (fact.unit === 'percent' && typeof v === 'number') return `${v.toLocaleString('en-AU')}%`
  if (fact.unit === 'places' && typeof v === 'number') return `${v.toLocaleString('en-AU')} places`
  return String(v)
}

function factHasEvidence(fact: WorkflowFact): boolean {
  return Boolean(fact.source?.label || fact.source?.excerpt || fact.evidence_id)
}

type FactClassification = 'key_fact' | 'thesis_positive' | 'risk_negative' | 'missing_evidence' | 'neutral_context'

function factText(fact: WorkflowFact): string {
  return `${fact.field} ${fact.label}`.toLowerCase()
}

function isHardFact(fact: WorkflowFact): boolean {
  const text = factText(fact)
  return fact.category === 'centre'
    || /\b(address|centre name|licensed|places|capacity|nqs|rating|daily fee|fee|rent|lease|term|option|postcode)\b/.test(text)
}

function displayConfidence(fact: WorkflowFact): WorkflowFact['confidence'] {
  if (fact.confidence === 'missing') return 'missing'
  if (isHardFact(fact) && factHasEvidence(fact)) return 'high'
  return fact.confidence
}

function classifyFact(fact: WorkflowFact): FactClassification {
  if (fact.trust === 'disputed' || fact.underwriting_use === 'excluded') return 'risk_negative'
  if (fact.blocker || fact.confidence === 'missing' || fact.value == null || fact.value === '') return 'missing_evidence'
  const text = factText(fact)
  if (/\b(risk|declin|negative|overdue|working towards|below|above safe|unverified|not verified|missing|short|critical)\b/.test(text)) return 'risk_negative'
  if (isHardFact(fact)) return 'key_fact'
  if (
    ['fees', 'occupancy', 'financials', 'lease', 'valuation'].includes(fact.category)
    && /\b(occupancy|waitlist|revenue|ebitda|margin|rent ratio|labour|payroll|yield|multiple|demand|undersupply|pricing|option)\b/.test(text)
  ) {
    return 'thesis_positive'
  }
  if (['staffing', 'regulatory'].includes(fact.category)) return 'key_fact'
  return 'neutral_context'
}

function statusLabel(value?: string | null): string {
  if (!value) return 'unknown'
  return value.replace(/_/g, ' ')
}

function periodLabel(fact: WorkflowFact): string | null {
  const period = fact.period
  if (!period) return null
  const label = period.period_label || period.fiscal_year || period.coverage_status
  if (!label || label === 'not_applicable') return null
  return `${label}${period.coverage_status ? ` · ${statusLabel(period.coverage_status)}` : ''}`
}

function readinessGroups(facts: WorkflowFact[]) {
  return {
    accepted: facts.filter(f => f.underwriting_use === 'accepted'),
    review: facts.filter(f => f.underwriting_use === 'review_required' && f.trust !== 'disputed' && f.provenance !== 'manual_context'),
    disputed: facts.filter(f => f.trust === 'disputed'),
    blocked: facts.filter(f => f.underwriting_use === 'blocked' || f.blocker || f.confidence === 'missing'),
    excluded: facts.filter(f => f.underwriting_use === 'excluded'),
    manual: facts.filter(f => f.provenance === 'manual_context'),
    derived: facts.filter(f => f.provenance === 'derived'),
  }
}

function EvidenceReadiness({ facts, onOpen }: { facts: WorkflowFact[]; onOpen: (fact: WorkflowFact) => void }) {
  const groups = readinessGroups(facts)
  const rows = [
    ['Found / accepted', groups.accepted, '#22c55e'],
    ['Derived from documents', groups.derived, '#00b4a0'],
    ['Needs review', groups.review, '#f59e0b'],
    ['Conflicting', groups.disputed, '#ef4444'],
    ['Excluded from underwriting', groups.excluded, '#94a3b8'],
    ['Missing / blocked', groups.blocked, '#ef4444'],
    ['Manual context', groups.manual, '#f59e0b'],
  ] as const
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map(([label, group, color]) => (
        <div key={label} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.025)', padding: '11px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: group.length ? 8 : 0 }}>
            <strong style={{ color, fontSize: 12.5 }}>{label}</strong>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>{group.length}</span>
          </div>
          {group.length > 0 && (
            <div style={{ display: 'grid', gap: 7 }}>
              {group.slice(0, 5).map(fact => (
                <button
                  key={`${label}-${fact.id}`}
                  type="button"
                  onClick={() => factHasEvidence(fact) && onOpen(fact)}
                  disabled={!factHasEvidence(fact)}
                  style={{ textAlign: 'left', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)', borderRadius: 6, padding: '8px 9px', color: 'rgba(255,255,255,0.72)', cursor: factHasEvidence(fact) ? 'pointer' : 'default' }}
                >
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{fact.label}</span>
                    <span style={{ color, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>{statusLabel(fact.trust ?? fact.underwriting_use)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    {factValue(fact)} · {statusLabel(fact.provenance)} · {statusLabel(fact.source_quality)}
                    {periodLabel(fact) ? ` · ${periodLabel(fact)}` : ''}
                  </div>
                  {(fact.reason || fact.next_action || fact.derivation_formula) && (
                    <div style={{ marginTop: 3, fontSize: 11.5, color: 'rgba(255,255,255,0.42)', lineHeight: 1.45 }}>
                      {fact.reason ?? fact.period?.coverage_reason ?? fact.derivation_formula ?? fact.next_action}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function decisionLanguage(status: string, score?: number): string {
  if (status === 'blocked') return 'Cannot underwrite yet'
  if (status === 'needs_review') return 'Investigate only with conditions'
  if (typeof score === 'number' && score < 42) return 'Pass unless financial evidence is provided'
  if (typeof score === 'number' && score < 58) return 'Operator-led turnaround only'
  return 'Proceed to IC review'
}

function FactPill({ fact, onOpen }: { fact: WorkflowFact; onOpen: (fact: WorkflowFact) => void }) {
  const clickable = factHasEvidence(fact)
  const confidence = displayConfidence(fact)
  const isMissing = confidence === 'missing' || fact.blocker
  return (
    <button
      type="button"
      onClick={() => clickable && onOpen(fact)}
      disabled={!clickable}
      aria-label={clickable ? `Open evidence for ${fact.label}` : `${fact.label}: evidence unavailable`}
      style={{
        textAlign: 'left', borderRadius: 8,
        border: clickable ? '1px solid rgba(0,180,160,0.24)' : '1px solid rgba(255,255,255,0.08)',
        borderLeft: `3px solid ${isMissing ? '#f59e0b' : clickable ? '#00b4a0' : 'rgba(255,255,255,0.12)'}`,
        background: isMissing ? 'rgba(245,158,11,0.08)' : clickable ? 'rgba(0,180,160,0.045)' : 'rgba(255,255,255,0.03)',
        padding: '11px 12px', color: '#e8edf3', cursor: clickable ? 'pointer' : 'default',
        minHeight: 92,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.76)' }}>{fact.label}</span>
        <span style={{ fontSize: 10.5, fontFamily: 'IBM Plex Mono, monospace', color: confidence === 'high' ? '#22c55e' : confidence === 'missing' ? '#ef4444' : '#f59e0b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {isMissing ? 'missing' : confidence}
        </span>
      </div>
      <div style={{ fontSize: 13, color: isMissing ? '#f59e0b' : 'rgba(255,255,255,0.7)', marginBottom: 6 }}>{factValue(fact)}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <span style={{ fontSize: 10.5, fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(255,255,255,0.32)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fact.source?.label ?? fact.source_label ?? 'Source pending'}
        </span>
        {clickable && (
          <span style={{ marginLeft: 'auto', color: '#00b4a0', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', whiteSpace: 'nowrap' }}>
            View evidence
          </span>
        )}
      </div>
    </button>
  )
}

function ConfidenceLegend() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: 'rgba(255,255,255,0.48)', fontSize: 11.8, lineHeight: 1.45 }}>
      <span><strong style={{ color: '#22c55e' }}>High</strong> = source-backed exact value</span>
      <span><strong style={{ color: '#f59e0b' }}>Medium</strong> = extracted or inferred, needs review</span>
      <span><strong style={{ color: '#ef4444' }}>Missing</strong> = required evidence not found</span>
    </div>
  )
}

function MemoSection({ title, children, tone = 'default' }: { title: string; children: React.ReactNode; tone?: 'default' | 'missing' | 'action' }) {
  return (
    <section style={{
      borderTop: `1px solid ${tone === 'missing' ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.08)'}`,
      paddingTop: 18,
    }}>
      <h3 style={{
        fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
        color: tone === 'missing' ? '#f59e0b' : tone === 'action' ? '#22c55e' : '#00b4a0',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function ICMemoView({
  workflow,
  extracted,
  scored,
  onOpenEvidence,
}: {
  workflow: DealWorkflow
  extracted: ExtractedDeal
  scored: ScoredDeal
  onOpenEvidence: (fact: WorkflowFact) => void
}) {
  const scoredWithNext = scored as ScoredWithNextSteps
  const gate = workflow.valuation_gate
  const totalScore = typeof scored.total_score === 'number'
    ? scored.total_score
    : typeof scored.overall_score === 'number'
    ? scored.overall_score * 10
    : undefined
  const facts = workflow.facts ?? workflow.extracted_facts ?? []
  const classifiedFacts = facts.map(fact => ({ fact, classification: classifyFact(fact) }))
  const thesisFacts = classifiedFacts.filter(row => row.classification === 'thesis_positive').map(row => row.fact).slice(0, 6)
  const keyFacts = classifiedFacts.filter(row => row.classification === 'key_fact').map(row => row.fact).slice(0, 10)
  const riskFacts = classifiedFacts.filter(row => row.classification === 'risk_negative').map(row => row.fact).slice(0, 6)
  const blockerFacts = classifiedFacts.filter(row => row.classification === 'missing_evidence').map(row => row.fact).slice(0, 8)
  const risks = workflow.risks ?? []
  const warnings = workflow.extraction_warnings ?? []
  const requests = workflow.diligence_checklist ?? workflow.diligence_requests ?? []
  const marketAudit = workflow.market_audit ?? scored.market_audit
  const pipelineAudit = workflow.pipeline_audit ?? scored.pipeline_audit
  const pipelineProjects = workflow.pipeline_projects ?? scored.pipeline_projects
  const guard = workflow.narrative_guard
  const centreName = extracted.centre?.name ?? scored.centre_name ?? 'This centre'
  const verdictPlain = guard?.analyst_summary
    ?? scoredWithNext.next_steps?.verdict_plain
    ?? scored.verdict?.one_liner
    ?? scored.analyst_summary
    ?? 'Memo verdict pending further evidence.'
  const structuring = guard?.recommendation
    ?? scoredWithNext.next_steps?.deal_structuring_notes
    ?? (gate.can_show_confident_valuation
      ? 'Proceed only after confirming source documents and updating the IC pack with final diligence evidence.'
      : 'Do not underwrite price yet. Use a conditional process: request evidence first, then revisit valuation and structure.')
  const guardedValuationNote = guard?.valuation_note
  const guardedPipelineNote = guard?.pipeline_note
  const icDecision = guard?.recommendation ?? (gate.status === 'blocked'
    ? 'Pass unless financial evidence is provided. Authorise broker follow-up only.'
    : gate.status === 'needs_review'
    ? 'Investigate only with conditions. Keep valuation illustrative until open evidence is resolved.'
    : 'Proceed to IC review, subject to normal diligence confirmation.')
  const decision = guard?.recommendation ?? decisionLanguage(gate.status, totalScore)

  return (
    <section style={{
      background: '#132338', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, marginBottom: 28, overflow: 'hidden',
    }}>
      <div style={{ padding: '26px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: gate.status === 'blocked' ? 'rgba(239,68,68,0.08)' : 'rgba(0,180,160,0.035)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.36)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              IC Memo
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(24px, 4vw, 38px)', lineHeight: 1.1, color: '#fff', margin: 0 }}>
              {centreName}
            </h2>
          </div>
          <div style={{
            border: `1px solid ${gate.status === 'blocked' ? 'rgba(239,68,68,0.42)' : 'rgba(0,180,160,0.26)'}`,
            background: gate.status === 'blocked' ? 'rgba(239,68,68,0.12)' : 'rgba(0,180,160,0.08)',
            borderRadius: 8, padding: '10px 12px', minWidth: 190,
          }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: gate.status === 'blocked' ? '#ef4444' : '#00b4a0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              IC decision
            </div>
            <div style={{ color: '#fff', fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>
              {decision}
            </div>
          </div>
        </div>
        <div style={{
          background: gate.status === 'blocked' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.035)',
          border: `1px solid ${gate.status === 'blocked' ? 'rgba(239,68,68,0.38)' : 'rgba(255,255,255,0.08)'}`,
          borderLeft: `4px solid ${gate.status === 'blocked' ? '#ef4444' : '#00b4a0'}`,
          borderRadius: 8, padding: '16px 18px',
        }}>
          <div style={{ color: gate.status === 'blocked' ? '#fff' : 'rgba(255,255,255,0.86)', fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 800, lineHeight: 1.25, marginBottom: 8 }}>
            {gate.status === 'blocked'
              ? 'Cannot underwrite yet — valuation blocked pending financial evidence.'
              : verdictPlain}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.64)', fontSize: 14, lineHeight: 1.65 }}>
            {gate.status === 'blocked' ? verdictPlain : gate.message}
          </div>
          {!gate.can_show_confident_valuation && (
            <div style={{ marginTop: 10, color: '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Illustrative only — not underwritten
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 22, padding: '24px 26px' }}>
        <MemoSection title="1. Recommendation and Confidence">
          <div style={{ color: '#fff', fontSize: 15, lineHeight: 1.65, fontWeight: 700 }}>{icDecision}</div>
          <p style={{ color: 'rgba(255,255,255,0.66)', fontSize: 13.5, lineHeight: 1.7, margin: '10px 0 0' }}>{structuring}</p>
        </MemoSection>

        <MemoSection title="2. Key Red Flags / Conflicts" tone={riskFacts.length || warnings.length ? 'missing' : 'default'}>
          {risks.length || warnings.length || riskFacts.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {riskFacts.map(f => <FactPill key={f.id} fact={f} onOpen={onOpenEvidence} />)}
              {risks.slice(0, 5).map(r => (
                <div key={r.id} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ color: '#ef4444', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{r.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12.5, lineHeight: 1.55 }}>{r.reason ?? 'Risk requires review.'}</div>
                </div>
              ))}
              {warnings.slice(0, 4).map(w => (
                <div key={w.id} style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ color: '#f59e0b', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{w.field?.replace(/_/g, ' ') ?? 'Extraction warning'}</div>
                  <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12.5, lineHeight: 1.55 }}>{w.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>No major red flags or conflicts were generated.</p>
          )}
        </MemoSection>

        <MemoSection title="3. What Would Change The Recommendation" tone="action">
          {requests.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {requests.slice(0, 5).map(item => (
                <div key={item.id} style={{ color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 1.55, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                  <strong style={{ color: item.priority === 'high' ? '#ef4444' : '#f59e0b', marginRight: 8 }}>{item.priority.toUpperCase()}</strong>
                  {item.question || item.request}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>No recommendation-changing requests have been generated yet.</p>
          )}
        </MemoSection>

        <MemoSection title="4. Evidence Readiness">
          <EvidenceReadiness facts={facts} onOpen={onOpenEvidence} />
          <div style={{ marginTop: 12 }}><ConfidenceLegend /></div>
        </MemoSection>

        <MemoSection title="5. Investment Thesis">
          {thesisFacts.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {thesisFacts.map(f => <FactPill key={f.id} fact={f} onOpen={onOpenEvidence} />)}
            </div>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>No positive, underwriting-relevant thesis points are confirmed yet.</p>
          )}
        </MemoSection>

        <MemoSection title="6. Key Facts">
          {keyFacts.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {keyFacts.map(f => <FactPill key={f.id} fact={f} onOpen={onOpenEvidence} />)}
            </div>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>No source-backed key facts are confirmed yet.</p>
          )}
        </MemoSection>

        <MemoSection title="7. Derived Metrics and Recipes">
          {facts.filter(f => f.provenance === 'derived').length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {facts.filter(f => f.provenance === 'derived').slice(0, 8).map(fact => (
                <div key={`recipe-${fact.id}`} style={{ background: 'rgba(0,180,160,0.045)', border: '1px solid rgba(0,180,160,0.16)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{fact.label}: {factValue(fact)}</div>
                  <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12.3, lineHeight: 1.55, marginTop: 4 }}>
                    {fact.derivation_formula ?? fact.derivation_note ?? 'Derived from source evidence.'}
                    {periodLabel(fact) ? ` Period: ${periodLabel(fact)}.` : ''}
                    {fact.period?.coverage_reason ? ` ${fact.period.coverage_reason}` : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>No derived metrics are available yet.</p>
          )}
        </MemoSection>

        <MemoSection title="8. Market / Pipeline Evidence">
          <MarketAuditSummary audit={marketAudit} pipelineAudit={pipelineAudit} pipelineProjects={pipelineProjects} />
        </MemoSection>

        <MemoSection title="9. What Is Missing / Valuation Gate" tone={gate.can_show_confident_valuation ? 'default' : 'missing'}>
          <div style={{
            background: gate.status === 'blocked' ? 'rgba(239,68,68,0.1)' : gate.can_show_confident_valuation ? 'rgba(34,197,94,0.07)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${gate.status === 'blocked' ? 'rgba(239,68,68,0.34)' : gate.can_show_confident_valuation ? 'rgba(34,197,94,0.22)' : 'rgba(245,158,11,0.22)'}`,
            borderRadius: 8, padding: '14px 16px', color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 1.65, marginBottom: 12,
          }}>
            {gate.status === 'blocked'
              ? guardedValuationNote ?? 'Cannot underwrite yet - valuation blocked pending financial evidence.'
              : guardedValuationNote ?? gate.message}
            {!gate.can_show_confident_valuation && (
              <div style={{ marginTop: 8, color: '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, textTransform: 'uppercase' }}>
                Illustrative only - not underwritten
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {gate.blockers.map(b => (
              <div key={b.field} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 12px', color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 1.55 }}>
                <strong style={{ color: '#f59e0b', display: 'block', marginBottom: 3 }}>{b.reason}</strong>
                {b.required_evidence}
              </div>
            ))}
            {workflow.missing_fields.slice(0, 10).map(field => (
              <div key={field} style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12.5, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' }}>
                Required evidence missing: {field.replace(/_/g, ' ')}
              </div>
            ))}
            {blockerFacts.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 6 }}>
                {blockerFacts.map(f => <FactPill key={f.id} fact={f} onOpen={onOpenEvidence} />)}
              </div>
            )}
          </div>
        </MemoSection>

        <MemoSection title="10. Broker / Seller Request List" tone="action">
          {requests.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {requests.slice(0, 8).map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '82px 1fr', gap: 12, color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 1.55, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                  <span style={{ color: item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#00b4a0', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', fontSize: 11, fontWeight: 700 }}>
                    {item.priority}
                  </span>
                  <span>
                    <strong style={{ color: 'rgba(255,255,255,0.86)' }}>Request: </strong>
                    {item.question || item.request}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>No broker requests have been generated yet.</p>
          )}
        </MemoSection>

        <MemoSection title="11. Appendix / Extraction Ledger">
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>
            Material facts carry provenance, trust, underwriting use, source refs, extractor version, and prompt version for run-scoped review.
          </p>
          {guardedPipelineNote && pipelineAudit?.search_required && (
            <p style={{ color: '#f59e0b', fontSize: 12.5, lineHeight: 1.6, margin: '10px 0 0' }}>{guardedPipelineNote}</p>
          )}
          {guard?.market_note && (
            <p style={{ color: '#f59e0b', fontSize: 12.5, lineHeight: 1.6, margin: '10px 0 0' }}>{guard.market_note}</p>
          )}
        </MemoSection>
      </div>
    </section>
  )
}
