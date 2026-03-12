import { NextRequest } from 'next/server'

const RAILWAY_URL = process.env.RAILWAY_API_URL || 'https://web-production-c3589.up.railway.app'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json()

  let railwayRes: Response
  try {
    railwayRes = await fetch(`${RAILWAY_URL}/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err: any) {
    const errEvent = `event: error\ndata: ${JSON.stringify({ message: err.message || 'Pipeline connection failed' })}\n\n`
    return new Response(errEvent, {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  if (!railwayRes.ok || !railwayRes.body) {
    const errEvent = `event: error\ndata: ${JSON.stringify({ message: `Railway returned ${railwayRes.status}` })}\n\n`
    return new Response(errEvent, {
      status: railwayRes.status,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  // Forward the SSE stream directly from Railway to the browser
  return new Response(railwayRes.body, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
