import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const evidencePanel = read('src/components/diligence/EvidenceRequestsPanel.tsx')
const reunderwriteModal = read('src/components/report/ReunderwriteModal.tsx')
const reunderwriteRoute = read('src/app/api/deals/[id]/reunderwrite/route.ts')
const runHistory = read('src/components/report/RunHistoryDrawer.tsx')
const icMemo = read('src/components/report/ICMemoView.tsx')
const marketAudit = read('src/components/report/MarketAuditPanel.tsx')
const icPackExport = read('src/components/report/ICPackExport.tsx')
const reportView = read('src/components/report/ReportView.tsx')

assert(
  /execution_mode:\s*'sync'/.test(evidencePanel),
  'EvidenceRequestsPanel must send execution_mode sync for Run now.',
)
assert(
  /execution_mode:\s*'sync'/.test(reunderwriteModal),
  'ReunderwriteModal must send execution_mode sync for immediate re-underwriting.',
)
assert(
  /background worker and will not process until the worker is deployed/.test(runHistory)
    && /background worker and will not process until the worker is deployed/.test(evidencePanel),
  'Queued async placeholder copy must clearly require the background worker.',
)
assert(
  /Notes\/status attached to selected diligence documents are included as manual context with lower confidence/.test(reunderwriteModal),
  'Manual notes context warning must be visible in the re-underwrite flow.',
)
assert(
  /manualEvidenceForSelectedDocuments/.test(reunderwriteRoute)
    && /manual_evidence_notes:\s*manualEvidenceNotes/.test(reunderwriteRoute),
  'Re-underwrite route must include selected diligence item notes/status as manual evidence context.',
)
assert(
  /manual_context_fields:\s*manualContextFields/.test(reunderwriteModal)
    && /manualContextNotes\(body\.manual_context_fields\)/.test(reunderwriteRoute)
    && /has_asking_price/.test(reunderwriteRoute),
  'Re-underwrite flow must include asking price/manual context fields in the backend payload and safe logs.',
)

for (const title of [
  '1. Recommendation and Confidence',
  '2. Key Red Flags / Conflicts',
  '3. What Would Change The Recommendation',
  '4. Evidence Readiness',
  '5. Investment Thesis',
  '6. Key Facts',
  '7. Derived Metrics and Recipes',
  '8. Market / Pipeline Evidence',
  '9. What Is Missing / Valuation Gate',
  '10. Broker / Seller Request List',
  '11. Appendix / Extraction Ledger',
]) {
  assert(icMemo.includes(title), `IC memo missing section: ${title}`)
}

assert(
  /isHardFact[\s\S]*category === 'centre'/.test(icMemo)
    && /classifyFact[\s\S]*if \(fact\.trust === 'disputed'/.test(icMemo)
    && /classifyFact[\s\S]*if \(isHardFact\(fact\)\) return 'key_fact'/.test(icMemo),
  'IC memo hard facts must classify as Key Facts rather than Investment Thesis.',
)
assert(
  /function EvidenceReadiness/.test(icMemo)
    && /Found \/ accepted/.test(icMemo)
    && /Excluded from underwriting/.test(icMemo)
    && /Manual context/.test(icMemo),
  'Evidence Readiness must render provenance/trust/use groups.',
)
assert(
  /function periodLabel/.test(icMemo)
    && /coverage_reason/.test(icMemo)
    && /period_label/.test(icMemo),
  'Evidence Readiness must render period labels and coverage reasons.',
)
assert(
  /High<\/strong> = source-backed exact value/.test(icMemo)
    && /Medium<\/strong> = extracted or inferred, needs review/.test(icMemo)
    && /Missing<\/strong> = required evidence not found/.test(icMemo),
  'IC memo confidence legend is missing or unclear.',
)

assert(
  !/if \(!audit\) return null/.test(marketAudit),
  'MarketAuditSummary must not disappear when market_audit is absent.',
)
assert(
  /Market evidence \{status === 'missing' \? 'unavailable' : 'partial'\}/.test(marketAudit)
    && /Request demographic source, competitor set, geocode method, and DA\/pipeline evidence/.test(marketAudit),
  'Market Evidence missing/partial state must show useful next actions.',
)
assert(
  /function canonicalFact/.test(icPackExport)
    && /workflow\?\.canonical_facts/.test(icPackExport)
    && /Key Underwriting Facts/.test(icPackExport),
  'IC Pack export must use canonical ledger facts for displayed underwriting facts.',
)
assert(
  /IC_PACK_EXPORT_VERSION ledger-v2 \/ commit 7e5985a/.test(icPackExport)
    && /ic-pack-version-marker/.test(icPackExport),
  'IC Pack export must include temporary ledger-v2 print marker for deployment verification.',
)
assert(
  /ValuationGateRows/.test(icPackExport)
    && /Review required/.test(icPackExport)
    && !/value=\{valuationBlocked \|\| gate \? \(evidenceState\.revenue \? 'Present' : 'Missing'\)/.test(icPackExport),
  'IC Pack valuation gate must render underwriting use labels, not Present/Missing booleans.',
)
assert(
  /function sanitizeReportText/.test(icPackExport)
    && /42703/.test(icPackExport)
    && /investorWarning\(warning\)/.test(icPackExport),
  'IC Pack export must sanitize technical provider/database errors.',
)
assert(
  /Evidence Readiness/.test(icPackExport)
    && /EvidenceReadinessRows/.test(icPackExport)
    && /Recommendation and Confidence/.test(icPackExport),
  'IC Pack export must lead with decision context and show Evidence Readiness prominently.',
)
assert(
  !/Source quality:/.test(icPackExport)
    && /Underwriting confidence/.test(icPackExport)
    && /Extraction completeness/.test(icPackExport),
  'IC Pack export must replace global Source quality with honest aggregate labels.',
)
for (const legacyPrintString of [
  'Deal Facts & Source Confidence',
  'REVENUE EVIDENCE',
  'PAYROLL / LABOUR',
  'OCCUPANCY HISTORY',
  'Missing Information',
  'Required before confident underwriting.',
  'FACT VALUE SOURCE / CONFIDENCE',
]) {
  assert(!icPackExport.includes(legacyPrintString), `IC Pack export still contains legacy print string: ${legacyPrintString}`)
}
assert(
  !/avg 13wk occupancy pct/i.test(icPackExport),
  'IC Pack export must not render raw occupancy schema field names.',
)
assert(
  /requestText\(item/.test(icPackExport)
    && /replace\(\/\\b\[a-z\]\+\(_\[a-z0-9\]\+\)\+\\b\/g/.test(icPackExport),
  'IC Pack export must suppress raw snake_case field names in broker requests.',
)
assert(
  /hasCanonicalFinancials/.test(icPackExport)
    && /Legacy score narrative suppressed for print/.test(icPackExport),
  'IC Pack export must suppress legacy scoring prose that can conflict with canonical financial facts.',
)
assert(
  /\.has-ic-pack > :not\(\.ic-pack-export\):not\(style\)/.test(reportView),
  'ReportView print CSS must isolate the IC Pack export instead of printing legacy report sections.',
)

console.log('Frontend regression checks passed.')
