'use client'

import type React from 'react'
import type { DealWorkflow, WorkflowFact } from '@/types/workflow'

export type ReportMode = 'decision' | 'memo' | 'underwriting' | 'evidence' | 'diligence' | 'runs'

function workflowFacts(workflow?: DealWorkflow | null): WorkflowFact[] {
  return workflow?.facts ?? workflow?.extracted_facts ?? workflow?.evidence_ledger ?? []
}

function evidenceReadinessCounts(workflow?: DealWorkflow | null) {
  const facts = workflowFacts(workflow)
  return {
    accepted: facts.filter(f => f.underwriting_use === 'accepted').length,
    derived: facts.filter(f => f.provenance === 'derived').length,
    review: facts.filter(f => f.underwriting_use === 'review_required' && f.trust !== 'disputed').length,
    missing: facts.filter(f => f.underwriting_use === 'blocked' || f.blocker || f.confidence === 'missing' || f.value == null || f.value === '').length,
    conflicting: facts.filter(f => f.trust === 'disputed' || f.conflicts?.length).length,
    excluded: facts.filter(f => f.underwriting_use === 'excluded').length,
  }
}

function decisionStatus(workflow: DealWorkflow | null | undefined, score: number): { label: string; tone: 'green' | 'amber' | 'red'; reason: string } {
  if (workflow?.valuation_gate?.status === 'blocked') {
    return { label: 'Blocked', tone: 'red', reason: 'Valuation cannot be relied on until required evidence is provided.' }
  }
  if (workflow?.valuation_gate?.status === 'needs_review') {
    return { label: 'Proceed with caution', tone: 'amber', reason: 'Underwriting is possible, but confidence depends on resolving review items.' }
  }
  if (score >= 62) return { label: 'Proceed to diligence', tone: 'green', reason: 'Current score supports a diligence-led next step.' }
  if (score >= 42) return { label: 'Proceed with caution', tone: 'amber', reason: 'There is enough signal to investigate, but risks or evidence gaps remain.' }
  return { label: 'Do not proceed', tone: 'red', reason: 'Current score is below the threshold for a live acquisition process.' }
}

function confidenceFromWorkflow(workflow: DealWorkflow | null | undefined, score: number): { label: 'High' | 'Medium' | 'Low'; tone: 'green' | 'amber' | 'red' } {
  const quality = workflow?.evidence_quality
  const reliability = String(quality?.underwriting_reliability ?? '').toLowerCase()
  const extraction = String(quality?.extraction_completeness ?? '').toLowerCase()
  if (workflow?.valuation_gate?.status === 'blocked' || reliability.includes('blocked')) return { label: 'Low', tone: 'red' }
  if (reliability.includes('review') || extraction.includes('low') || score < 52) return { label: 'Low', tone: 'red' }
  if (quality?.evidence_quality === 'High' && score >= 62) return { label: 'High', tone: 'green' }
  return { label: 'Medium', tone: 'amber' }
}

function firstActionableText(workflow?: DealWorkflow | null): string {
  const diligence = [
    ...(workflow?.diligence_requests ?? []),
    ...(workflow?.diligence_checklist ?? []),
  ]
  const critical = diligence.find(item => item.priority === 'high' && !['received', 'verified', 'waived'].includes(item.status))
  if (critical) return critical.request || critical.question
  const blocker = workflowFacts(workflow).find(f => f.next_action || f.blocker || f.confidence === 'missing')
  if (blocker?.next_action) return blocker.next_action
  if (blocker) return `Request source evidence for ${blocker.label}.`
  const gateBlocker = workflow?.valuation_gate?.blockers?.[0]
  if (gateBlocker) return gateBlocker.required_evidence || gateBlocker.reason
  return 'Review the memo, confirm evidence quality, and progress priority diligence requests.'
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return 'Not available'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('en-AU')}`
}

function displayFactValue(fact: WorkflowFact): string {
  if (fact.value == null || fact.value === '') return 'Missing'
  if (fact.unit === 'aud' && typeof fact.value === 'number') return fmtMoney(fact.value)
  if (fact.unit === 'percent' && typeof fact.value === 'number') return `${fact.value.toLocaleString('en-AU', { maximumFractionDigits: 1 })}%`
  return String(fact.value)
}

function compactFactLabel(fact: WorkflowFact): string {
  const value = displayFactValue(fact)
  return value === 'Missing' ? fact.label : `${fact.label}: ${value}`
}

function toneColor(tone: 'green' | 'amber' | 'red') {
  return tone === 'green' ? '#22c55e' : tone === 'amber' ? '#f59e0b' : '#ef4444'
}

function SmallActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="no-print"
      style={{
        border: '1px solid rgba(0,180,160,0.25)',
        background: 'rgba(0,180,160,0.08)',
        color: '#00b4a0',
        borderRadius: 6,
        padding: '7px 10px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function DecisionMetricCard({ label, value, tone, note }: { label: string; value: string | number; tone?: 'green' | 'amber' | 'red'; note?: string }) {
  const color = tone ? toneColor(tone) : '#e8edf3'
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      padding: 16,
      minHeight: 112,
    }}>
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 10.5,
        color: 'rgba(255,255,255,0.36)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', color, fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </div>
      {note && <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.46)', fontSize: 12.5, lineHeight: 1.45 }}>{note}</div>}
    </div>
  )
}

function DecisionList({
  title,
  items,
  empty,
}: {
  title: string
  items: string[]
  empty: string
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      padding: 16,
    }}>
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 10.5,
        color: 'rgba(255,255,255,0.38)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 10,
      }}>
        {title}
      </div>
      {items.length ? (
        <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, index) => (
            <li key={`${title}-${index}`} style={{ color: 'rgba(255,255,255,0.66)', fontSize: 13, lineHeight: 1.5 }}>{item}</li>
          ))}
        </ol>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>{empty}</div>
      )}
    </div>
  )
}

export default function DecisionDashboard({
  workflow,
  score,
  verdict,
  onNavigate,
}: {
  workflow: DealWorkflow
  score: number
  verdict: string
  onNavigate: (mode: ReportMode) => void
}) {
  const status = decisionStatus(workflow, score)
  const confidence = confidenceFromWorkflow(workflow, score)
  const counts = evidenceReadinessCounts(workflow)
  const valuationTone = workflow.valuation_gate.status === 'pass' ? 'green' : workflow.valuation_gate.status === 'needs_review' ? 'amber' : 'red'
  const valuationLabel = workflow.valuation_gate.status === 'pass'
    ? 'Valuation available'
    : workflow.valuation_gate.status === 'needs_review'
    ? 'Valuation needs review'
    : 'Valuation blocked'
  const facts = workflowFacts(workflow)
  const blockers = [
    ...workflow.valuation_gate.blockers.map(blocker => `${blocker.field}: ${blocker.reason}`),
    ...facts.filter(f => f.blocker || f.confidence === 'missing' || f.underwriting_use === 'blocked').map(compactFactLabel),
  ].slice(0, 5)
  const risks = (workflow.risks ?? []).map(risk => risk.title || risk.reason || risk.id).slice(0, 5)
  const missing = [
    ...(workflow.missing_fields ?? []),
    ...facts.filter(f => f.confidence === 'missing' || f.value == null || f.value === '').map(f => f.label),
  ].filter(Boolean).slice(0, 5)

  return (
    <section style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: 22,
      marginBottom: 36,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            color: 'rgba(255,255,255,0.36)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            Investment Decision Dashboard
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, margin: '0 0 8px', color: '#e8edf3' }}>
            {status.label}
          </h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.58)', maxWidth: 720, lineHeight: 1.65 }}>
            {status.reason} Use this dashboard first, then move through Memo, Underwriting, Evidence, Diligence, and Run History.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignContent: 'flex-start' }}>
          <SmallActionButton onClick={() => onNavigate('memo')}>Read memo</SmallActionButton>
          <SmallActionButton onClick={() => onNavigate('underwriting')}>View logic</SmallActionButton>
          <SmallActionButton onClick={() => onNavigate('evidence')}>Check evidence</SmallActionButton>
          <SmallActionButton onClick={() => onNavigate('diligence')}>Open actions</SmallActionButton>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 18 }}>
        <DecisionMetricCard label="Decision status" value={status.label} tone={status.tone} note={verdict} />
        <DecisionMetricCard label="Confidence" value={confidence.label} tone={confidence.tone} note={workflow.evidence_quality?.reason ?? workflow.valuation_gate.reason} />
        <DecisionMetricCard label="Valuation readiness" value={valuationLabel} tone={valuationTone} note={workflow.valuation_gate.message} />
        <DecisionMetricCard
          label="Evidence readiness"
          value={`${counts.accepted} accepted`}
          tone={counts.missing || counts.conflicting ? 'amber' : 'green'}
          note={`${counts.review} review · ${counts.missing} missing · ${counts.conflicting} conflicting · ${counts.excluded} excluded`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 18 }}>
        <DecisionList title="Top blockers" items={blockers} empty="No hard blockers surfaced in the current workflow." />
        <DecisionList title="Top risks" items={risks} empty="No risk list is present in the current workflow payload." />
        <DecisionList title="Missing evidence" items={missing} empty="No missing evidence list is present in the current workflow payload." />
      </div>

      <div style={{
        background: 'rgba(0,180,160,0.06)',
        border: '1px solid rgba(0,180,160,0.18)',
        borderRadius: 8,
        padding: '16px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, color: '#00b4a0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
            Next best action
          </div>
          <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: 14, lineHeight: 1.55 }}>
            {firstActionableText(workflow)}
          </div>
        </div>
        <SmallActionButton onClick={() => onNavigate('diligence')}>Go to Diligence</SmallActionButton>
      </div>
    </section>
  )
}
