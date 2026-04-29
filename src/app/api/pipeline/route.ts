import { NextRequest } from 'next/server'

const RAILWAY_URL =
  process.env.RAILWAY_API_URL ||
  'https://web-production-c3589.up.railway.app'

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

export async function POST(req: NextRequest) {
  let body: any

  try {
    body = await req.json()
  } catch {
    return sseError('Invalid JSON request body', 400)
  }

  const upstreamUrl = `${RAILWAY_URL.replace(/\/$/, '')}/pipeline`

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
  } catch (err: any) {
    console.error('[api/pipeline] Railway connection failed:', err)
    return sseError(err?.message || 'Pipeline connection failed', 502)
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
