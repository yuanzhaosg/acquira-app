import { NextRequest, NextResponse } from 'next/server'
import { getServerBackendUrl } from '@/lib/serverBackendUrl'

export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function sseError(message: string, status = 500) {
  return new Response(
    `event: error\ndata: ${JSON.stringify({ message })}\n\n`,
    {
      status,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }
  )
}

export async function GET() {
  let railwayUrl: string

  try {
    railwayUrl = getServerBackendUrl()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pipeline backend URL is not configured'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  try {
    const healthRes = await fetch(`${railwayUrl}/health`, { cache: 'no-store' })
    const health = await healthRes.json().catch(() => null)
    return NextResponse.json({
      ok: healthRes.ok,
      backend_host: new URL(railwayUrl).host,
      health,
    }, { status: healthRes.ok ? 200 : 502 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pipeline backend health check failed'
    return NextResponse.json({
      ok: false,
      backend_host: new URL(railwayUrl).host,
      error: message,
    }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = await req.json()
  } catch {
    return sseError('Invalid JSON request body', 400)
  }

  let railwayUrl: string
  try {
    railwayUrl = getServerBackendUrl()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pipeline backend URL is not configured'
    return sseError(message, 500)
  }

  const upstreamUrl = `${railwayUrl}/pipeline`

  console.log('[api/pipeline] forwarding to Railway:', upstreamUrl)
  console.log('[api/pipeline] payload:', {
    storagePath: body?.storagePath,
    storagePaths: body?.storagePaths,
    filename: body?.filename,
    filenames: body?.filenames,
    pipelineIntel: body?.pipelineIntel,
  })

  let railwayRes: Response

  try {
    railwayRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[api/pipeline] Railway connection failed:', err)
    const message = err instanceof Error ? err.message : 'Pipeline connection failed'
    return sseError(message, 502)
  }

  if (!railwayRes.ok || !railwayRes.body) {
    const text = await railwayRes.text().catch(() => '')
    console.error('[api/pipeline] Railway returned error:', railwayRes.status, text)

    return sseError(
      `Railway returned HTTP ${railwayRes.status}${text ? `: ${text.slice(0, 500)}` : ''}`,
      railwayRes.status
    )
  }

  return new Response(railwayRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
