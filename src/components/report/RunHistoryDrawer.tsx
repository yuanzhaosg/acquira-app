'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/useAuth'
import type { DealSourceDocument, UnderwritingRun, UnderwritingRunSummary } from '@/types/runs'
import RunDiffSummary from '@/components/report/RunDiffSummary'
import ReunderwriteModal, { type ReunderwriteDocument } from '@/components/report/ReunderwriteModal'
import RunComparisonView from '@/components/report/RunComparisonView'

type DiligenceDocumentSummary = ReunderwriteDocument

interface DealOpsHealth {
  stale_running_runs?: unknown[]
  pending_source_document_count?: number
  newer_docs_than_current_run_count?: number
  warnings?: string[]
}

function fmtDate(value?: string | null): string {
  if (!value) return 'Not available'
  return new Date(value).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusColor(status: string): string {
  if (status === 'completed') return '#00b4a0'
  if (status === 'failed') return '#ef4444'
  if (status === 'running' || status === 'queued') return '#f59e0b'
  return 'rgba(255,255,255,0.5)'
}

function fmtBytes(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'size unavailable'
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export default function RunHistoryDrawer({
  dealId,
  onPromoted,
  onViewSnapshot,
}: {
  dealId?: string | null
  onPromoted?: () => void
  onViewSnapshot?: (run: UnderwritingRun, summary: UnderwritingRunSummary, currentRun?: UnderwritingRunSummary | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [runs, setRuns] = useState<UnderwritingRunSummary[]>([])
  const [documents, setDocuments] = useState<DiligenceDocumentSummary[]>([])
  const [sourceDocuments, setSourceDocuments] = useState<DealSourceDocument[]>([])
  const [selectedRun, setSelectedRun] = useState<UnderwritingRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [reunderwriteOpen, setReunderwriteOpen] = useState(false)
  const [initialReunderwriteIds, setInitialReunderwriteIds] = useState<string[]>([])
  const [opsHealth, setOpsHealth] = useState<DealOpsHealth | null>(null)
  const [opsLoading, setOpsLoading] = useState(false)
  const [comparison, setComparison] = useState<{
    leftRun: UnderwritingRun
    rightRun: UnderwritingRun
    leftSummary: UnderwritingRunSummary
    rightSummary: UnderwritingRunSummary
  } | null>(null)

  const load = useCallback(async () => {
    if (!dealId) return
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to load run history.')
      const runRes = await fetch(`/api/deals/${dealId}/runs`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const runBody = await runRes.json().catch(() => ({}))
      if (!runRes.ok) throw new Error(runBody.error || 'Failed to load run history')
      setRuns(runBody.runs ?? [])

      const docsRes = await fetch(`/api/deals/${dealId}/diligence/documents`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const docsBody = await docsRes.json().catch(() => ({}))
      if (docsRes.ok) setDocuments(docsBody.documents ?? [])

      const sourceDocsRes = await fetch(`/api/deals/${dealId}/source-documents`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const sourceDocsBody = await sourceDocsRes.json().catch(() => ({}))
      if (sourceDocsRes.ok) setSourceDocuments(sourceDocsBody.source_documents ?? [])

      const healthRes = await fetch(`/api/deals/${dealId}/ops/health`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const healthBody = await healthRes.json().catch(() => ({}))
      if (healthRes.ok) setOpsHealth(healthBody.health ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run history')
    } finally {
      setLoading(false)
    }
  }, [dealId])

  const loadOpsHealth = useCallback(async () => {
    if (!dealId) return
    setOpsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to load run diagnostics.')
      const res = await fetch(`/api/deals/${dealId}/ops/health`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load run diagnostics')
      setOpsHealth(body.health ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run diagnostics')
    } finally {
      setOpsLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    if (dealId) load()
  }, [dealId, load])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const currentRun = useMemo(() => runs.find(run => run.is_current), [runs])
  const hasActiveRuns = useMemo(() => runs.some(run => run.status === 'queued' || run.status === 'running'), [runs])

  const pollRuns = useCallback(async () => {
    if (!dealId) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const runRes = await fetch(`/api/deals/${dealId}/runs`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const runBody = await runRes.json().catch(() => ({}))
      if (runRes.ok) setRuns(runBody.runs ?? [])
    } catch {
      // Keep polling quiet; manual refresh surfaces load errors.
    }
  }, [dealId])

  useEffect(() => {
    if (!open || !hasActiveRuns) return
    const interval = window.setInterval(() => {
      pollRuns()
    }, 7000)
    return () => window.clearInterval(interval)
  }, [hasActiveRuns, open, pollRuns])

  const staleDocumentIds = useMemo(() => {
    if (!currentRun?.completed_at) return []
    const completedAt = new Date(currentRun.completed_at).getTime()
    if (!Number.isFinite(completedAt)) return []
    return documents
      .filter(doc => doc.created_at && new Date(doc.created_at).getTime() > completedAt)
      .map(doc => doc.id)
  }, [currentRun, documents])
  const staleCount = staleDocumentIds.length
  const hasReunderwriteInputs = documents.length > 0 || sourceDocuments.length > 0

  function openReunderwrite(ids: string[] = []) {
    setInitialReunderwriteIds(ids)
    setError(null)
    setNotice(null)
    setReunderwriteOpen(true)
  }

  async function loadRunSnapshot(run: UnderwritingRunSummary): Promise<UnderwritingRun | null> {
    if (!dealId) return null
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to load the run.')
      const res = await fetch(`/api/deals/${dealId}/runs/${run.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load run')
      return body.run as UnderwritingRun
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run')
      return null
    }
  }

  async function openRun(run: UnderwritingRunSummary) {
    const snapshot = await loadRunSnapshot(run)
    if (snapshot) setSelectedRun(snapshot)
  }

  async function viewSnapshot(run: UnderwritingRunSummary) {
    if (run.is_current) return
    const snapshot = await loadRunSnapshot(run)
    if (!snapshot) return
    onViewSnapshot?.(snapshot, run, currentRun)
  }

  async function viewComparisonSnapshot(run: UnderwritingRun, summary: UnderwritingRunSummary) {
    setComparison(null)
    onViewSnapshot?.(run, summary, currentRun)
  }

  async function compareRuns(leftSummary?: UnderwritingRunSummary | null, rightSummary?: UnderwritingRunSummary | null) {
    if (!leftSummary || !rightSummary) {
      setError('Both runs must be available before comparing.')
      return
    }
    setError(null)
    const [leftRun, rightRun] = await Promise.all([
      loadRunSnapshot(leftSummary),
      loadRunSnapshot(rightSummary),
    ])
    if (!leftRun || !rightRun) return
    setComparison({ leftRun, rightRun, leftSummary, rightSummary })
  }

  async function compareToCurrent(run: UnderwritingRunSummary) {
    await compareRuns(currentRun, run)
  }

  async function compareToBase(run: UnderwritingRunSummary) {
    const base = runs.find(candidate => candidate.id === run.base_run_id)
    if (!base) {
      setError('Base run was not found in run history.')
      return
    }
    await compareRuns(base, run)
  }

  async function promote(run: UnderwritingRunSummary) {
    if (!dealId) return
    setPromotingId(run.id)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to promote the run.')
      const res = await fetch(`/api/deals/${dealId}/runs/${run.id}/promote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to promote run')
      setNotice(`Run #${run.run_number} is now the current underwriting view.`)
      await load()
      onPromoted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to promote run')
    } finally {
      setPromotingId(null)
    }
  }

  return (
    <section className="no-print" style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.025)',
        borderRadius: 8,
        padding: '12px 14px',
      }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', marginBottom: 3 }}>
            Underwriting runs
          </div>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
            Current run: {currentRun ? `#${currentRun.run_number}` : 'Not loaded'}
          </div>
          {staleCount > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', color: '#f59e0b', fontSize: 12.2, marginTop: 4 }}>
              <span>Current underwriting excludes {staleCount} newer uploaded diligence document{staleCount === 1 ? '' : 's'}.</span>
              <button
                type="button"
                onClick={() => openReunderwrite(staleDocumentIds)}
                style={{ border: '1px solid rgba(245,158,11,0.28)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', borderRadius: 6, padding: '5px 8px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}
              >
                Re-run with newer documents
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={!dealId || !hasReunderwriteInputs}
            onClick={() => openReunderwrite()}
            style={{
              border: '1px solid rgba(0,180,160,0.24)',
              background: 'rgba(0,180,160,0.1)',
              color: dealId && hasReunderwriteInputs ? '#00b4a0' : 'rgba(255,255,255,0.3)',
              borderRadius: 6,
              padding: '8px 12px',
              fontWeight: 800,
              cursor: dealId && hasReunderwriteInputs ? 'pointer' : 'not-allowed',
              fontSize: 12,
            }}
          >
            Re-run with evidence
          </button>
          <button
            type="button"
            disabled={!dealId}
            onClick={() => setOpen(prev => !prev)}
            style={{
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.04)',
              color: dealId ? '#e8edf3' : 'rgba(255,255,255,0.3)',
              borderRadius: 6,
              padding: '8px 12px',
              fontWeight: 800,
              cursor: dealId ? 'pointer' : 'not-allowed',
              fontSize: 12,
            }}
          >
            {open ? 'Hide run history' : 'Run history'}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 10, border: '1px solid rgba(255,255,255,0.09)', background: '#132338', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ margin: 0, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontSize: 18 }}>Run history</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={!dealId || loading}
                onClick={load}
                style={{
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.04)',
                  color: dealId ? '#e8edf3' : 'rgba(255,255,255,0.3)',
                  borderRadius: 6,
                  padding: '7px 10px',
                  fontWeight: 800,
                  cursor: dealId && !loading ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                disabled={!dealId || !hasReunderwriteInputs}
                onClick={() => openReunderwrite()}
                style={{
                  border: '1px solid rgba(0,180,160,0.24)',
                  background: 'rgba(0,180,160,0.1)',
                  color: dealId && hasReunderwriteInputs ? '#00b4a0' : 'rgba(255,255,255,0.3)',
                  borderRadius: 6,
                  padding: '7px 10px',
                  fontWeight: 800,
                  cursor: dealId && hasReunderwriteInputs ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                }}
              >
                Re-run with evidence
              </button>
            </div>
          </div>
          {error && (
            <div style={{ margin: 14, border: '1px solid rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: 8, padding: '9px 11px', fontSize: 12.5 }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{ margin: 14, border: '1px solid rgba(0,180,160,0.2)', background: 'rgba(0,180,160,0.08)', color: '#00b4a0', borderRadius: 8, padding: '9px 11px', fontSize: 12.5 }}>
              {notice}
            </div>
          )}
          {loading ? (
            <div style={{ padding: 16, color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>Loading runs...</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, padding: 14 }}>
              <details style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: 12 }}>
                <summary style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: 800 }}>
                  Run diagnostics
                </summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 10, color: 'rgba(255,255,255,0.55)', fontSize: 12.3, lineHeight: 1.5 }}>
                  <div>Stale running runs: {opsHealth?.stale_running_runs?.length ?? 0}</div>
                  <div>Pending source documents: {opsHealth?.pending_source_document_count ?? 0}</div>
                  <div>Newer diligence docs excluded: {opsHealth?.newer_docs_than_current_run_count ?? staleCount}</div>
                  {(opsHealth?.warnings?.length ?? 0) > 0 && (
                    <div style={{ display: 'grid', gap: 5 }}>
                      {opsHealth?.warnings?.map((warning, index) => (
                        <div key={`${warning}-${index}`} style={{ color: '#f59e0b' }}>{warning}</div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={opsLoading}
                    onClick={loadOpsHealth}
                    style={{ justifySelf: 'start', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#e8edf3', borderRadius: 6, padding: '6px 9px', fontSize: 11.5, fontWeight: 800, cursor: opsLoading ? 'wait' : 'pointer' }}
                  >
                    {opsLoading ? 'Refreshing...' : 'Refresh diagnostics'}
                  </button>
                </div>
              </details>
              {runs.map(run => (
                <article key={run.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.025)', padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                        <strong style={{ color: '#fff', fontSize: 13.5 }}>Run #{run.run_number}</strong>
                        <span style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>{run.run_type}</span>
                        <span style={{ color: statusColor(run.status), fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>{run.status}</span>
                        {run.is_current && <span style={{ color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>Current</span>}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12.3, lineHeight: 1.45 }}>
                        Score {run.total_score != null ? run.total_score.toFixed(1) : 'not available'} · Gate {run.valuation_gate_status ?? 'not available'} · Created {fmtDate(run.created_at)}
                        {run.queued_at ? ` · Queued ${fmtDate(run.queued_at)}` : ''}
                        {run.started_at ? ` · Started ${fmtDate(run.started_at)}` : ''}
                        {run.completed_at ? ` · Completed ${fmtDate(run.completed_at)}` : ''}
                        {run.promoted_at ? ` · Promoted ${fmtDate(run.promoted_at)}` : ''}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11.8, marginTop: 5 }}>
                        Inputs: {run.input_document_count ?? ((run.input_source_count ?? 0) + (run.input_diligence_document_count ?? 0))} document{(run.input_document_count ?? ((run.input_source_count ?? 0) + (run.input_diligence_document_count ?? 0))) === 1 ? '' : 's'} · {fmtBytes(run.input_total_bytes)} · {run.input_source_count ?? 0} source, {run.input_diligence_document_count ?? 0} diligence
                      </div>
                      {(run.progress_message || run.progress_step) && (
                        <div style={{ color: run.status === 'failed' ? '#ef4444' : 'rgba(255,255,255,0.5)', fontSize: 12.1, marginTop: 6 }}>
                          {run.progress_message ?? run.progress_step}
                        </div>
                      )}
                      {run.status === 'queued' && run.execution_mode === 'async_placeholder' && (
                        <div style={{ color: '#f59e0b', fontSize: 12.1, marginTop: 6 }}>
                          This run is queued for the background worker and will not process until the worker is deployed. Use Run now for immediate re-underwriting.
                        </div>
                      )}
                      {run.status === 'failed' && run.error_message && (
                        <div style={{ color: '#ef4444', fontSize: 12.2, marginTop: 7 }}>{run.error_message}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => openRun(run)} style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#e8edf3', borderRadius: 6, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
                        What changed
                      </button>
                      {run.status === 'completed' && !run.is_current && (
                        <button type="button" onClick={() => viewSnapshot(run)} style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#e8edf3', borderRadius: 6, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
                          View snapshot
                        </button>
                      )}
                      {run.status === 'completed' && !run.is_current && currentRun && (
                        <button type="button" onClick={() => compareToCurrent(run)} style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#e8edf3', borderRadius: 6, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
                          Compare to current
                        </button>
                      )}
                      {run.status === 'completed' && run.base_run_id && runs.some(candidate => candidate.id === run.base_run_id) && (
                        <button type="button" onClick={() => compareToBase(run)} style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#e8edf3', borderRadius: 6, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
                          Compare to base
                        </button>
                      )}
                      {run.status === 'completed' && !run.is_current && (
                        <button type="button" disabled={promotingId === run.id} onClick={() => promote(run)} style={{ border: '1px solid rgba(0,180,160,0.28)', background: 'rgba(0,180,160,0.1)', color: '#00b4a0', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 800, cursor: promotingId === run.id ? 'wait' : 'pointer' }}>
                          {promotingId === run.id ? 'Promoting...' : 'Promote'}
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedRun?.id === run.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <RunDiffSummary diff={selectedRun.diff} runId={selectedRun.id} />
                    </div>
                  )}
                </article>
              ))}
              {!runs.length && (
                <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>No underwriting runs found for this deal.</div>
              )}
            </div>
          )}
        </div>
      )}
      {dealId && reunderwriteOpen && (
        <ReunderwriteModal
          dealId={dealId}
          documents={documents}
          sourceDocuments={sourceDocuments}
          initialSelectedIds={initialReunderwriteIds}
          onClose={() => setReunderwriteOpen(false)}
          onComplete={async run => {
            setReunderwriteOpen(false)
            setOpen(true)
            setSelectedRun(run)
            setNotice(
              run.status === 'completed'
                ? `Run #${run.run_number} completed. Review it in Run History before promoting.`
                : run.status === 'queued'
                ? `Run #${run.run_number} queued for the background worker. It will not process until the worker is deployed.`
                : `Run #${run.run_number} finished with status ${run.status}.`
            )
            await load()
          }}
          onAttemptFinished={async () => {
            setOpen(true)
            await load()
          }}
        />
      )}
      {comparison && (
        <RunComparisonView
          leftRun={comparison.leftRun}
          rightRun={comparison.rightRun}
          leftSummary={comparison.leftSummary}
          rightSummary={comparison.rightSummary}
          promoting={promotingId === comparison.rightSummary.id}
          onClose={() => setComparison(null)}
          onViewSnapshot={viewComparisonSnapshot}
          onPromoteRight={promote}
        />
      )}
    </section>
  )
}
