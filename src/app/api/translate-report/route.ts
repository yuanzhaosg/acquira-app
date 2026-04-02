import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-haiku-4-20250514'
export const maxDuration = 60

/**
 * Translates Acquira report narrative text to Simplified Chinese.
 *
 * Only translates human-readable narrative fields:
 *   - dimension summaries
 *   - verdict one_liner + recommended_buyer_profile
 *   - deal_breaker_flags reasons
 *   - audit_trail confidence_note
 *   - IC recommendation rationale
 *
 * Numbers, percentages, labels, metric names stay in English —
 * standard practice in Australian Chinese-language finance.
 */
export async function POST(req: NextRequest) {
  try {
    const { scored } = await req.json()
    if (!scored) return NextResponse.json({ error: 'No scored data' }, { status: 400 })

    // Extract all text fields that need translation
    const toTranslate: Record<string, string> = {}

    // Dimension summaries
    const dims = scored.dimensions ?? {}
    for (const [id, dim] of Object.entries(dims)) {
      const d = dim as any
      if (d?.summary) toTranslate[`dim_${id}_summary`] = d.summary
      // Detail notes
      if (d?.detail?.subsidy_cliff_note) toTranslate[`dim_${id}_subsidy_note`] = d.detail.subsidy_cliff_note
      if (d?.detail?.notes) toTranslate[`dim_${id}_notes`] = d.detail.notes
      if (d?.detail?.pricing_power_note) toTranslate[`dim_${id}_pricing_note`] = d.detail.pricing_power_note
      if (d?.detail?.compliance_note) toTranslate[`dim_${id}_compliance_note`] = d.detail.compliance_note
      if (d?.detail?.trend_note) toTranslate[`dim_${id}_trend_note`] = d.detail.trend_note
    }

    // Verdict
    if (scored.verdict?.one_liner) toTranslate['verdict_one_liner'] = scored.verdict.one_liner
    if (scored.verdict?.recommended_buyer_profile) toTranslate['verdict_buyer_profile'] = scored.verdict.recommended_buyer_profile
    if (scored.analyst_summary) toTranslate['analyst_summary'] = scored.analyst_summary

    // Deal-breaker flags
    const flags = scored.deal_breaker_flags?.flags ?? []
    for (let i = 0; i < flags.length; i++) {
      if (flags[i]?.triggered && flags[i]?.reason) {
        toTranslate[`flag_${i}_reason`] = flags[i].reason
      }
    }

    // Audit trail
    if (scored.audit_trail?.confidence_note) {
      toTranslate['audit_confidence_note'] = scored.audit_trail.confidence_note
    }

    // IC recommendation rationale
    if (scored.ic_recommendation_rationale) {
      toTranslate['ic_rationale'] = scored.ic_recommendation_rationale
    }

    if (Object.keys(toTranslate).length === 0) {
      return NextResponse.json({ translations: {} })
    }

    // Single Claude call — translate all fields at once
    const prompt = `You are a professional financial translator specialising in Australian childcare investment reports.
Translate the following English text fields to Simplified Chinese (简体中文).

Rules:
1. Preserve all numbers, percentages, dollar amounts, and metric names in English (e.g. "EBITDA", "NQS", "$1.2m", "71%")
2. Keep Australian place names in English (e.g. "Brighton", "Surrey Hills", "VIC")
3. Keep proper nouns in English (e.g. "ACECQA", "ABS", "CCS", "DoE")
4. Use professional financial Chinese — clear, concise, institutional tone
5. Return ONLY a valid JSON object with the same keys as the input, values replaced with Chinese translations
6. Do not add explanations outside the JSON

Input:
${JSON.stringify(toTranslate, null, 2)}`

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in translation response')

    const translations: Record<string, string> = JSON.parse(jsonMatch[0])

    return NextResponse.json({ translations })
  } catch (e: any) {
    console.error('translate-report error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
