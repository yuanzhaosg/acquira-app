'use client'

import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/useAuth'
import { generateEvidenceRequestSuggestions } from '@/lib/evidenceRequests'
import type { DiligenceDocument, DiligenceItem } from '@/types/diligence'
import type { EvidenceRequest, EvidenceRequestStatus, EvidenceRequestSuggestion } from '@/types/evidenceRequests'
import type { DealWorkflow } from '@/types/workflow'

const STATUS_LABELS: Record<EvidenceRequestStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  received: 'Received',
  waived: 'Waived',
  closed: 'Closed',
}

const STATUS_COLORS: Record<EvidenceRequestStatus, string> = {
  draft: '#f59e0b',
  sent: '#3b82f6',
  received: '#00b4a0',
  waived: '#a78bfa',
  closed: '#94a3b8',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#00b4a0',
}

function dateLabel(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-AU')
}

function formatBytes(bytes?: number | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function suggestionKey(suggestion: EvidenceRequestSuggestion): string {
  return `${suggestion.request_type}:${suggestion.diligence_item_id ?? ''}:${suggestion.title}`
}

function requestKey(request: EvidenceRequest): string {
  return `${request.request_type}:${request.diligence_item_id ?? ''}:${request.title}`
}

export default function EvidenceRequestsPanel({
  dealId,
  workflow,
  items,
  documents,
  centreName,
}: {
  dealId?: string | null
  workflow?: DealWorkflow | null
  items: DiligenceItem[]
  documents: DiligenceDocument[]
  centreName?: string | null
}) {
  const [requests, setRequests] = useState<EvidenceRequest[]>([])
  const [suggestions, setSuggestions] = useState<EvidenceRequestSuggestion[]>([])
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null)
  const [linkingRequestId, setLinkingRequestId] = useState<string | null>(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set())
  const [rerunningRequestId, setRerunningRequestId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestKeys = useMemo(() => new Set(requests.map(requestKey)), [requests])
  const unsavedSuggestions = useMemo(
    () => suggestions.filter(suggestion => !requestKeys.has(suggestionKey(suggestion))),
    [requestKeys, suggestions],
  )

  const loadRequests = useCallback(async () => {
    if (!dealId) {
      setRequests([])
      setLoaded(true)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to manage evidence requests.')
      const res = await fetch(`/api/deals/${dealId}/evidence-requests`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load evidence requests')
      setRequests(body.requests ?? [])
      setLoaded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load evidence requests')
    } finally {
      setLoading(false)
    }
  }, [dealId])

  function generateDrafts() {
    const next = generateEvidenceRequestSuggestions({
      workflow,
      diligenceItems: items,
      centreName,
      runId: workflow?.run_id ?? null,
    })
    setSuggestions(next)
    setSelectedSuggestionIds(new Set(next.filter(suggestion => !requestKeys.has(suggestionKey(suggestion))).map(suggestion => suggestion.id)))
    setMessage(next.length ? null : 'No unresolved blockers or open diligence requests were found.')
    if (!loaded) {
      loadRequests()
    }
  }

  async function saveSelectedDrafts() {
    if (!dealId || saving) return
    const selected = unsavedSuggestions.filter(suggestion => selectedSuggestionIds.has(suggestion.id))
    if (selected.length === 0) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to save evidence requests.')
      const inserted: EvidenceRequest[] = []
      for (const suggestion of selected) {
        const res = await fetch(`/api/deals/${dealId}/evidence-requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: suggestion.title,
            body: suggestion.body,
            request_type: suggestion.request_type,
            priority: suggestion.priority,
            run_id: suggestion.run_id,
            diligence_item_id: suggestion.diligence_item_id,
            requested_from: suggestion.requested_from,
            due_date: suggestion.due_date,
          }),
        })
        const responseBody = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(responseBody.error || 'Failed to save evidence request')
        if (responseBody.request) inserted.push(responseBody.request as EvidenceRequest)
      }
      setRequests(prev => [...inserted, ...prev])
      setSelectedSuggestionIds(new Set())
      setMessage(`Saved ${inserted.length} draft request${inserted.length === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save evidence requests')
    } finally {
      setSaving(false)
    }
  }

  async function patchRequest(request: EvidenceRequest, update: Partial<EvidenceRequest> & { copied_to_clipboard_at?: string | true | null }) {
    if (!dealId || workingRequestId) return
    setWorkingRequestId(request.id)
    setError(null)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to update evidence requests.')
      const res = await fetch(`/api/deals/${dealId}/evidence-requests/${request.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(update),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to update evidence request')
      const updated = body.request as EvidenceRequest
      setRequests(prev => prev.map(row => row.id === updated.id ? {
        ...row,
        ...updated,
        linked_document_ids: updated.linked_document_ids ?? row.linked_document_ids,
        linked_document_count: updated.linked_document_count ?? row.linked_document_count,
        linked_documents: updated.linked_documents ?? row.linked_documents,
      } : row))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update evidence request')
    } finally {
      setWorkingRequestId(null)
    }
  }

  async function copyRequest(request: EvidenceRequest) {
    try {
      await navigator.clipboard.writeText(request.body)
      await patchRequest(request, { copied_to_clipboard_at: new Date().toISOString() })
      setMessage('Request copied to clipboard.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to copy request')
    }
  }

  function openLinkPicker(request: EvidenceRequest) {
    setLinkingRequestId(request.id)
    setSelectedDocumentIds(new Set(request.linked_document_ids ?? []))
    setError(null)
    setMessage(null)
  }

  async function saveDocumentLinks(request: EvidenceRequest) {
    if (!dealId || !linkingRequestId) return
    setWorkingRequestId(request.id)
    setError(null)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to link documents.')
      const res = await fetch(`/api/deals/${dealId}/evidence-requests/${request.id}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ diligence_document_ids: Array.from(selectedDocumentIds) }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to link uploaded documents')
      await loadRequests()
      setLinkingRequestId(null)
      setSelectedDocumentIds(new Set())
      setMessage('Linked uploaded documents to the request.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link uploaded documents')
    } finally {
      setWorkingRequestId(null)
    }
  }

  async function unlinkDocument(request: EvidenceRequest, documentId: string) {
    if (!dealId || workingRequestId) return
    setWorkingRequestId(request.id)
    setError(null)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to unlink documents.')
      const res = await fetch(`/api/deals/${dealId}/evidence-requests/${request.id}/documents/${documentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to unlink document')
      await loadRequests()
      setMessage('Document unlinked from the request.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlink document')
    } finally {
      setWorkingRequestId(null)
    }
  }

  async function rerunWithLinkedDocuments(request: EvidenceRequest) {
    if (!dealId || rerunningRequestId) return
    const linkedIds = request.linked_document_ids ?? []
    if (!linkedIds.length) return
    setRerunningRequestId(request.id)
    setError(null)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to re-run underwriting.')
      const res = await fetch(`/api/deals/${dealId}/reunderwrite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          diligence_document_ids: linkedIds,
          execution_mode: 'sync',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(`${body.error || 'A re-underwrite run is already in progress for this deal.'} Open Run History and refresh to review it.`)
        }
        const runSuffix = body.run_id ? ` Run ${body.run_id} was marked failed.` : ''
        throw new Error(`${body.error || 'Re-underwrite failed'}${runSuffix}`)
      }
      setMessage(res.status === 202
        ? 'Run queued for the background worker and will not process until the worker is deployed. Use Run now for immediate re-underwriting.'
        : 'Run completed. Review it in Run History before promoting.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to re-run underwriting')
    } finally {
      setRerunningRequestId(null)
    }
  }

  const requestsByStatus = useMemo(() => {
    const grouped: Record<EvidenceRequestStatus, EvidenceRequest[]> = {
      draft: [],
      sent: [],
      received: [],
      waived: [],
      closed: [],
    }
    for (const request of requests) grouped[request.status]?.push(request)
    return grouped
  }, [requests])

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 800, marginBottom: 5 }}>
            Evidence Requests
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.45 }}>
            Turn unresolved blockers and open diligence items into broker/vendor request drafts.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!dealId || loading}
            onClick={loadRequests}
            style={secondaryButtonStyle(!dealId || loading)}
          >
            {loaded ? 'Refresh' : 'Load requests'}
          </button>
          <button
            type="button"
            disabled={!dealId}
            onClick={generateDrafts}
            style={primaryButtonStyle(!dealId)}
          >
            Generate draft requests
          </button>
        </div>
      </div>

      {!dealId && (
        <div style={noticeStyle('#f59e0b')}>
          Save this deal before creating broker/vendor request drafts.
        </div>
      )}
      {error && <div style={noticeStyle('#ef4444')}>{error}</div>}
      {message && <div style={noticeStyle('#00b4a0')}>{message}</div>}

      {unsavedSuggestions.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginTop: 12, marginBottom: 12 }}>
          {unsavedSuggestions.map(suggestion => {
            const checked = selectedSuggestionIds.has(suggestion.id)
            return (
              <label key={suggestion.id} style={suggestionCardStyle}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    setSelectedSuggestionIds(prev => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(suggestion.id)
                      else next.delete(suggestion.id)
                      return next
                    })
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
                    <span style={{ color: PRIORITY_COLORS[suggestion.priority], fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 800 }}>
                      {suggestion.priority}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
                      {suggestion.source_label}
                    </span>
                  </div>
                  <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>{suggestion.title}</div>
                  <pre style={bodyPreviewStyle}>{suggestion.body}</pre>
                </div>
              </label>
            )
          })}
          <button
            type="button"
            disabled={saving || selectedSuggestionIds.size === 0}
            onClick={saveSelectedDrafts}
            style={primaryButtonStyle(saving || selectedSuggestionIds.size === 0)}
          >
            {saving ? 'Saving drafts...' : `Save selected drafts (${selectedSuggestionIds.size})`}
          </button>
        </div>
      )}

      {loaded && requests.length === 0 && !loading && (
        <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 12.5, paddingTop: 6 }}>
          No saved evidence requests yet.
        </div>
      )}

      {requests.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {(['draft', 'sent', 'received', 'waived', 'closed'] as EvidenceRequestStatus[]).map(status => (
            requestsByStatus[status].length > 0 && (
              <div key={status} style={{ display: 'grid', gap: 8 }}>
                <div style={{ color: STATUS_COLORS[status], fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' }}>
                  {STATUS_LABELS[status]} ({requestsByStatus[status].length})
                </div>
                {requestsByStatus[status].map(request => (
                  <article key={request.id} style={requestCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 800 }}>{request.title}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 5, color: 'rgba(255,255,255,0.38)', fontSize: 11.5 }}>
                          <span>{request.request_type.replace(/_/g, ' ')}</span>
                          <span style={{ color: PRIORITY_COLORS[request.priority] }}>{request.priority}</span>
                          {request.due_date && <span>Due {dateLabel(request.due_date)}</span>}
                          {request.requested_from && <span>From {request.requested_from}</span>}
                        </div>
                      </div>
                      <span style={{ color: STATUS_COLORS[request.status], fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 800 }}>
                        {STATUS_LABELS[request.status]}
                      </span>
                    </div>
                    <pre style={bodyPreviewStyle}>{request.body}</pre>
                    {request.status === 'received' && (
                      <div style={{ color: (request.linked_document_count ?? 0) > 0 ? '#00b4a0' : '#f59e0b', fontSize: 12, marginTop: 8 }}>
                        {(request.linked_document_count ?? 0) > 0
                          ? 'Linked evidence is ready for Run now.'
                          : 'Marked received, but no uploaded document is linked yet.'}
                      </div>
                    )}
                    {request.status === 'sent' && (
                      <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 12, marginTop: 8 }}>
                        Waiting for evidence. Upload received files in the diligence checklist, then link them here.
                      </div>
                    )}
                    {(request.status === 'waived' || request.status === 'closed') && (
                      <div style={{ color: 'rgba(255,255,255,0.36)', fontSize: 12, marginTop: 8 }}>
                        No action needed for this request.
                      </div>
                    )}
                    <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
                      {(request.linked_documents ?? []).map(doc => (
                        <div key={doc.id} style={documentChipStyle}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: 12.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.filename}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.36)', fontSize: 10.8, marginTop: 2 }}>
                              {[doc.document_type, dateLabel(doc.created_at), formatBytes(doc.file_size)].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <button type="button" disabled={workingRequestId === request.id} onClick={() => unlinkDocument(request, doc.id)} style={smallButtonStyle(false)}>
                            Unlink
                          </button>
                        </div>
                      ))}
                      {linkingRequestId === request.id && (
                        <div style={linkPickerStyle}>
                          {documents.length === 0 ? (
                            <div style={{ color: 'rgba(255,255,255,0.44)', fontSize: 12.5 }}>
                              Upload documents in the diligence checklist, then link them here.
                            </div>
                          ) : (
                            documents.map(doc => (
                              <label key={doc.id} style={linkOptionStyle}>
                                <input
                                  type="checkbox"
                                  checked={selectedDocumentIds.has(doc.id)}
                                  onChange={e => {
                                    setSelectedDocumentIds(prev => {
                                      const next = new Set(prev)
                                      if (e.target.checked) next.add(doc.id)
                                      else next.delete(doc.id)
                                      return next
                                    })
                                  }}
                                  style={{ accentColor: '#00b4a0', marginTop: 3 }}
                                />
                                <span style={{ minWidth: 0 }}>
                                  <span style={{ display: 'block', color: 'rgba(255,255,255,0.76)', fontSize: 12.3, overflowWrap: 'anywhere' }}>
                                    {doc.filename}
                                  </span>
                                  <span style={{ display: 'block', color: 'rgba(255,255,255,0.36)', fontSize: 10.8, marginTop: 2 }}>
                                    {[doc.document_type, dateLabel(doc.created_at), formatBytes(doc.file_size)].filter(Boolean).join(' · ')}
                                  </span>
                                </span>
                              </label>
                            ))
                          )}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" disabled={workingRequestId === request.id || selectedDocumentIds.size === 0} onClick={() => saveDocumentLinks(request)} style={smallButtonStyle(workingRequestId === request.id || selectedDocumentIds.size === 0)}>
                              Save links
                            </button>
                            <button type="button" disabled={workingRequestId === request.id} onClick={() => setLinkingRequestId(null)} style={smallButtonStyle(false)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      <button type="button" disabled={workingRequestId === request.id} onClick={() => copyRequest(request)} style={smallButtonStyle(false)}>
                        Copy body
                      </button>
                      <button type="button" disabled={workingRequestId === request.id} onClick={() => openLinkPicker(request)} style={smallButtonStyle(false)}>
                        Link uploaded documents
                      </button>
                      <button
                        type="button"
                        disabled={rerunningRequestId === request.id || request.status !== 'received' || (request.linked_document_count ?? 0) === 0}
                        onClick={() => rerunWithLinkedDocuments(request)}
                        style={smallButtonStyle(rerunningRequestId === request.id || request.status !== 'received' || (request.linked_document_count ?? 0) === 0)}
                      >
                        {rerunningRequestId === request.id ? 'Running...' : 'Run now with linked documents'}
                      </button>
                      {request.status !== 'sent' && request.status !== 'received' && request.status !== 'closed' && (
                        <button type="button" disabled={workingRequestId === request.id} onClick={() => patchRequest(request, { status: 'sent' })} style={smallButtonStyle(false)}>
                          Mark sent
                        </button>
                      )}
                      {request.status !== 'received' && (
                        <button type="button" disabled={workingRequestId === request.id} onClick={() => patchRequest(request, { status: 'received' })} style={smallButtonStyle(false)}>
                          Mark received
                        </button>
                      )}
                      {request.status !== 'waived' && (
                        <button type="button" disabled={workingRequestId === request.id} onClick={() => patchRequest(request, { status: 'waived' })} style={smallButtonStyle(false)}>
                          Mark waived
                        </button>
                      )}
                      {request.status !== 'closed' && (
                        <button type="button" disabled={workingRequestId === request.id} onClick={() => patchRequest(request, { status: 'closed' })} style={smallButtonStyle(false)}>
                          Mark closed
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: '1px solid rgba(0,180,160,0.36)',
    background: disabled ? 'rgba(255,255,255,0.04)' : '#00b4a0',
    color: disabled ? 'rgba(255,255,255,0.34)' : '#06121f',
    borderRadius: 6,
    padding: '8px 11px',
    fontSize: 12.5,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.045)',
    color: disabled ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.72)',
    borderRadius: 6,
    padding: '8px 11px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function smallButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.045)',
    color: disabled ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.68)',
    borderRadius: 6,
    padding: '6px 9px',
    fontSize: 11.5,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function noticeStyle(color: string): CSSProperties {
  return {
    border: `1px solid ${color}44`,
    background: `${color}14`,
    borderRadius: 8,
    padding: '9px 11px',
    color,
    fontSize: 12.5,
    marginTop: 8,
  }
}

const suggestionCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '18px minmax(0,1fr)',
  gap: 10,
  alignItems: 'start',
  border: '1px solid rgba(255,255,255,0.09)',
  background: 'rgba(255,255,255,0.035)',
  borderRadius: 8,
  padding: '11px 12px',
}

const requestCardStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.09)',
  background: 'rgba(255,255,255,0.03)',
  borderRadius: 8,
  padding: '12px 13px',
}

const documentChipStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr) auto',
  gap: 10,
  alignItems: 'center',
  border: '1px solid rgba(0,180,160,0.16)',
  background: 'rgba(0,180,160,0.045)',
  borderRadius: 7,
  padding: '7px 9px',
}

const linkPickerStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.028)',
  borderRadius: 8,
  padding: 10,
}

const linkOptionStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '18px minmax(0,1fr)',
  gap: 8,
  alignItems: 'start',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.025)',
  borderRadius: 7,
  padding: '8px 9px',
  cursor: 'pointer',
}

const bodyPreviewStyle: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  color: 'rgba(255,255,255,0.58)',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12.5,
  lineHeight: 1.5,
}
