'use client'

import CompetitiveMap from '@/components/map/CompetitiveMap'
import ExtractionWarnings from '@/components/report/ExtractionWarnings'
import FactsReviewPanel from '@/components/report/FactsReviewPanel'
import MarketAuditPanel from '@/components/report/MarketAuditPanel'
import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'
import type { DealWorkflow, MarketAudit, PipelineProject, WorkflowFact } from '@/types/workflow'
import type React from 'react'

type MapPipelineApplication = {
  address: string
  description: string
  status: 'approved' | 'lodged' | 'refused' | 'unknown'
  places?: number | null
  distance_km?: number | null
  date?: string
  info_url?: string
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 11,
      color: 'rgba(255,255,255,0.36)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function formatMarketNumber(value: number | null | undefined, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return 'Not available'
  return `${value.toLocaleString('en-AU', { maximumFractionDigits: 2 })}${suffix}`
}


function MarketEvidenceFootnotes({ marketAudit }: { marketAudit?: MarketAudit | null }) {
  const publicBenchmark = marketAudit?.public_market_benchmark
  const localDemandSupply = marketAudit?.local_demand_supply
  const edr = marketAudit?.edr?.value
  const note: React.CSSProperties = { display: 'flex', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55, marginBottom: 8 }
  const id: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, fontWeight: 600, minWidth: 26, color: '#00b4a0' }
  return (
    <div style={{ marginBottom: 34, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <SectionTitle>Footnotes · how to read market evidence</SectionTitle>
      <div style={note}>
        <span style={id}>F2</span>
        <span><strong style={{ color: 'rgba(255,255,255,0.72)' }}>EDR (internal capacity screen). </strong>
          Children 0-4 × LDC utilisation midpoint ÷ licensed places; ≥1.0 undersupplied · 0.5–1.0 balanced · &lt;0.5 oversupplied. Current value: {formatMarketNumber(edr)}. A market-pressure screen, not target-level occupancy evidence.</span>
      </div>
      <div style={note}>
        <span style={id}>F3</span>
        <span><strong style={{ color: 'rgba(255,255,255,0.72)' }}>Public CCS benchmark. </strong>
          Public aggregate market evidence for {publicBenchmark?.sa3_name ?? 'the selected SA3'} (realised CCS usage, CBDC pricing) — a different dataset from the internal screen, not interchangeable with it. Quarter: {publicBenchmark?.as_of_quarter ?? 'not available'}.</span>
      </div>
      <div style={note}>
        <span style={id}>F4</span>
        <span><strong style={{ color: 'rgba(255,255,255,0.72)' }}>Supply &amp; pipeline. </strong>
          The competitive map plots the same supply set scored above (local supply context) — it is not a second count. The future supply pressure signal is {localDemandSupply?.market_capacity_signal ?? 'not available'}; check pipeline against source documents.</span>
      </div>
    </div>
  )
}


function PublicMarketContextPanel({ marketAudit }: { marketAudit?: MarketAudit | null }) {
  const publicBenchmark = marketAudit?.public_market_benchmark
  const localDemandSupply = marketAudit?.local_demand_supply
  if (!publicBenchmark && !localDemandSupply) return null

  return (
    <div style={{
      background: 'rgba(0,180,160,0.055)',
      border: '1px solid rgba(0,180,160,0.16)',
      borderRadius: 8,
      padding: '16px 18px',
      marginBottom: 28,
    }}>
      <SectionTitle>Public Market Context</SectionTitle>
      <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13, lineHeight: 1.65, margin: '0 0 14px' }}>
        Public market context is shown as supporting market benchmark evidence only. It is not source-document evidence for this target centre.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {publicBenchmark && (
          <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 14 }}>
            <div style={{ color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Public Market Benchmark
            </div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 800, lineHeight: 1.35, marginBottom: 8 }}>
              {publicBenchmark.sa3_name ?? publicBenchmark.sa3_code ?? 'SA3 benchmark'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12.5, lineHeight: 1.6 }}>
              {publicBenchmark.as_of_quarter ? `${publicBenchmark.as_of_quarter} · ` : ''}
              public aggregate market evidence · realised CCS usage · CBDC pricing benchmark
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12.5 }}>
                Children 0-5 using care: <strong style={{ color: '#fff' }}>{formatMarketNumber(publicBenchmark.children_0_5_using_care)}</strong>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12.5 }}>
                CBDC services: <strong style={{ color: '#fff' }}>{formatMarketNumber(publicBenchmark.cbdc_services)}</strong>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12.5 }}>
                Mean fee: <strong style={{ color: '#fff' }}>{formatMarketNumber(publicBenchmark.cbdc_mean_fee_per_hour, '/hr')}</strong>
              </div>
            </div>
          </div>
        )}
        {localDemandSupply && (
          <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 14 }}>
            <div style={{ color: '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Local Capacity Screen
            </div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 800, lineHeight: 1.35, marginBottom: 8 }}>
              {localDemandSupply.market_capacity_signal ?? 'Capacity screen'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: 12.5, lineHeight: 1.6 }}>
              This is a capacity screen using supplied market inputs. It remains absent unless explicitly supplied.
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12.5 }}>
                Current child / approved place: <strong style={{ color: '#fff' }}>{formatMarketNumber(localDemandSupply.current_child_per_place)}</strong>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12.5 }}>
                Future child / approved place: <strong style={{ color: '#fff' }}>{formatMarketNumber(localDemandSupply.future_child_per_place)}</strong>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 12.5 }}>
                Future supply pressure: <strong style={{ color: '#fff' }}>{formatMarketNumber(localDemandSupply.future_supply_places, ' places')}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function pipelineApplications(projects: PipelineProject[]): MapPipelineApplication[] {
  return projects.map(project => ({
    address: project.address || '',
    description: project.notes || project.name || `${project.source_type === 'manual_legacy_count' ? 'Legacy count placeholder' : 'Underwriting-backed'} pipeline project`,
    status: project.status === 'approved' || project.status === 'under_construction'
      ? 'approved'
      : project.status === 'lodged'
      ? 'lodged'
      : project.status === 'refused' || project.status === 'withdrawn'
      ? 'refused'
      : 'unknown',
    places: project.proposed_places ?? null,
    distance_km: project.distance_km ?? null,
    date: project.source_date ?? undefined,
    info_url: project.source_url ?? undefined,
  }))
}

export default function EvidenceScreen({
  workflow,
  extracted,
  scored,
  canonicalScore,
  mapPipelineProjects,
  onOpenEvidence,
}: {
  workflow: DealWorkflow
  extracted: ExtractedDeal
  scored: ScoredDeal
  canonicalScore: number
  mapPipelineProjects: PipelineProject[]
  onOpenEvidence: (fact: WorkflowFact) => void
}) {
  const marketAudit = workflow.market_audit ?? scored.market_audit

  return (
    <div style={{
      marginBottom: 34,
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      padding: 18,
    }}>
      <ExtractionWarnings workflow={workflow} />
      <MarketAuditPanel
        audit={marketAudit}
        pipelineAudit={workflow.pipeline_audit ?? scored.pipeline_audit}
        pipelineProjects={workflow.pipeline_projects ?? scored.pipeline_projects}
      />
      {extracted.centre?.address && (
        <div style={{ marginBottom: 34 }}>
          <SectionTitle>Competitive map — the supply set above, not a second count</SectionTitle>
          <CompetitiveMap
            address={extracted.centre.address}
            suburb={extracted.centre.suburb || ''}
            state={extracted.centre.state || ''}
            postcode={extracted.centre.postcode || ''}
            licensed_places={extracted.centre.licensed_places || 0}
            centre_name={scored.centre_name || ''}
            overall_score={canonicalScore}
            marketAudit={marketAudit}
            legacyMarket={{
              ...((scored as any).market_context ?? {}),
              ...((scored as any).demand_context ?? {}),
              source: (scored as any).market_context ? 'scored market context' : 'scored demand context',
            }}
            pipelineIntel={mapPipelineProjects.length ? {
              applications: pipelineApplications(mapPipelineProjects),
            } : ((scored as any).pipeline_intel ?? null)}
          />
        </div>
      )}
      <PublicMarketContextPanel marketAudit={marketAudit} />
      <MarketEvidenceFootnotes marketAudit={marketAudit} />
      <FactsReviewPanel workflow={workflow} onOpenEvidence={onOpenEvidence} />
    </div>
  )
}
