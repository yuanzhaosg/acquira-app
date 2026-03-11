import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SCORING_SYSTEM_PROMPT } from '@/lib/prompts/scoring-v1'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { extracted, overrides } = await req.json()

    // Build override context note for the scoring prompt
    const overrideNote = Object.keys(overrides).length > 0
      ? `\n\nMANUAL OVERRIDES APPLIED BY ANALYST:\n${Object.entries(overrides)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n')}\nTreat these values as confirmed facts. Do not flag them as missing or uncertain.`
      : ''

    const scoringResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SCORING_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Score this childcare centre acquisition based on the extracted data below.${overrideNote}\n\nEXTRACTED DATA:\n${JSON.stringify(extracted, null, 2)}`
      }]
    })

    const scoredText = scoringResponse.content[0].type === 'text'
      ? scoringResponse.content[0].text.replace(/:\s*\+([0-9])/g, ': $1')
      : ''

    const jsonMatch = scoredText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in scoring response')

    const scored = JSON.parse(jsonMatch[0])
    return NextResponse.json(scored)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Rescore failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
