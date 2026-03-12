'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface UploadWidgetProps {
  onResult: (extracted: unknown, scored: unknown) => void
}

interface ProgressStep {
  step: number
  total: number
  label: string
  detail?: string
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'uploading'; pct: number; filename: string }
  | { kind: 'processing'; filename: string; elapsed: number; progress: ProgressStep | null }
  | { kind: 'error'; message: string; filename?: string }

const PIPELINE_STEPS = [
  { step: 1, label: 'Parse file' },
  { step: 2, label: 'Extract metrics' },
  { step: 3, label: 'Score 17 dimensions' },
  { step: 4, label: 'Generate report' },
  { step: 5, label: 'Complete' },
]

export default function UploadWidget({ onResult }: UploadWidgetProps) {
  const [stage, setStage]       = useState<Stage>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)

  const process = useCallback(async (file: File) => {
    const filename = file.name
    setStage({ kind: 'uploading', pct: 0, filename })

    const storagePath = `pipeline/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    // ── Upload to Supabase Storage ──────────────────────────────────────────
    const progressInterval = setInterval(() => {
      setStage(prev =>
        prev.kind === 'uploading'
          ? { ...prev, pct: Math.min(prev.pct + 6, 88) }
          : prev
      )
    }, 500)

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, file, {
        cacheControl: '300',
        upsert: false,
        contentType: file.type || 'application/pdf',
      })

    clearInterval(progressInterval)

    if (uploadError) {
      setStage({ kind: 'error', message: `Upload failed: ${uploadError.message}`, filename })
      return
    }

    setStage({ kind: 'uploading', pct: 100, filename })
    await new Promise(r => setTimeout(r, 300))

    // ── Start pipeline — read SSE stream ───────────────────────────────────
    const startTime = Date.now()
    setStage({ kind: 'processing', filename, elapsed: 0, progress: null })

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
        body: JSON.stringify({ storagePath, filename }),
      })

      if (!res.ok || !res.body) {
        clearInterval(elapsedInterval)
        setStage({ kind: 'error', message: `Pipeline error: HTTP ${res.status}`, filename })
        return
      }

      // Read SSE stream line by line
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Split on double newline (SSE event boundary)
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
            setStage({ kind: 'error', message: data.message || 'Pipeline failed', filename })
            return
          }
        }
      }

      clearInterval(elapsedInterval)
      setStage({ kind: 'error', message: 'Pipeline ended unexpectedly', filename })

    } catch (err: any) {
      clearInterval(elapsedInterval)
      setStage({ kind: 'error', message: err.message || 'Network error', filename })
    }
  }, [onResult])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    const file = files[0]
    if (!file.name.match(/\.(pdf|zip)$/i)) {
      setStage({ kind: 'error', message: 'Please upload a PDF or ZIP file' })
      return
    }
    process(file)
  }, [process])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const s = stage

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
            <input type="file" accept=".pdf,.zip" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
            <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
            <div className="upload-title" style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              Drop your IM here
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
              PDF or ZIP data room · Any size
            </div>
            <div className="upload-cta" style={{
              display: 'inline-block', background: '#00b4a0', color: '#0d1b2a',
              fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: 8,
            }}>
              Choose file
            </div>
          </label>
        )}

        {/* ── UPLOADING ── */}
        {s.kind === 'uploading' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8,
              fontFamily: 'IBM Plex Mono, monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{s.filename}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 24 }}>
              {s.pct < 100 ? 'Uploading…' : 'Upload complete ✓'}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 100, height: 6, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', borderRadius: 100, background: '#00b4a0', width: `${s.pct}%`, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: 13, color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace' }}>{s.pct}%</div>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {s.kind === 'processing' && (
          <div style={{ padding: '32px 0' }}>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20,
              fontFamily: 'IBM Plex Mono, monospace', textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{s.filename}</div>

            {/* Step checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {PIPELINE_STEPS.map(({ step, label }) => {
                const cur     = s.progress?.step ?? 0
                const isDone  = step < cur
                const isActive = step === cur
                const isPending = step > cur

                return (
                  <div key={step} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    opacity: isPending ? 0.3 : 1,
                    animation: isActive ? 'stepFadeIn 0.3s ease' : undefined,
                    transition: 'opacity 0.3s',
                  }}>
                    {/* Icon */}
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
                          animation: 'abounce 1s 0s infinite ease-in-out',
                        }} />
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>{step}</span>
                      )}
                    </div>

                    {/* Text */}
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

            {/* Thin progress bar */}
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
              {s.elapsed}s · typically 45–90s
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {s.kind === 'error' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Something went wrong</div>
            {s.filename && (
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,0.35)',
                fontFamily: 'IBM Plex Mono, monospace', marginBottom: 12,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{s.filename}</div>
            )}
            <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 28, lineHeight: 1.5 }}>{s.message}</div>
            <button
              onClick={() => setStage({ kind: 'idle' })}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '10px 24px', color: 'rgba(255,255,255,0.6)',
                fontSize: 13, cursor: 'pointer', width: 'min(100%, 200px)',
              }}
            >
              Upload another
            </button>
          </div>
        )}

      </div>
    </>
  )
}
