'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import EvidenceDrawer from '@/components/report/EvidenceDrawer'
import ICPackExport from '@/components/report/ICPackExport'
import ICMemoView from '@/components/report/ICMemoView'
import RunVersionBanner from '@/components/report/RunVersionBanner'
import type { ExtractedDeal } from '@/types/extracted'
import type { ScoredDeal } from '@/types/scored'
import type { UnderwritingRun, UnderwritingRunSummary } from '@/types/runs'
import type { DealWorkflow, WorkflowFact } from '@/types/workflow'

export default function RunSnapshotView({
  run,
  summary,
  currentRun,
  onReturnToCurrent,
  onPromote,
  promoting,
}: {
  run: UnderwritingRun
  summary: UnderwritingRunSummary
  currentRun?: UnderwritingRunSummary | null
  onReturnToCurrent: () => void
  onPromote?: (summary: UnderwritingRunSummary) => void | Promise<void>
  promoting?: boolean
}) {
  const [evidenceFact, setEvidenceFact] = useState<WorkflowFact | null>(null)
  const extracted = run.extracted as ExtractedDeal
  const scored = run.scored as ScoredDeal
  const workflow = run.workflow as DealWorkflow
  const centre = extracted?.centre
  const canExport = summary.status === 'completed' && Boolean(extracted && scored && workflow)
  const score = typeof scored?.total_score === 'number'
    ? scored.total_score
    : typeof scored?.overall_score === 'number'
    ? scored.overall_score * 10
    : null

  return (
    <main style={{ minHeight: '100vh', background: '#0d1b2a', color: '#e8edf3', padding: '28px clamp(18px, 4vw, 40px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 14,
          alignItems: 'center',
          flexWrap: 'wrap',
          border: '1px solid rgba(245,158,11,0.28)',
          background: 'rgba(245,158,11,0.08)',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 18,
        }}>
          <div>
            <div style={{ color: '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Historical underwriting snapshot
            </div>
            <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.45 }}>
              Viewing run #{summary.run_number}. The current deal report is still {currentRun ? `run #${currentRun.run_number}` : 'the promoted current run'}.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onReturnToCurrent} style={buttonStyle('secondary', false)}>
              Return to current report
            </button>
            {canExport && (
              <button type="button" onClick={() => window.print()} style={buttonStyle('secondary', false)}>
                Export historical IC Pack
              </button>
            )}
            {summary.status === 'completed' && !summary.is_current && onPromote && (
              <button type="button" disabled={promoting} onClick={() => onPromote(summary)} style={buttonStyle('primary', Boolean(promoting))}>
                {promoting ? 'Promoting...' : 'Promote this run'}
              </button>
            )}
          </div>
        </div>

        <section style={{
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.025)',
          borderRadius: 8,
          padding: '22px 24px',
          marginBottom: 18,
        }}>
          <div style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Snapshot report
          </div>
          <h1 style={{ margin: 0, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 5vw, 42px)', lineHeight: 1.08 }}>
            {centre?.name || scored?.centre_name || 'Historical underwriting run'}
          </h1>
          <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: 14, marginTop: 8 }}>
            {[centre?.address, centre?.licensed_places ? `${centre.licensed_places} licensed places` : null, score != null ? `Score ${score.toFixed(1)}/100` : null].filter(Boolean).join(' · ')}
          </div>
        </section>

        <RunVersionBanner
          currentRun={summary}
          currentRunSnapshot={run}
          mode="historical"
          currentRunLabel={currentRun ? `run #${currentRun.run_number}` : null}
        />

        {canExport && (
          <ICPackExport
            extracted={extracted}
            scored={scored}
            workflow={workflow}
            currentRun={summary}
            currentRunSnapshot={run}
            mode="historical"
            currentRunLabel={currentRun ? `Run #${currentRun.run_number}` : null}
          />
        )}

        <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 14, marginBottom: 18, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, lineHeight: 1.5 }}>
          Diligence workspace and edit/rescore controls are hidden in historical mode. This snapshot is read-only unless explicitly promoted.
        </div>

        {workflow && extracted && scored ? (
          <ICMemoView
            workflow={workflow}
            extracted={extracted}
            scored={scored}
            onOpenEvidence={setEvidenceFact}
          />
        ) : (
          <div style={{ border: '1px solid rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: 14, color: '#ef4444' }}>
            This run does not contain a complete extracted/scored/workflow snapshot.
          </div>
        )}

        <EvidenceDrawer
          fact={evidenceFact}
          evidence={workflow?.evidence ?? []}
          runId={run.id}
          runLabel={`Evidence from run #${summary.run_number}`}
          onClose={() => setEvidenceFact(null)}
        />
        <style>{historicalPrintStyles}</style>
      </div>
    </main>
  )
}

function buttonStyle(kind: 'primary' | 'secondary', disabled: boolean): CSSProperties {
  return {
    border: kind === 'primary' ? '1px solid rgba(0,180,160,0.32)' : '1px solid rgba(255,255,255,0.14)',
    background: disabled ? 'rgba(255,255,255,0.04)' : kind === 'primary' ? 'rgba(0,180,160,0.12)' : 'rgba(255,255,255,0.04)',
    color: disabled ? 'rgba(255,255,255,0.32)' : kind === 'primary' ? '#00b4a0' : '#e8edf3',
    borderRadius: 6,
    padding: '8px 12px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
  }
}

const historicalPrintStyles = `
  .ic-pack-export { display: none; }

  @media print {
    @page { margin: 16mm 18mm; size: A4; }
    @page :first { margin: 14mm 18mm 16mm; }

    html, body {
      background: #fff !important;
      color: #1a2b3c !important;
      font-family: 'IBM Plex Sans', 'Inter', 'Segoe UI', Arial, sans-serif !important;
      font-size: 10pt !important;
      line-height: 1.5 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    * {
      background-color: transparent !important;
      border-color: #e2e8f0 !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    .no-print,
    main > div > section:not(.ic-pack-export),
    main > div > div:not(.ic-pack-export),
    main > div > article:not(.ic-pack-export) {
      display: none !important;
    }
    .ic-pack-export {
      display: block !important;
      color: #172033 !important;
      font-family: 'IBM Plex Sans', 'Inter', 'Segoe UI', Arial, sans-serif !important;
      font-size: 9.6pt !important;
      line-height: 1.45 !important;
    }
    .ic-pack-cover {
      min-height: 170mm;
      display: grid !important;
      grid-template-rows: 1fr auto;
      border-bottom: 4px solid #0f766e !important;
      padding: 12mm 0 14mm !important;
      page-break-after: always;
      break-after: page;
      break-inside: avoid;
    }
    .ic-pack-brand {
      color: #0f766e !important;
      font: 700 10pt 'IBM Plex Mono', monospace !important;
      letter-spacing: 0.12em !important;
      text-transform: uppercase !important;
      margin-bottom: 18mm !important;
    }
    .ic-pack-cover h1 {
      color: #0d1b2a !important;
      font: 700 32pt/1.05 'Space Grotesk','Segoe UI',Arial,sans-serif !important;
      margin: 0 0 7mm !important;
      max-width: 150mm !important;
    }
    .ic-pack-cover p {
      color: #475569 !important;
      font-size: 12pt !important;
      max-width: 130mm !important;
    }
    .ic-pack-decision {
      border: 1px solid #99f6e4 !important;
      border-left: 5px solid #0f766e !important;
      background-color: #f0fdfa !important;
      padding: 8mm !important;
      break-inside: avoid;
    }
    .ic-pack-decision-blocked {
      border-color: #fecaca !important;
      border-left-color: #dc2626 !important;
      background-color: #fef2f2 !important;
    }
    .ic-pack-decision span,
    .ic-pack-section-kicker,
    .ic-pack-label,
    .ic-pack-kv-label {
      font-family: 'IBM Plex Mono', monospace !important;
      letter-spacing: 0.08em !important;
      text-transform: uppercase !important;
    }
    .ic-pack-decision span {
      color: #64748b !important;
      font-size: 8pt !important;
    }
    .ic-pack-decision strong {
      display: block !important;
      margin-top: 2mm !important;
      color: #0f172a !important;
      font-size: 18pt !important;
      line-height: 1.15 !important;
    }
    .ic-pack-decision em {
      display: block !important;
      margin-top: 3mm !important;
      color: #991b1b !important;
      font-style: normal !important;
      font-weight: 700 !important;
      line-height: 1.35 !important;
    }
    .ic-pack-section {
      padding: 0 0 9mm !important;
      margin: 0 0 8mm !important;
      border-bottom: 1px solid #e2e8f0 !important;
      break-inside: auto;
      page-break-inside: auto;
    }
    .ic-pack-section-break {
      page-break-before: always;
      break-before: page;
    }
    .ic-pack-section h2 {
      color: #0d1b2a !important;
      font: 700 17pt 'Space Grotesk','Segoe UI',Arial,sans-serif !important;
      margin: 1mm 0 5mm !important;
      break-after: avoid;
      page-break-after: avoid;
    }
    .ic-pack-section-kicker {
      color: #0f766e !important;
      font-size: 8pt !important;
      font-weight: 700 !important;
      break-after: avoid;
      page-break-after: avoid;
    }
    .ic-pack-alert {
      border: 1px solid #99f6e4 !important;
      border-left: 4px solid #0f766e !important;
      background-color: #f0fdfa !important;
      border-radius: 6px !important;
      padding: 5mm !important;
      margin-bottom: 5mm !important;
      break-inside: avoid;
    }
    .ic-pack-alert-red {
      border-color: #fecaca !important;
      border-left-color: #dc2626 !important;
      background-color: #fef2f2 !important;
    }
    .ic-pack-alert strong {
      display: block !important;
      color: #0f172a !important;
      font-size: 12pt !important;
      margin-bottom: 2mm !important;
    }
    .ic-pack-alert p,
    .ic-pack-section p {
      color: #334155 !important;
      margin: 0 0 4mm !important;
    }
    .ic-pack-label {
      display: inline-block !important;
      color: #b45309 !important;
      background-color: #fffbeb !important;
      border: 1px solid #fcd34d !important;
      border-radius: 4px !important;
      padding: 1.5mm 2.5mm !important;
      font-size: 7.5pt !important;
      font-weight: 700 !important;
    }
    .ic-pack-grid-4 {
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      gap: 3mm !important;
      margin-bottom: 5mm !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ic-pack-kv {
      border: 1px solid #e2e8f0 !important;
      border-radius: 5px !important;
      background-color: #f8fafc !important;
      padding: 3mm !important;
      min-height: 18mm !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ic-pack-kv-label {
      color: #64748b !important;
      font-size: 7pt !important;
      margin-bottom: 1.5mm !important;
    }
    .ic-pack-kv-value {
      color: #0f172a !important;
      font-weight: 800 !important;
      font-size: 11pt !important;
    }
    .ic-pack-kv-note,
    .ic-pack-muted {
      color: #64748b !important;
      font-size: 8.5pt !important;
    }
    .ic-pack-table {
      display: grid !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 6px !important;
      overflow: hidden !important;
      break-inside: auto;
      page-break-inside: auto;
    }
    .ic-pack-table-head,
    .ic-pack-table-row {
      display: grid !important;
      grid-template-columns: 1.1fr 0.75fr 1.25fr !important;
      gap: 3mm !important;
      padding: 2.8mm 3.2mm !important;
      border-bottom: 1px solid #e2e8f0 !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ic-pack-table-head {
      background-color: #f1f5f9 !important;
      color: #475569 !important;
      font: 700 7.5pt 'IBM Plex Mono', monospace !important;
      text-transform: uppercase !important;
      letter-spacing: 0.06em !important;
      break-after: avoid;
      page-break-after: avoid;
    }
    .ic-pack-table-row strong {
      color: #0f172a !important;
    }
    .ic-pack-row-warning {
      background-color: #fffbeb !important;
    }
    .ic-pack-list {
      display: grid !important;
      gap: 2.5mm !important;
      break-inside: auto;
      page-break-inside: auto;
    }
    .ic-pack-list-item {
      border: 1px solid #e2e8f0 !important;
      border-left: 4px solid #0f766e !important;
      border-radius: 5px !important;
      padding: 3mm !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .ic-pack-risk,
    .ic-pack-missing {
      border-left-color: #dc2626 !important;
      background-color: #fff7ed !important;
    }
    .ic-pack-request {
      border-left-color: #0f766e !important;
      background-color: #f8fafc !important;
    }
    .ic-pack-list-item strong {
      display: block !important;
      color: #0f172a !important;
      margin-bottom: 1mm !important;
    }
    .ic-pack-list-item span {
      color: #475569 !important;
      font-size: 8.5pt !important;
    }
    .ic-pack-footer {
      display: block !important;
      border-top: 1px solid #e2e8f0 !important;
      padding-top: 3mm !important;
      color: #64748b !important;
      font: 8pt 'IBM Plex Mono', monospace !important;
      break-inside: avoid;
    }
  }
`
