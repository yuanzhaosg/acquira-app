'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Archive, Loader2, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

type PipelineStatus = 'idle' | 'uploading' | 'extracting' | 'scoring' | 'done' | 'error'

interface UploadWidgetProps {
  onResult: (extracted: unknown, scored: unknown) => void
}

export default function UploadWidget({ onResult }: UploadWidgetProps) {
  const [status, setStatus] = useState<PipelineStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)

  // FIX: wrap in useCallback so onDrop's stale closure always has the latest version
  const runPipeline = useCallback(async (file: File) => {
    setFilename(file.name)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // FIX: show 'uploading' while the request is in-flight
      // The pipeline route handles both extraction + scoring server-side in one
      // request, so we animate through the steps with timed delays to give
      // the user meaningful feedback during the ~60s wait.
      setStatus('uploading')

      // Start the fetch — don't await yet
      const fetchPromise = fetch('/api/pipeline', {
        method: 'POST',
        body: formData,
      })

      // After 3s, advance to 'extracting' (still waiting on server)
      const extractTimer = setTimeout(() => setStatus('extracting'), 3000)
      // After 20s, advance to 'scoring'
      const scoreTimer = setTimeout(() => setStatus('scoring'), 20000)

      const res = await fetchPromise
      clearTimeout(extractTimer)
      clearTimeout(scoreTimer)

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Pipeline failed')
      }

      setStatus('done')
      onResult(data.extracted, data.scored)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
    }
  }, [onResult])

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) runPipeline(accepted[0])
  }, [runPipeline])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: status !== 'idle' && status !== 'error' && status !== 'done',
  })

  const statusMessages: Record<PipelineStatus, string> = {
    idle:       'Drop your IM or data room here',
    uploading:  'Uploading...',
    extracting: 'Extracting data from documents...',
    scoring:    'Scoring across 10 dimensions...',
    done:       'Done — report ready',
    error:      'Something went wrong',
  }

  const steps: PipelineStatus[] = ['uploading', 'extracting', 'scoring', 'done']
  const currentIdx = steps.indexOf(status)

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-teal-400 bg-teal-400/5'
            : status === 'error'
            ? 'border-red-500/50 bg-red-500/5'
            : status === 'done'
            ? 'border-teal-500/50 bg-teal-500/5'
            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
        )}
      >
        <input {...getInputProps()} />

        {/* Icon */}
        <div className="flex justify-center mb-4">
          {status === 'idle' || status === 'done' ? (
            <Upload className="w-10 h-10 text-white/30" />
          ) : status === 'error' ? (
            <AlertCircle className="w-10 h-10 text-red-400" />
          ) : (
            <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
          )}
        </div>

        {/* Status message */}
        <p className="text-white/60 text-sm mb-2">
          {statusMessages[status]}
        </p>

        {/* Filename */}
        {filename && (
          <div className="flex items-center justify-center gap-2 mt-3">
            {filename.endsWith('.zip')
              ? <Archive className="w-4 h-4 text-white/40" />
              : <FileText className="w-4 h-4 text-white/40" />
            }
            <span className="text-xs text-white/40 font-mono">{filename}</span>
          </div>
        )}

        {/* Progress steps */}
        {status !== 'idle' && status !== 'error' && (
          <div className="flex justify-center gap-6 mt-6">
            {steps.map((step, stepIdx) => {
              const isDone = stepIdx < currentIdx || status === 'done'
              const isActive = stepIdx === currentIdx && status !== 'done'
              return (
                <div key={step} className="flex flex-col items-center gap-1">
                  <div className={clsx(
                    'w-2 h-2 rounded-full transition-all',
                    isDone ? 'bg-teal-400' : isActive ? 'bg-teal-400 animate-pulse' : 'bg-white/10'
                  )} />
                  <span className={clsx(
                    'text-xs',
                    isDone || isActive ? 'text-white/60' : 'text-white/20'
                  )}>
                    {step === 'uploading' ? 'upload' : step === 'extracting' ? 'extract' : step === 'scoring' ? 'score' : 'done'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        {/* Reset after done or error */}
        {(status === 'done' || status === 'error') && (
          <button
            onClick={(e) => { e.stopPropagation(); setStatus('idle'); setFilename(null); setError(null) }}
            className="mt-4 text-xs text-white/40 hover:text-white/60 underline"
          >
            Upload another
          </button>
        )}
      </div>

      {/* Accepted formats hint */}
      {status === 'idle' && (
        <p className="text-center text-xs text-white/25 mt-3">
          PDF Information Memorandum · ZIP data room · Max 50MB
        </p>
      )}
    </div>
  )
}
