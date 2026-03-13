'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Accepted extensions — .doc rejected explicitly with a helpful message
const ACCEPTED_EXTENSIONS = /\.(pdf|zip|docx|xlsx|xls|csv)$/i

// Size limits — enforced before any upload starts
const MAX_SINGLE_FILE_BYTES = 50  * 1024 * 1024  // 50 MB per file
const MAX_ZIP_BYTES         = 200 * 1024 * 1024  // 200 MB for a ZIP data room
const MAX_FILE_COUNT        = 30                  // matches Railway budget

interface UploadWidgetProps {
  onResult: (extracted: unknown, scored: unknown) => void
}

interface ProgressStep {
  step: number
  total: number
  label: string
  detail?: string
}

interface FileUploadState {
  name: string
  pct: number
  done: boolean
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'uploading'; files: FileUploadState[] }
  | { kind: 'processing'; filenames: string[]; elapsed: number; progress: ProgressStep | null }
  | { kind: 'error'; message: string; filenames?: string[] }

const PIPELINE_STEPS = [
  { step: 1, label: 'Extract documents' },
  { step: 2, label: 'Extract metrics' },
  { step: 3, label: 'Score 17 dimensions' },
  { step: 4, label: 'Generate report' },
  { step: 5, label: 'Complete' },
]

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadWidget({ onResult }: UploadWidgetProps) {
  const [stage, setStage]       = useState<Stage>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)

  const run = useCallback(async (files: File[]) => {
    const ts = Date.now()
    const filenames = files.map(f => f.name)

    setStage({
      kind: 'uploading',
      files: files.map(f => ({ name: f.name, pct: 0, done: false })),
    })

    const storagePaths: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // Timestamp + index prevents collisions between same-named files
      const storagePath = `pipeline/${ts}-${i}-${safeName(file.name)}`

      // Fake progress — Supabase JS SDK doesn't expose upload progress
      const progressInterval = setInterval(() => {
        setStage(prev => {
          if (prev.kind !== 'uploading') return prev
          const updated = [...prev.files]
          updated[i] = { ...updated[i], pct: Math.min(updated[i].pct + 8, 88) }
          return { ...prev, files: updated }
        })
      }, 400)

      const { error } = await supabase.storage
        .from('uploads')
        .upload(storagePath, file, {
          cacheControl: '300',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        })

      clearInterval(progressInterval)

      if (error) {
        // Clean up successfully uploaded files before showing error
        if (storagePaths.length) {
          supabase.storage.from('uploads').remove(storagePaths).catch(() => {})
        }
        setStage({
          kind: 'error',
          message: `Failed to upload ${file.name}: ${error.message}`,
          filenames,
        })
        return
      }

      storagePaths.push(storagePath)

      setStage(prev => {
        if (prev.kind !== 'uploading') return prev
        const updated = [...prev.files]
        updated[i] = { ...updated[i], pct: 100, done: true }
        return { ...prev, files: updated }
      })
    }

    await new Promise(r => setTimeout(r, 400))

    // ── Trigger Railway pipeline ───────────────────────────────────────────
    const startTime = Date.now()
    setStage({ kind: 'processing', filenames, elapsed: 0, progress: null })

    const elapsedInterval = setInterval(() => {
      setStage(prev =>
        prev.kind === 'processing'
          ? { ...prev, elapsed: Math.floor((Date.now() - startTime) / 1000) }
          : prev
      )
    }, 1000)

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePaths,
          filenames,
          storagePath: storagePaths[0],   // legacy compat
          filename: filenames.join(', '), // legacy compat
        }),
      })

      if (!res.ok || !res.body) {
        clearInterval(elapsedInterval)
        setStage({ kind: 'error', message: `Pipeline error: HTTP ${res.status}`, filenames })
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const block of events) {
          if (!block.trim()) continue
          const eventMatch = block.match(/^event:\s*(.+)$/m)
          const dataMatch  = block.match(/^data:\s*(.+)$/m)
          if (!eventMatch || !dataMatch) continue

          const eventType = eventMatch[1].trim()
          let data: any
          try { data = JSON.parse(dataMatch[1]) } catch { continue }

          if (eventType === 'progress') {
            setStage(prev =>
              prev.kind === 'processing'
                ? { ...prev, progress: data as ProgressStep }
                : prev
            )
          } else if (eventType === 'complete') {
            clearInterval(elapsedInterval)
            onResult(data.extracted, data.scored)
            return
          } else if (eventType === 'error') {
            clearInterval(elapsedInterval)
            setStage({ kind: 'error', message: data.message || 'Pipeline failed', filenames })
            return
          }
        }
      }

      clearInterval(elapsedInterval)
      setStage({ kind: 'error', message: 'Pipeline ended unexpectedly', filenames })

    } catch (err: any) {
      clearInterval(elapsedInterval)
      setStage({ kind: 'error', message: err.message || 'Network error', filenames })
    }
  }, [onResult])

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList?.length) return
    const files = Array.from(fileList)

    // Reject .doc — legacy binary format, not extractable
    const legacyDoc = files.filter(f => f.name.toLowerCase().endsWith('.doc'))
    if (legacyDoc.length) {
      setStage({
        kind: 'error',
        message: `.doc files are not supported.\nPlease save as .docx and re-upload.`,
      })
      return
    }

    // Reject unsupported extensions
    const unsupported = files.filter(f => !f.name.match(ACCEPTED_EXTENSIONS))
    if (unsupported.length) {
      setStage({
        kind: 'error',
        message: `Unsupported file type: ${unsupported.map(f => f.name).join(', ')}\nAccepted: PDF, ZIP, DOCX, XLSX, XLS, CSV`,
      })
      return
    }

    // Size checks per file
    for (const file of files) {
      const limit = file.name.match(/\.zip$/i) ? MAX_ZIP_BYTES : MAX_SINGLE_FILE_BYTES
      if (file.size > limit) {
        setStage({
          kind: 'error',
          message: `${file.name} is too large (${formatBytes(file.size)}).\nMaximum: ${formatBytes(limit)}.`,
        })
        return
      }
    }

    // File count cap
    if (files.length > MAX_FILE_COUNT) {
      setStage({
        kind: 'error',
        message: `Too many files (${files.length} selected, max ${MAX_FILE_COUNT}).\nFor large data rooms, use a single ZIP file instead.`,
      })
      return
    }

    run(files)
  }, [run])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const s = stage

  // For many files, show a condensed summary rather than 30 individual bars
  const SHOW_INDIVIDUAL_BARS = 8

  return (
    <>
      <style>{`
        @keyframes abounce {
          0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
          40%          { transform: scale(1);   opacity: 1; }
        }
        @keyframes stepFadeIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .upload-wrap { max-width: 520px; margin: 0 auto; padding: 40px 24px; }
        @media (max-width: 480px) {
          .upload-wrap  { padding: 24px 16px; }
          .upload-drop  { padding: 40px 20px !important; }
          .upload-title { font-size: 16px !important; }
          .upload-cta   { width: 100%; display: block; text-align: center; }
        }
      `}</style>

      <div className="upload-wrap">

        {/* ── IDLE ── */}
        {s.kind === 'idle' && (
          <label
            className="upload-drop"
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{
              display: 'block', cursor: 'pointer',
              border: `2px dashed ${dragging ? '#00b4a0' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 12, padding: '60px 32px', textAlign: 'center',
              background: dragging ? 'rgba(0,180,160,0.06)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
            }}
          >
            <input
              type="file"
              accept=".pdf,.zip,.docx,.xlsx,.xls,.csv"
              multiple
              style={{ display: 'none' }}
              onChange={e => handleFiles(e.target.files)}
            />
            <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
            <div className="upload-title" style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              Drop your IM here
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
              PDF · DOCX · XLSX · ZIP data room
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 20 }}>
              Up to 30 files · ZIP extracted automatically
            </div>
            <div className="upload-cta" style={{
              display: 'inline-block', background: '#00b4a0', color: '#0d1b2a',
              fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: 8,
            }}>
              Choose files
            </div>
          </label>
        )}

        {/* ── UPLOADING ── */}
        {s.kind === 'uploading' && (() => {
          const doneCount = s.files.filter(f => f.done).length
          const totalCount = s.files.length
          const showBars = totalCount <= SHOW_INDIVIDUAL_BARS

          return (
            <div style={{ padding: '40px 0' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 6, textAlign: 'center' }}>
                Uploading {doneCount} of {totalCount}…
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 24 }}>
                {s.files.find(f => !f.done)?.name ?? ''}
              </div>

              {showBars ? (
                // Individual bars for small file sets
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {s.files.map((f, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{
                          fontSize: 12,
                          color: f.done ? 'rgba(255,255,255,0.35)' : '#fff',
                          fontFamily: 'IBM Plex Mono, monospace',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: '82%',
                        }}>
                          {f.name}
                        </span>
                        <span style={{ fontSize: 12, flexShrink: 0, color: f.done ? '#00b4a0' : 'rgba(255,255,255,0.3)' }}>
                          {f.done ? '✓' : `${f.pct}%`}
                        </span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 100, height: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 100,
                          background: f.done ? '#00b4a0' : 'rgba(0,180,160,0.55)',
                          width: `${f.pct}%`,
                          transition: 'width 0.35s ease',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Summary view for large file sets
                <>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 100, height: 6, overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{
                      height: '100%', borderRadius: 100, background: '#00b4a0',
                      width: `${(doneCount / totalCount) * 100}%`,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                    {s.files.map((f, i) => (
                      <div
                        key={i}
                        title={f.name}
                        style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: f.done
                            ? '#00b4a0'
                            : !s.files[i - 1]?.done && i === doneCount
                            ? 'rgba(0,180,160,0.4)'
                            : 'rgba(255,255,255,0.1)',
                          transition: 'background 0.3s',
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* ── PROCESSING ── */}
        {s.kind === 'processing' && (
          <div style={{ padding: '32px 0' }}>
            {/* File pills — show up to 6, then summarise */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
              {s.filenames.slice(0, 6).map((name, i) => (
                <span key={i} style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.4)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 4, padding: '2px 8px',
                  maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {name}
                </span>
              ))}
              {s.filenames.length > 6 && (
                <span style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.3)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 4, padding: '2px 8px',
                }}>
                  +{s.filenames.length - 6} more
                </span>
              )}
            </div>

            {/* Step checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {PIPELINE_STEPS.map(({ step, label }) => {
                const cur       = s.progress?.step ?? 0
                const isDone    = step < cur
                const isActive  = step === cur
                const isPending = step > cur

                return (
                  <div key={step} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    opacity: isPending ? 0.3 : 1,
                    animation: isActive ? 'stepFadeIn 0.3s ease' : undefined,
                    transition: 'opacity 0.3s',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDone
                        ? '#00b4a0'
                        : isActive ? 'rgba(0,180,160,0.15)' : 'rgba(255,255,255,0.06)',
                      border: isActive ? '2px solid #00b4a0' : '2px solid transparent',
                      marginTop: 1,
                    }}>
                      {isDone ? (
                        <span style={{ color: '#0d1b2a', fontWeight: 700, fontSize: 11 }}>✓</span>
                      ) : isActive ? (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%', background: '#00b4a0',
                          animation: 'abounce 1s infinite ease-in-out',
                        }} />
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>{step}</span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 400,
                        color: isDone
                          ? 'rgba(255,255,255,0.4)'
                          : isActive ? '#fff' : 'rgba(255,255,255,0.25)',
                      }}>
                        {label}
                      </div>
                      {isActive && s.progress?.detail && (
                        <div style={{
                          fontSize: 11, color: 'rgba(255,255,255,0.35)',
                          fontFamily: 'IBM Plex Mono, monospace', marginTop: 3,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {s.progress.detail}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 100, height: 3, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{
                height: '100%', borderRadius: 100, background: '#00b4a0',
                width: `${((s.progress?.step ?? 0) / 5) * 100}%`,
                transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>

            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.25)',
              fontFamily: 'IBM Plex Mono, monospace', textAlign: 'center',
            }}>
              {s.elapsed}s · typically 45–120s for large data rooms
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {s.kind === 'error' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Something went wrong</div>
            {s.filenames?.length && (
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,0.35)',
                fontFamily: 'IBM Plex Mono, monospace', marginBottom: 12,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.filenames.slice(0, 3).join(' · ')}
                {s.filenames.length > 3 ? ` +${s.filenames.length - 3} more` : ''}
              </div>
            )}
            <div style={{
              fontSize: 13, color: '#ef4444', marginBottom: 28,
              lineHeight: 1.6, whiteSpace: 'pre-line',
            }}>
              {s.message}
            </div>
            <button
              onClick={() => setStage({ kind: 'idle' })}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '10px 24px', color: 'rgba(255,255,255,0.6)',
                fontSize: 13, cursor: 'pointer', width: 'min(100%, 200px)',
              }}
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </>
  )
}
