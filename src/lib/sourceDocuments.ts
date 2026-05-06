import type { SupabaseClient } from '@supabase/supabase-js'
import type { RetainedSourceFile } from '@/types/runs'

type SupabaseLike = SupabaseClient

export interface CanonicalizedSourceFile extends RetainedSourceFile {
  old_retained_storage_path?: string | null
  canonicalization_warning?: string
}

export function sanitizeSourceFilename(filename: string): string {
  return (filename || 'source_document')
    .replace(/[\\/]+/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 180) || 'source_document'
}

export function buildCanonicalSourcePath(
  dealId: string,
  runId: string,
  filename: string,
  index = 0,
): string {
  return `deal-sources/${dealId}/${runId}/${index + 1}-${sanitizeSourceFilename(filename)}`
}

export function isSafeSourcePath(path: string): boolean {
  if (!path.startsWith('deal-sources/')) return false
  if (path.includes('..') || path.includes('\\')) return false
  if (/[\u0000-\u001f\u007f]/.test(path)) return false
  return !path.split('/').some(part => !part || part === '.' || part === '..')
}

export async function copySourceWithFallback(
  supabase: SupabaseLike,
  fromPath: string,
  toPath: string,
  contentType?: string | null,
): Promise<void> {
  const bucket = supabase.storage.from('uploads')
  const copyResult = await bucket.copy(fromPath, toPath)
  if (!copyResult.error) return

  const downloadResult = await bucket.download(fromPath)
  if (downloadResult.error || !downloadResult.data) {
    throw new Error(downloadResult.error?.message || copyResult.error.message || 'Failed to download retained source file')
  }

  const uploadResult = await bucket.upload(toPath, downloadResult.data, {
    contentType: contentType || 'application/octet-stream',
    upsert: true,
  })
  if (uploadResult.error) throw uploadResult.error
}

export async function canonicalizeRetainedSourceFiles(
  supabase: SupabaseLike,
  params: {
    deal_id: string
    run_id: string
    retained_source_files: RetainedSourceFile[]
  },
): Promise<CanonicalizedSourceFile[]> {
  const canonicalized: CanonicalizedSourceFile[] = []

  for (const [index, file] of params.retained_source_files.entries()) {
    const oldPath = file.retained_storage_path
    const canonicalPath = buildCanonicalSourcePath(params.deal_id, params.run_id, file.filename, index)

    try {
      if (!isSafeSourcePath(oldPath)) throw new Error('Retained source path is not under a safe deal-sources prefix')
      if (oldPath !== canonicalPath) {
        await copySourceWithFallback(supabase, oldPath, canonicalPath, file.content_type)
      }
      canonicalized.push({
        ...file,
        old_retained_storage_path: oldPath,
        retained_storage_path: canonicalPath,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Canonicalization failed'
      canonicalized.push({
        ...file,
        old_retained_storage_path: oldPath,
        retained_storage_path: oldPath,
        canonicalization_warning: message,
      })
    }
  }

  // Pending retained copies are intentionally left in place. A later cleanup job
  // can remove them after canonical paths have aged past the rollback window.
  return canonicalized
}
