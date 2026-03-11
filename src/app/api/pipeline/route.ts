import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import AdmZip from 'adm-zip'
import { EXTRACTION_SYSTEM_PROMPT } from '@/lib/prompts/extraction-v1'
import { SCORING_SYSTEM_PROMPT } from '@/lib/prompts/scoring-v1'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 8000

// ── FILE CLASSIFIER ──────────────────────────────────────────────────────────

type FileClass =
  | 'pl_excel'
  | 'occupancy_excel'
  | 'transaction_excel'
  | 'payroll_excel'
  | 'lease_pdf'
  | 'service_approval_pdf'
  | 'nqs_pdf'
  | 'im_pdf'
  | 'unknown'

function classifyFile(filename: string): FileClass {
  const f = filename.toLowerCase()
  if (f.includes('p&l') || f.includes('p_l') || f.includes('profit') || f.includes('loss')) return 'pl_excel'
  if (f.includes('occupancy') || f.includes('utilisation') || f.includes('utilization')) return 'occupancy_excel'
  if (f.includes('transaction')) return 'transaction_excel'
  if (f.includes('payroll')) return 'payroll_excel'
  if (f.includes('lease') || f.includes('deed of variation') || f.includes('tenancy')) return 'lease_pdf'
  if (f.includes('service approval')) return 'service_approval_pdf'
  if (f.includes('nqs') || f.includes('acecqa') || f.includes('rating')) return 'nqs_pdf'
  if (f.endsWith('.pdf')) return 'im_pdf'
  return 'unknown'
}

// ── PDF TEXT EXTRACTION ───────────────────────────────────────────────────────

function extractPdfText(pdfPath: string): string {
  try {
    const result = execSync(
      `python3 -c "
import pdfplumber, sys
text = ''
with pdfplumber.open('${pdfPath}') as pdf:
    for page in pdf.pages:
        t = page.extract_text()
        if t: text += t + '\\n'
print(text[:80000])
"`,
      { maxBuffer: 10 * 1024 * 1024 }
    )
    return result.toString()
  } catch (e) {
    return ''
  }
}

function isPdfScanned(text: string): boolean {
  const trimmed = text.trim()
  // Whole doc is sparse — definitely scanned
  if (trimmed.length < 200) return true
  // Doc has some text but financials are likely in images:
  // if avg chars per page is low AND no dollar amounts found, use Vision
  const pages = trimmed.split('\n\n')
  const avgChars = trimmed.length / Math.max(pages.length, 1)
  const hasDollarAmounts = /\$[\d,]+|[\d,]+\s*(revenue|ebitda|wages|labour|rent)/i.test(trimmed)
  if (avgChars < 300 && !hasDollarAmounts) return true
  return false
}

// ── VISION PDF EXTRACTION (for scanned docs) ─────────────────────────────────

async function extractScannedPdfText(pdfPath: string, purpose: string): Promise<string> {
  try {
    // Convert PDF pages to base64 images via Python
    const imagesJson = execSync(
      `python3 -c "
import fitz, base64, json, sys
doc = fitz.open('${pdfPath}')
images = []
for i, page in enumerate(doc):
    if i >= 60: break
    # Skip pages with very little content (headers/footers only)
    if len(page.get_text().strip()) < 30 and i > 3: continue
    mat = fitz.Matrix(1.5, 1.5)
    pix = page.get_pixmap(matrix=mat)
    images.append(base64.standard_b64encode(pix.tobytes('png')).decode())
    if len(images) >= 30: break
print(json.dumps(images))
"`,
      { maxBuffer: 50 * 1024 * 1024 }
    ).toString()

    const images: string[] = JSON.parse(imagesJson)
    if (!images.length) return ''

    const content: Anthropic.MessageParam['content'] = [
      ...images.map(img => ({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: 'image/png' as const, data: img }
      })),
      {
        type: 'text',
        text: `Extract all text content from these document pages. This is a ${purpose}. Return plain text only, preserving structure and numbers accurately.`
      }
    ]

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content }]
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  } catch (e) {
    console.error('Vision extraction failed:', e)
    return ''
  }
}

// ── MAIN PIPELINE ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const workDir = join(tmpdir(), `acquira-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const filename = file.name.toLowerCase()
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // ── STEP 1: Collect text from all relevant files ──
    let combinedText = ''
    const sourceFiles: string[] = []
    const fileClasses: Record<string, FileClass> = {}

    if (filename.endsWith('.zip')) {
      // ZIP: extract and classify each file
      const zip = new AdmZip(fileBuffer)
      const entries = zip.getEntries()

      for (const entry of entries) {
        if (entry.isDirectory) continue
        const entryName = entry.entryName.split('/').pop() || entry.entryName
        const fileClass = classifyFile(entryName)
        fileClasses[entryName] = fileClass

        if (fileClass === 'unknown') continue

        const entryPath = join(workDir, entryName.replace(/[^a-zA-Z0-9._-]/g, '_'))
        writeFileSync(entryPath, entry.getData())
        sourceFiles.push(entryName)

        if (entryName.endsWith('.pdf')) {
          let text = extractPdfText(entryPath)
          if (isPdfScanned(text)) {
            console.log(`Scanned PDF detected: ${entryName} — using Vision`)
            text = await extractScannedPdfText(entryPath, fileClass.replace('_', ' '))
          }
          combinedText += `\n\n=== ${entryName} (${fileClass}) ===\n${text}`
        } else if (entryName.endsWith('.xlsx') || entryName.endsWith('.xls')) {
          // Excel: convert to CSV via Python
          const csvText = execSync(
            `python3 -c "
import openpyxl, json
wb = openpyxl.load_workbook('${entryPath}', data_only=True)
out = []
for sheet in wb.sheetnames:
    ws = wb[sheet]
    out.append(f'Sheet: {sheet}')
    for row in ws.iter_rows(values_only=True):
        if any(v is not None for v in row):
            out.append(','.join(str(v) if v is not None else '' for v in row))
print('\\n'.join(out[:500]))
"`,
            { maxBuffer: 5 * 1024 * 1024 }
          ).toString()
          combinedText += `\n\n=== ${entryName} (${fileClass}) ===\n${csvText}`
        }
      }
    } else if (filename.endsWith('.pdf')) {
      // Single PDF IM
      const pdfPath = join(workDir, 'input.pdf')
      writeFileSync(pdfPath, fileBuffer)
      sourceFiles.push(file.name)

      let text = extractPdfText(pdfPath)
      if (isPdfScanned(text)) {
        console.log('Scanned PDF — using Vision')
        text = await extractScannedPdfText(pdfPath, 'Information Memorandum')
      }
      combinedText = text
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Upload a PDF or ZIP.' }, { status: 400 })
    }

    if (!combinedText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file.' }, { status: 422 })
    }

    // ── STEP 2: Extraction ──
    console.log('Running extraction...')
    const extractionResponse = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Extract structured data from this childcare centre document.\n\nSource files: ${sourceFiles.join(', ')}\n\nCONTENT:\n${combinedText.slice(0, 60000)}`
      }]
    })

    let extractedText = extractionResponse.content[0].type === 'text'
      ? extractionResponse.content[0].text : ''
    extractedText = extractedText.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```$/m, '').trim()
    const extracted = JSON.parse(extractedText)
    console.log("EXTRACTED:", JSON.stringify(extracted, null, 2))

    // ── STEP 3: Scoring ──
    console.log('Running scoring...')
    const scoringResponse = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SCORING_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Score this childcare centre deal.\n\nEXTRACTED DATA:\n${JSON.stringify(extracted, null, 2)}`
      }]
    })

    let scoredText = scoringResponse.content[0].type === 'text'
      ? scoringResponse.content[0].text : ''
    scoredText = scoredText.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```$/m, '').trim()
    // Fix +number JSON issue
    scoredText = scoredText.replace(/:\s*\+([0-9])/g, ': $1')
    const scored = JSON.parse(scoredText)

    return NextResponse.json({
      success: true,
      extracted,
      scored,
      meta: {
        source_files: sourceFiles,
        file_classes: fileClasses,
      }
    })

  } catch (error: unknown) {
    console.error('Pipeline error:', error)
    const message = error instanceof Error ? error.message : 'Pipeline failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


export const maxDuration = 120 // 2 min timeout for Vercel
