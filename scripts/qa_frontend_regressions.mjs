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
  '5. Why This Deal Could Work',
  '6. Key Facts',
  '7. Derived Metrics and Recipes',
  '8. Market & Competitive Position',
  '9. What We Do Not Know / Valuation Gate',
  '10. Broker / Seller Request List',
  '11. IC Decision & Deal Structure Recommendation',
  '12. Appendix / Extraction Ledger',
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
    && /Refer to canonical underwriting facts/.test(icPackExport),
  'IC Pack export must suppress legacy scoring prose that can conflict with canonical financial facts.',
)
assert(
  !/Canonical fact conflict/.test(icPackExport)
    && !/Legacy score narrative suppressed/.test(icPackExport),
  'IC Pack export must not expose internal ledger/debug strings.',
)
assert(
  /function conflictTitle/.test(icPackExport)
    && /Labour cost conflict/.test(icPackExport)
    && /Reconcile payroll definition/.test(icPackExport),
  'IC Pack export must convert canonical conflicts into investor-readable language.',
)
assert(
  /function uncertaintyItems/.test(icPackExport)
    && /What We Do Not Know/.test(icPackExport)
    && !/Document-based request for underwriting support/.test(icPackExport),
  'What We Do Not Know must render analytical uncertainties, not a missing-facts table.',
)
assert(
  /Blocked \/ Missing/.test(icPackExport)
    && /Excluded from underwriting/.test(icPackExport)
    && /field === 'asking_price'/.test(icPackExport)
    && /underwriting_use: 'blocked'/.test(icPackExport),
  'Evidence Readiness must group absent asking price as Blocked/Missing rather than Excluded.',
)
assert(
  /identityFields/.test(icPackExport)
    && /underwriting_use: 'accepted'/.test(icPackExport),
  'Source-backed identity facts must be promoted to Accepted in export readiness display.',
)
assert(
  /Postcode fallback competitors/.test(icPackExport)
    && /Geospatial competitor supply/.test(icPackExport)
    && /Market method summary/.test(icPackExport),
  'Market section must distinguish unavailable geospatial supply from postcode fallback competitors.',
)
assert(
  /valuation multiple blocked pending asking price/i.test(icPackExport)
    && /Financial evidence may be observed/.test(icPackExport),
  'Valuation gate and cover copy must be precise when asking price is missing but financial evidence exists.',
)
assert(
  /brokerRequestItems/.test(icPackExport)
    && /Reconcile labour cost/.test(icPackExport),
  'Broker requests must be specific and deduped.',
)
assert(
  /\.has-ic-pack > :not\(\.ic-pack-export\):not\(style\)/.test(reportView),
  'ReportView print CSS must isolate the IC Pack export instead of printing legacy report sections.',
)
assert(
  /REPORT_MODES/.test(reportView)
    && /label: 'Memo'/.test(reportView)
    && /label: 'Underwriting'/.test(reportView)
    && /label: 'Diligence'/.test(reportView)
    && /label: 'Evidence'/.test(reportView)
    && /label: 'Runs'/.test(reportView)
    && /activeReportMode === 'memo'/.test(reportView),
  'ReportView must split the page into Memo, Underwriting, Diligence, Evidence, and Runs modes with Memo as the default.',
)
assert(
  /activeReportMode === 'runs'[\s\S]*RunHistoryDrawer/.test(reportView)
    && /activeReportMode === 'diligence'[\s\S]*DiligenceWorkspace/.test(reportView)
    && /activeReportMode === 'evidence'[\s\S]*FactsReviewPanel/.test(reportView)
    && /activeReportMode === 'memo'[\s\S]*ICMemoView/.test(reportView),
  'Operational workflow panels must live outside the default Memo mode.',
)
assert(
  /function PublicMarketContextPanel/.test(reportView)
    && /Public Market Benchmark/.test(reportView)
    && /Local Demand-Supply Screen/.test(reportView)
    && /activeReportMode === 'evidence'[\s\S]*PublicMarketContextPanel/.test(reportView),
  'Public market context must render in Evidence mode only.',
)
assert(
  /public_market_benchmark/.test(reportView)
    && /local_demand_supply/.test(reportView)
    && /public aggregate market evidence/.test(reportView)
    && /realised CCS usage/.test(reportView)
    && /estimated realised-demand \/ supply-capacity screen/.test(reportView)
    && /child \/ approved place/.test(reportView)
    && /new entrant plausibility/i.test(reportView),
  'Evidence mode public market context must use careful evidence-screen wording.',
)
for (const forbiddenPublicMarketCopy of [
  'demand per centre',
  'proof of demand',
  'proof of occupancy',
  'actual demand',
  'true demand',
  'Definitive unmet demand',
]) {
  assert(!reportView.includes(forbiddenPublicMarketCopy), `Evidence mode public market copy contains forbidden phrase: ${forbiddenPublicMarketCopy}`)
}
assert(
  !/Public Market Benchmark/.test(icMemo)
    && !/Local Demand-Supply Screen/.test(icMemo)
    && !/Public Market Benchmark/.test(icPackExport)
    && !/Local Demand-Supply Screen/.test(icPackExport),
  'Public market context must not appear in Memo or IC Pack export yet.',
)
assert(
  /Market & Competitive Position/.test(icPackExport)
    && /IC Decision & Deal Structure Recommendation/.test(icPackExport)
    && /What We Do Not Know/.test(icPackExport)
    && /Broker \/ Seller Request List/.test(icPackExport),
  'IC Pack export must use integrated memo section language.',
)
assert(
  icPackExport.indexOf('Appendix / Audit Trail') > icPackExport.indexOf('Broker / Seller Request List'),
  'IC Pack export appendix must appear after the broker/seller request list.',
)

console.log('Frontend regression checks passed.')
