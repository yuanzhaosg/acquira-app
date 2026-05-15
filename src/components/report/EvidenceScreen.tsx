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

function EvidenceLensCard({ title, body, note }: { title: string; body: string; note: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      padding: '14px 15px',
      minHeight: 146,
    }}>
      <div style={{ color: '#e8edf3', fontSize: 13.5, fontWeight: 800, marginBottom: 7 }}>
        {title}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: 12.5, lineHeight: 1.6, marginBottom: 8 }}>
        {body}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11.5, lineHeight: 1.45 }}>
        {note}
      </div>
    </div>
  )
}

function MarketEvidenceGuide({ marketAudit }: { marketAudit?: MarketAudit | null }) {
  const publicBenchmark = marketAudit?.public_market_benchmark
  const localDemandSupply = marketAudit?.local_demand_supply
  const edr = marketAudit?.edr?.value

  return (
    <section style={{
      background: 'rgba(0,180,160,0.055)',
      border: '1px solid rgba(0,180,160,0.16)',
      borderRadius: 8,
      padding: '16px 18px',
      marginBottom: 26,
    }}>
      <SectionTitle>How to read market evidence</SectionTitle>
      <p style={{ color: 'rgba(255,255,255,0.68)', fontSize: 13.5, lineHeight: 1.7, margin: '0 0 14px' }}>
        These metrics are not interchangeable. EDR is an internal capacity screen, while CCS benchmark data shows public aggregate market evidence and realised CCS usage at SA3 level. Competitive Map data shows local supply context. Use them together to understand market pressure; do not treat any one metric as target-level occupancy evidence.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        <EvidenceLensCard
          title="EDR / internal screen"
          body={`Internal capacity screen based on available children, utilisation assumptions, and licensed or approved places. Current value: ${formatMarketNumber(edr)}.`}
          note="Useful for market pressure context, not a standalone target claim."
        />
        <EvidenceLensCard
          title="Public CCS benchmark"
          body={`Public aggregate market evidence for ${publicBenchmark?.sa3_name ?? 'the selected SA3'} showing realised CCS usage and CBDC pricing benchmark context.`}
          note={`Quarter: ${publicBenchmark?.as_of_quarter ?? 'not available'}. CBDC services: ${formatMarketNumber(publicBenchmark?.cbdc_services)}.`}
        />
        <EvidenceLensCard
          title="Competitive Map"
          body="Local competitor and supply context around the target address, where mapping inputs are available."
          note="Use this to review nearby operators, supply density, and catchment assumptions."
        />
        <EvidenceLensCard
          title="Supply Map / pipeline"
          body={`Local supply and future supply pressure from approved, lodged, or risk-adjusted pipeline places. Current signal: ${localDemandSupply?.market_capacity_signal ?? 'not available'}.`}
          note="Pipeline evidence helps explain future pressure and should be checked against source documents."
        />
      </div>
    </section>
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
      <MarketEvidenceGuide marketAudit={marketAudit} />
      <ExtractionWarnings workflow={workflow} />
      <MarketAuditPanel
        audit={marketAudit}
        pipelineAudit={workflow.pipeline_audit ?? scored.pipeline_audit}
        pipelineProjects={workflow.pipeline_projects ?? scored.pipeline_projects}
      />
      <PublicMarketContextPanel marketAudit={marketAudit} />
      {extracted.centre?.address && (
        <div style={{ marginBottom: 34 }}>
          <SectionTitle>Competitive Map</SectionTitle>
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
      <FactsReviewPanel workflow={workflow} onOpenEvidence={onOpenEvidence} />
    </div>
  )
}
