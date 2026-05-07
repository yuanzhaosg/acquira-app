'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '@/lib/useAuth'
import type { DealSourceDocument, UnderwritingRun } from '@/types/runs'

export interface ReunderwriteDocument {
  id: string
  filename?: string | null
  document_type?: string | null
  source_item_id?: string | null
  created_at?: string | null
  file_size?: number | null
}

function fmtDate(value?: string | null): string {
  if (!value) return 'Upload date unavailable'
  return new Date(value).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtSize(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Size unavailable'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function shortId(value?: string | null): string | null {
  if (!value) return null
  return value.length > 8 ? value.slice(0, 8) : value
}

function sourceKindLabel(value?: string | null): string {
  if (!value) return 'Retained source'
  return value.replace(/_/g, ' ')
}

function DocumentRow({
  checked,
  disabled,
  title,
  meta,
  onToggle,
}: {
  checked: boolean
  disabled: boolean
  title: string
  meta: Array<string | null | undefined>
  onToggle: () => void
}) {
  return (
    <label
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: 10,
        alignItems: 'start',
        border: `1px solid ${checked ? 'rgba(0,180,160,0.28)' : 'rgba(255,255,255,0.08)'}`,
        background: checked ? 'rgba(0,180,160,0.08)' : 'rgba(255,255,255,0.025)',
        borderRadius: 8,
        padding: 11,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        style={{ marginTop: 3, accentColor: '#00b4a0' }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: '#fff', fontSize: 13.2, fontWeight: 800, overflowWrap: 'anywhere' }}>
          {title}
        </span>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 5, color: 'rgba(255,255,255,0.45)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
          {meta.filter(Boolean).map(item => <span key={item}>{item}</span>)}
        </span>
      </span>
    </label>
  )
}

export default function ReunderwriteModal({
  dealId,
  documents,
  sourceDocuments,
  initialSelectedIds,
  onClose,
  onComplete,
  onAttemptFinished,
}: {
  dealId: string
  documents: ReunderwriteDocument[]
  sourceDocuments: DealSourceDocument[]
  initialSelectedIds?: string[]
  onClose: () => void
  onComplete: (run: UnderwritingRun) => void
  onAttemptFinished?: () => void | Promise<void>
}) {
  const selectedDefaults = useMemo(() => initialSelectedIds ?? [], [initialSelectedIds])
  const initialKey = useMemo(() => selectedDefaults.join('|'), [selectedDefaults])
  const [selectedDiligenceIds, setSelectedDiligenceIds] = useState<Set<string>>(() => new Set(selectedDefaults))
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(() => new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedDiligenceIds(new Set(selectedDefaults))
    setSelectedSourceIds(new Set())
    setError(null)
  }, [initialKey, selectedDefaults])

  const sourceCount = selectedSourceIds.size
  const diligenceCount = selectedDiligenceIds.size
  const selectedCount = sourceCount + diligenceCount
  const canSubmit = selectedCount > 0 && !submitting
  const allSourcesSelected = sourceDocuments.length > 0 && sourceDocuments.every(doc => selectedSourceIds.has(doc.id))

  function toggleSet(setter: Dispatch<SetStateAction<Set<string>>>, id: string) {
    if (submitting) return
    setter(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAllSources() {
    if (submitting) return
    setSelectedSourceIds(allSourcesSelected ? new Set() : new Set(sourceDocuments.map(doc => doc.id)))
  }

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to re-run underwriting.')
      const res = await fetch(`/api/deals/${dealId}/reunderwrite`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diligence_document_ids: Array.from(selectedDiligenceIds),
          source_document_ids: Array.from(selectedSourceIds),
          execution_mode: 'sync',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        await onAttemptFinished?.()
        if (res.status === 409) {
          throw new Error(`${body.error || 'A re-underwrite run is already in progress for this deal.'} Open Run History and refresh to review it.`)
        }
        const runSuffix = body.run_id ? ` Run ${body.run_id} was marked failed.` : ''
        throw new Error(`${body.error || 'Re-underwrite failed'}${runSuffix}`)
      }
      if (!body.run) throw new Error('Re-underwrite request succeeded but the run snapshot was not returned.')
      onComplete(body.run as UnderwritingRun)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to re-run underwriting')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="reunderwrite-title" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,13,22,0.72)', display: 'grid', placeItems: 'center', padding: 18 }}>
      <div style={{ width: 'min(820px, 100%)', maxHeight: '88vh', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#132338', borderRadius: 8, boxShadow: '0 24px 90px rgba(0,0,0,0.42)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 id="reunderwrite-title" style={{ margin: 0, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontSize: 18 }}>Re-run with evidence</h3>
            <p style={{ margin: '5px 0 0', color: 'rgba(255,255,255,0.52)', fontSize: 12.5, lineHeight: 1.45 }}>
              Select retained originals and/or uploaded diligence documents to run immediate re-underwriting. The current report will not change unless you promote the completed run.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close re-underwrite modal" style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#e8edf3', borderRadius: 6, padding: '6px 9px', cursor: submitting ? 'not-allowed' : 'pointer' }}>
            Close
          </button>
        </div>

        {error && (
          <div style={{ margin: '14px 16px 0', border: '1px solid rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: 8, padding: '9px 11px', fontSize: 12.5 }}>
            {error}
          </div>
        )}

        <div style={{ maxHeight: '56vh', overflowY: 'auto', padding: 16, display: 'grid', gap: 16 }}>
          <div style={{ border: '1px solid rgba(245,158,11,0.22)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', borderRadius: 8, padding: '9px 11px', fontSize: 12.5, lineHeight: 1.5 }}>
            Uploaded documents are primary evidence. Notes/status attached to selected diligence documents are included as manual context with lower confidence and need verification.
          </div>
          <section style={{ display: 'grid', gap: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, color: '#fff', fontSize: 13.5 }}>Retained original source documents</h4>
              {sourceDocuments.length > 0 && (
                <label style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'rgba(255,255,255,0.62)', fontSize: 12.2, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  <input type="checkbox" checked={allSourcesSelected} disabled={submitting} onChange={toggleAllSources} style={{ accentColor: '#00b4a0' }} />
                  Include retained original source documents
                </label>
              )}
            </div>
            {sourceDocuments.map(doc => (
              <DocumentRow
                key={doc.id}
                checked={selectedSourceIds.has(doc.id)}
                disabled={submitting}
                title={doc.filename || 'Untitled source document'}
                meta={[sourceKindLabel(doc.source_kind), fmtDate(doc.created_at), fmtSize(doc.file_size), doc.run_id ? `Run ${shortId(doc.run_id)}` : null]}
                onToggle={() => toggleSet(setSelectedSourceIds, doc.id)}
              />
            ))}
            {!sourceDocuments.length && (
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: 14, color: 'rgba(255,255,255,0.48)', fontSize: 13 }}>
                Original source files were not retained for this older deal.
              </div>
            )}
          </section>

          <section style={{ display: 'grid', gap: 9 }}>
            <h4 style={{ margin: 0, color: '#fff', fontSize: 13.5 }}>Uploaded diligence documents</h4>
            {documents.map(doc => (
              <DocumentRow
                key={doc.id}
                checked={selectedDiligenceIds.has(doc.id)}
                disabled={submitting}
                title={doc.filename || 'Untitled diligence document'}
                meta={[doc.document_type || 'Unclassified', fmtDate(doc.created_at), fmtSize(doc.file_size), doc.source_item_id ? `Item ${shortId(doc.source_item_id)}` : null]}
                onToggle={() => toggleSet(setSelectedDiligenceIds, doc.id)}
              />
            ))}
            {!documents.length && (
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: 14, color: 'rgba(255,255,255,0.48)', fontSize: 13 }}>
                No diligence documents have been uploaded yet.
              </div>
            )}
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '13px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12.2 }}>
            {sourceCount} source doc{sourceCount === 1 ? '' : 's'}, {diligenceCount} diligence doc{diligenceCount === 1 ? '' : 's'} selected
          </div>
          <button type="button" disabled={!canSubmit} onClick={submit} style={{ border: '1px solid rgba(0,180,160,0.28)', background: canSubmit ? 'rgba(0,180,160,0.12)' : 'rgba(255,255,255,0.04)', color: canSubmit ? '#00b4a0' : 'rgba(255,255,255,0.32)', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {submitting ? 'Running...' : 'Run now'}
          </button>
        </div>
      </div>
    </div>
  )
}
