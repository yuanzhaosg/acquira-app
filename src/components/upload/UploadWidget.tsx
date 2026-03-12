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

type Stage =
  | { kind: 'idle' }
  | { kind: 'uploading'; pct: number; filename: string }
  | { kind: 'processing'; filename: string; elapsed: number }
  | { kind: 'error'; message: string; filename?: string }

export default function UploadWidget({ onResult }: UploadWidgetProps) {
  const [stage, setStage]     = useState<Stage>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)

  const process = useCallback(async (file: File) => {
    const filename = file.name
    setStage({ kind: 'uploading', pct: 0, filename })

    const storagePath = `pipeline/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

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
    await new Promise(r => setTimeout(r, 400))

    const startTime = Date.now()
    setStage({ kind: 'processing', filename, elapsed: 0 })

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

      clearInterval(elapsedInterval)

      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch {
        setStage({ kind: 'error', message: `Unexpected response: ${text.slice(0, 120)}`, filename })
        return
      }

      if (!res.ok || data.error) {
        setStage({ kind: 'error', message: data.error || `HTTP ${res.status}`, filename })
        return
      }

      supabase.storage.from('uploads').remove([storagePath])
      onResult(data.extracted, data.scored)
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
        .upload-wrap {
          max-width: 520px;
          margin: 0 auto;
          padding: 40px 24px;
        }
        @media (max-width: 480px) {
          .upload-wrap { padding: 24px 16px; }
          .upload-drop  { padding: 40px 20px !important; }
          .upload-drop-title { font-size: 16px !important; }
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
              type="file" accept=".pdf,.zip"
              style={{ display: 'none' }}
              onChange={e => handleFiles(e.target.files)}
            />
            <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
            <div className="upload-drop-title" style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              Drop your IM here
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
              PDF or ZIP data room · Any size
            </div>
            <div className="upload-cta" style={{
              display: 'inline-block', background: '#00b4a0', color: '#0d1b2a',
              fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: 8
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
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%'
            }}>
              {s.filename}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 24 }}>
              {s.pct < 100 ? 'Uploading…' : 'Upload complete ✓'}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 100, height: 6, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{
                height: '100%', borderRadius: 100, background: '#00b4a0',
                width: `${s.pct}%`, transition: 'width 0.4s ease'
              }} />
            </div>
            <div style={{ fontSize: 13, color: '#00b4a0', fontFamily: 'IBM Plex Mono, monospace' }}>
              {s.pct}%
            </div>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {s.kind === 'processing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8,
              fontFamily: 'IBM Plex Mono, monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%'
            }}>
              {s.filename}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              Analysing with Acquira…
            </div>
            {/* Updated: reflects 17 dimensions */}
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 32, lineHeight: 1.6 }}>
              Extracting metrics · Scoring 17 dimensions · Mapping competitors
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#00b4a0',
                  animation: `abounce 1.2s ${i * 0.2}s infinite ease-in-out`
                }} />
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono, monospace' }}>
              {s.elapsed}s elapsed · typically 45–90s
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {s.kind === 'error' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              Something went wrong
            </div>
            {s.filename && (
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,0.35)',
                fontFamily: 'IBM Plex Mono, monospace', marginBottom: 12,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%'
              }}>
                {s.filename}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 28, lineHeight: 1.5 }}>
              {s.message}
            </div>
            <button
              onClick={() => setStage({ kind: 'idle' })}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '10px 24px',
                color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer',
                // Full-width on mobile
                width: 'min(100%, 200px)',
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
