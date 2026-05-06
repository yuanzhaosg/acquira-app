export const DEFAULT_BACKEND_URL = 'https://web-production-c3589.up.railway.app'

export function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function getPublicBackendUrl(): string {
  return normalizeBackendUrl(
    process.env.NEXT_PUBLIC_API_BASE ||
      process.env.NEXT_PUBLIC_RAILWAY_API_URL ||
      DEFAULT_BACKEND_URL,
  )
}
