import { NextRequest, NextResponse } from 'next/server'

const RAILWAY_URL = process.env.RAILWAY_API_URL || 'https://web-production-c3589.up.railway.app'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${RAILWAY_URL}/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Pipeline failed' }, { status: 500 })
  }
}

export const maxDuration = 300
