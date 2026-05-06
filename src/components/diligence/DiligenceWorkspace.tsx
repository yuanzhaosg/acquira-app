'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/useAuth'
import EvidenceRequestsPanel from '@/components/diligence/EvidenceRequestsPanel'
import type { DealWorkflow } from '@/types/workflow'
import type { DiligenceDocument, DiligenceItem, DiligenceStatus, EvidenceLink } from '@/types/diligence'

const STATUSES: DiligenceStatus[] = ['not_requested', 'requested', 'received', 'verified', 'waived', 'rejected']
const STATUS_LABELS: Record<DiligenceStatus, string> = {
  not_requested: 'Not requested',
  requested: 'Requested',
  received: 'Received',
  verified: 'Verified',
  waived: 'Waived',
  rejected: 'Rejected',
}
const PRIORITY_COLOR: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#00b4a0',
}

const MAX_DILIGENCE_FILE_BYTES = 100 * 1024 * 1024

function safeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/]+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\.+/, '')
    .slice(0, 140)
  return cleaned || 'diligence-document'
}

function formatBytes(bytes?: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function emptyCounts() {
  return {
    open: 0,
    requested: 0,
    received: 0,
    verified: 0,
    waived: 0,
    rejected: 0,
  }
}

function generatedItems(workflow?: DealWorkflow | null): DiligenceItem[] {
  const items = workflow?.diligence_checklist ?? workflow?.diligence_requests ?? []
  return items.map((item, index) => ({
    id: item.id || `generated_${index + 1}`,
    deal_id: '',
    workflow_item_id: item.id || `generated_${index + 1}`,
    category: item.category,
    question: item.question || item.request || 'Diligence request',
    request: item.request || item.question || null,
    why_it_matters: item.why_it_matters || null,
    priority: item.priority,
    status: item.status,
    linked_fact_ids: item.linked_fact_ids ?? [],
    linked_evidence_ids: item.linked_evidence_ids ?? [],
    linked_document_ids: [],
    notes: null,
  }))
}

export default function DiligenceWorkspace({
  dealId,
  workflow,
}: {
  dealId?: string | null
  workflow?: DealWorkflow | null
}) {
  const [items, setItems] = useState<DiligenceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [uploadingById, setUploadingById] = useState<Record<string, boolean>>({})
  const [documents, setDocuments] = useState<DiligenceDocument[]>([])
  const [links, setLinks] = useState<EvidenceLink[]>([])

  const loadItems = useCallback(async () => {
    if (!dealId) {
      setItems(generatedItems(workflow))
      setDocuments([])
      setLinks([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Sign in again to manage diligence items.')
        setItems([])
        return
      }
      const res = await fetch(`/api/deals/${dealId}/diligence`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to load diligence items')
      setItems(body.items ?? [])
      const docsRes = await fetch(`/api/deals/${dealId}/diligence/documents`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const docsBody = await docsRes.json().catch(() => ({}))
      if (!docsRes.ok) throw new Error(docsBody.error || 'Failed to load diligence documents')
      setDocuments(docsBody.documents ?? [])
      setLinks(docsBody.links ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load diligence items')
    } finally {
      setLoading(false)
    }
  }, [dealId, workflow])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const counts = useMemo(() => {
    const next = emptyCounts()
    for (const item of items) {
      if (item.status === 'not_requested') next.open += 1
      else next[item.status] += 1
    }
    return next
  }, [items])

  const documentsByItem = useMemo(() => {
    const byId = new Map<string, DiligenceDocument[]>()
    for (const doc of documents) {
      if (doc.source_item_id) {
        byId.set(doc.source_item_id, [...(byId.get(doc.source_item_id) ?? []), doc])
      }
    }
    for (const link of links) {
      if (!link.diligence_item_id || !link.document_id) continue
      const doc = documents.find(candidate => candidate.id === link.document_id)
      if (!doc) continue
      const current = byId.get(link.diligence_item_id) ?? []
      if (!current.some(candidate => candidate.id === doc.id)) {
        byId.set(link.diligence_item_id, [...current, doc])
      }
    }
    return byId
  }, [documents, links])

  async function patchItem(item: DiligenceItem, update: Partial<DiligenceItem>) {
    if (!dealId) return
    setSavingId(item.id)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to update diligence items.')
      const res = await fetch(`/api/deals/${dealId}/diligence/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(update),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to update diligence item')
      const updated = body.item as DiligenceItem
      setItems(prev => prev.map(row => row.id === updated.id ? updated : row))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update diligence item')
      await loadItems()
    } finally {
      setSavingId(null)
    }
  }

  function handleStatus(item: DiligenceItem, status: DiligenceStatus) {
    if (status === 'waived' && !item.waiver_reason?.trim()) {
      const reason = window.prompt('Waiver reason required. Waiving an item does not resolve underwriting evidence.')
      if (!reason?.trim()) return
      patchItem(item, { status, waiver_reason: reason.trim() })
      return
    }
    if (status === 'rejected' && !item.rejection_reason?.trim()) {
      const reason = window.prompt('Rejection reason (optional but recommended)')
      patchItem(item, { status, rejection_reason: reason?.trim() || null })
      return
    }
    patchItem(item, { status })
  }

  async function uploadEvidence(item: DiligenceItem, file: File | null) {
    if (!dealId || !file) return
    if (file.size > MAX_DILIGENCE_FILE_BYTES) {
      setError(`${file.name} is too large. Maximum diligence upload size is ${formatBytes(MAX_DILIGENCE_FILE_BYTES)}.`)
      return
    }
    setUploadingById(prev => ({ ...prev, [item.id]: true }))
    setError(null)
    let storagePath: string | null = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in again to upload diligence evidence.')
      const uniquePrefix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      storagePath = `diligence/${dealId}/${Date.now()}-${uniquePrefix}-${safeFilename(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(storagePath, file, {
          upsert: false,
          contentType: file.type || undefined,
        })
      if (uploadError) throw uploadError

      const res = await fetch(`/api/deals/${dealId}/diligence/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storage_path: storagePath,
          filename: file.name,
          mime_type: file.type || null,
          file_size: file.size,
          document_type: item.category,
          source_item_id: item.id,
          metadata: { uploaded_from: 'diligence_workspace' },
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to save diligence document metadata')
      if (body.document) setDocuments(prev => [body.document as DiligenceDocument, ...prev])
      if (body.link) setLinks(prev => [body.link as EvidenceLink, ...prev])
    } catch (e) {
      if (storagePath) {
        supabase.storage.from('uploads').remove([storagePath]).catch(() => {})
      }
      setError(e instanceof Error ? e.message : 'Failed to upload diligence evidence')
    } finally {
      setUploadingById(prev => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    }
  }

  return (
    <section className="no-print" style={{ marginBottom: 34 }}>
      <div style={{
        background: '#132338',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'flex-start',
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#00b4a0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              Diligence Workspace
            </div>
            <h2 style={{ margin: 0, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontSize: 20 }}>
              Request, track, and verify evidence
            </h2>
          </div>
          {!dealId && (
            <div style={{
              border: '1px solid rgba(245,158,11,0.28)',
              background: 'rgba(245,158,11,0.08)',
              borderRadius: 8,
              padding: '9px 12px',
              color: '#f59e0b',
              fontSize: 12.5,
              maxWidth: 300,
            }}>
              Save this deal to manage diligence items.
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {Object.entries(counts).map(([key, value]) => (
            <div key={key} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{value}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', marginTop: 5 }}>
                {key.replace('_', ' ')}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ margin: '14px 16px 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}

        <EvidenceRequestsPanel
          dealId={dealId}
          workflow={workflow}
          items={items}
          documents={documents}
        />

        {loading ? (
          <div style={{ padding: 24, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Loading diligence workspace...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 24, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            No generated diligence checklist is available for this deal.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, padding: 16 }}>
            {items.map(item => {
              const disabled = !dealId || savingId === item.id
              const itemDocuments = documentsByItem.get(item.id) ?? []
              const isUploading = !!uploadingById[item.id]
              return (
                <article key={item.id} style={{ background: '#152336', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 156px', gap: 14, alignItems: 'start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ color: PRIORITY_COLOR[item.priority] ?? '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 800 }}>
                          {item.priority}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.34)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
                          {item.category}
                        </span>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13.5, lineHeight: 1.55, marginBottom: 7 }}>
                        {item.question || item.request}
                      </div>
                      {item.why_it_matters && (
                        <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 12.2, lineHeight: 1.5 }}>
                          <strong style={{ color: 'rgba(255,255,255,0.58)' }}>Why it matters: </strong>
                          {item.why_it_matters}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                        <label style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          border: '1px solid rgba(0,180,160,0.24)',
                          background: 'rgba(0,180,160,0.07)',
                          borderRadius: 6,
                          padding: '7px 10px',
                          color: dealId ? '#00b4a0' : 'rgba(255,255,255,0.28)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: dealId && !isUploading ? 'pointer' : 'not-allowed',
                        }}>
                          {isUploading ? 'Uploading...' : 'Upload evidence'}
                          <input
                            type="file"
                            disabled={!dealId || isUploading}
                            onChange={e => {
                              const file = e.currentTarget.files?.[0] ?? null
                              e.currentTarget.value = ''
                              uploadEvidence(item, file)
                            }}
                            style={{ display: 'none' }}
                          />
                        </label>
                        <span style={{ color: 'rgba(255,255,255,0.36)', fontSize: 11.5 }}>
                          {itemDocuments.length} linked document{itemDocuments.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      {itemDocuments.length > 0 && (
                        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                          {itemDocuments.map(doc => (
                            <div key={doc.id} style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0,1fr) auto',
                              gap: 10,
                              alignItems: 'center',
                              border: '1px solid rgba(255,255,255,0.08)',
                              background: 'rgba(255,255,255,0.025)',
                              borderRadius: 6,
                              padding: '7px 9px',
                            }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {doc.filename}
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.34)', fontSize: 11, marginTop: 2 }}>
                                  {[doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-AU') : null, formatBytes(doc.file_size)].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                              <span style={{ color: '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
                                {doc.extraction_status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <label style={{ display: 'grid', gap: 6, color: 'rgba(255,255,255,0.42)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
                      Status
                      <select
                        value={item.status}
                        disabled={disabled}
                        onChange={e => handleStatus(item, e.target.value as DiligenceStatus)}
                        style={{
                          width: '100%',
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: '#0d1b2a',
                          color: '#e8edf3',
                          padding: '8px 9px',
                          fontSize: 12.5,
                        }}
                      >
                        {STATUSES.map(status => (
                          <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(180px, 260px)', gap: 12, marginTop: 12 }}>
                    <label style={{ display: 'grid', gap: 6, color: 'rgba(255,255,255,0.42)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
                      Notes
                      <textarea
                        defaultValue={item.notes ?? ''}
                        disabled={!dealId || savingId === item.id}
                        onBlur={e => {
                          if ((item.notes ?? '') !== e.currentTarget.value) patchItem(item, { notes: e.currentTarget.value })
                        }}
                        rows={2}
                        placeholder={dealId ? 'Add diligence notes...' : 'Save this deal to add notes'}
                        style={{
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.03)',
                          color: '#e8edf3',
                          padding: '9px 10px',
                          fontSize: 12.5,
                          resize: 'vertical',
                        }}
                      />
                    </label>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {item.status === 'waived' && (
                        <label style={{ display: 'grid', gap: 6, color: '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
                          Waiver reason
                          <textarea
                            defaultValue={item.waiver_reason ?? ''}
                            disabled={!dealId || savingId === item.id}
                            onBlur={e => {
                              if ((item.waiver_reason ?? '') !== e.currentTarget.value) patchItem(item, { waiver_reason: e.currentTarget.value })
                            }}
                            rows={2}
                            style={{ borderRadius: 6, border: '1px solid rgba(245,158,11,0.22)', background: 'rgba(245,158,11,0.05)', color: '#e8edf3', padding: '8px 9px', fontSize: 12.5 }}
                          />
                        </label>
                      )}
                      {item.status === 'rejected' && (
                        <label style={{ display: 'grid', gap: 6, color: '#ef4444', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase' }}>
                          Rejection reason
                          <textarea
                            defaultValue={item.rejection_reason ?? ''}
                            disabled={!dealId || savingId === item.id}
                            onBlur={e => {
                              if ((item.rejection_reason ?? '') !== e.currentTarget.value) patchItem(item, { rejection_reason: e.currentTarget.value })
                            }}
                            rows={2}
                            style={{ borderRadius: 6, border: '1px solid rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.05)', color: '#e8edf3', padding: '8px 9px', fontSize: 12.5 }}
                          />
                        </label>
                      )}
                      {savingId === item.id && (
                        <div style={{ color: 'rgba(255,255,255,0.36)', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' }}>
                          Saving...
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
