import { DEFAULT_BACKEND_URL, normalizeBackendUrl } from '@/lib/backendUrls'

export function getServerBackendUrl(): string {
  const configuredUrl = process.env.RAILWAY_API_URL

  if (!configuredUrl && process.env.NODE_ENV === 'production') {
    throw new Error('RAILWAY_API_URL is not configured for the pipeline backend.')
  }

  return normalizeBackendUrl(configuredUrl || DEFAULT_BACKEND_URL)
}
