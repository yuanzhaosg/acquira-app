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
const decisionDashboard = read('src/components/report/DecisionDashboard.tsx')
const evidenceScreen = read('src/components/report/EvidenceScreen.tsx')
const runHistoryScreen = read('src/components/report/RunHistoryScreen.tsx')
const diligenceActionScreen = read('src/components/report/DiligenceActionScreen.tsx')
const diligenceChecklist = read('src/components/report/DiligenceChecklist.tsx')
const diligenceWorkspace = read('src/components/diligence/DiligenceWorkspace.tsx')
const fullReportExport = read('src/components/report/FullReportExport.tsx')

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
  '8. Market Context',
  '9. What to verify before offer',
  '10. Broker / Seller Request List',
  '11. IC Decision & Deal Structure Recommendation',
  '12. Appendix / Extraction Ledger',
]) {
  assert(icMemo.includes(title), `IC memo missing section: ${title}`)
}
assert(
  !/MarketAuditSummary/.test(icMemo)
    && /View market evidence/.test(icMemo)
    && /View underwriting logic/.test(icMemo),
  'Memo must avoid raw market evidence panels and point users to Evidence and Underwriting instead.',
)

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
  /ICPackExport/.test(reportView)
    && /FullReportExport/.test(reportView)
    && /Print IC Pack/.test(reportView)
    && /Export Full Report PDF/.test(reportView)
    && /printReport\('ic'\)/.test(reportView)
    && /printReport\('full'\)/.test(reportView)
    && /print-mode-full/.test(reportView)
    && /full-report-export/.test(reportView),
  'ReportView must expose separate IC Memo and Full Report PDF export actions.',
)
assert(
  /export default function FullReportExport/.test(fullReportExport)
    && /Decision Dashboard/.test(fullReportExport)
    && /Memo/.test(fullReportExport)
    && /Underwriting/.test(fullReportExport)
    && /Evidence/.test(fullReportExport)
    && /Diligence/.test(fullReportExport)
    && /Run History/.test(fullReportExport),
  'Full Report PDF export must include all six report journey sections.',
)
assert(
  /Interactive map is summarized, not reproduced/.test(fullReportExport)
    && /Supply\/pipeline map is summarized for print/.test(fullReportExport)
    && !/CompetitiveMap/.test(fullReportExport)
    && !/EvidenceDrawer/.test(fullReportExport)
    && !/RunHistoryDrawer/.test(fullReportExport),
  'Full Report PDF export must use print-safe summaries instead of interactive maps or drawers.',
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
  /\.has-ic-pack\.print-mode-ic > :not\(\.ic-pack-export\):not\(style\)/.test(reportView)
    && /\.has-ic-pack\.print-mode-full > :not\(\.full-report-export\):not\(style\)/.test(reportView),
  'ReportView print CSS must isolate the selected export instead of printing legacy report sections.',
)
assert(
  /report-content-workflow/.test(reportView)
    && /grid-template-columns: 280px minmax\(0, 1fr\)/.test(reportView)
    && /report-content-workflow > :not\(\.report-mode-sidebar\)/.test(reportView)
    && /grid-column: 2/.test(reportView)
    && !/float: 'left'/.test(reportView),
  'Report Journey sidebar must use a two-column grid layout and must not float over report content.',
)
assert(
  /REPORT_MODES/.test(reportView)
    && /report-mode-sidebar/.test(reportView)
    && /label: 'Decision'/.test(reportView)
    && /label: 'Memo'/.test(reportView)
    && /label: 'Underwriting'/.test(reportView)
    && /label: 'Evidence'/.test(reportView)
    && /label: 'Diligence'/.test(reportView)
    && /label: 'Run History'/.test(reportView)
    && /useState<ReportMode>\('decision'\)/.test(reportView)
    && /activeReportMode === 'decision'[\s\S]*DecisionDashboard/.test(reportView),
  'ReportView must split the page into a sidebar journey for Decision, Memo, Underwriting, Evidence, Diligence, and Run History with Decision as the default.',
)
assert(
  /export default function DecisionDashboard/.test(decisionDashboard)
    && /Investment Decision Dashboard/.test(decisionDashboard)
    && /Next best action/.test(decisionDashboard)
    && /onNavigate\('diligence'\)/.test(decisionDashboard),
  'DecisionDashboard must be a dedicated verdict-first component with a Diligence CTA.',
)
assert(
  /RunVersionBanner[\s\S]*activeReportMode === 'decision'/.test(reportView)
    && /activeReportMode === 'runs'[\s\S]*RunHistoryScreen/.test(reportView),
  'RunVersionBanner must be persistent across report screens while RunHistoryScreen remains available in Run History.',
)
assert(
  /activeReportMode === 'runs'[\s\S]*RunHistoryScreen/.test(reportView)
    && /activeReportMode === 'diligence'[\s\S]*DiligenceActionScreen/.test(reportView)
    && /activeReportMode === 'evidence'[\s\S]*EvidenceScreen/.test(reportView)
    && /activeReportMode === 'memo'[\s\S]*ICMemoView/.test(reportView),
  'Operational workflow panels must live outside the Decision dashboard and Memo story modes.',
)
assert(
  /Memo = decision story/.test(reportView)
    && /Underwriting = decision logic/.test(reportView)
    && /Evidence = proof layer/.test(reportView)
    && /Diligence = next actions/.test(reportView)
    && /Run History = version history \/ audit trail/.test(reportView),
  'Report modes must explain their distinct roles in the decision workflow.',
)
assert(
  /Can we rely on this valuation\?/.test(reportView)
    && /activeReportMode === 'underwriting'[\s\S]*ValuationGatePanel/.test(reportView)
    && !reportView.slice(
      reportView.indexOf("activeReportMode === 'evidence'"),
      reportView.indexOf("activeReportMode !== 'decision'")
    ).includes('ValuationGatePanel'),
  'Valuation readiness must be framed in buyer language inside Underwriting, not duplicated in Evidence.',
)
assert(
  /export default function EvidenceScreen/.test(evidenceScreen)
    && /How to read market evidence/.test(evidenceScreen)
    && /Public Market Benchmark/.test(evidenceScreen)
    && /Local Capacity Screen/.test(evidenceScreen)
    && /FactsReviewPanel/.test(evidenceScreen)
    && /MarketAuditPanel/.test(evidenceScreen)
    && /ExtractionWarnings/.test(evidenceScreen)
    && /CompetitiveMap/.test(evidenceScreen),
  'Public market context must render in Evidence mode only.',
)
assert(
  /public_market_benchmark/.test(evidenceScreen)
    && /local_demand_supply/.test(evidenceScreen)
    && /public aggregate market evidence/.test(evidenceScreen)
    && /realised CCS usage/.test(evidenceScreen)
    && /capacity screen/.test(evidenceScreen)
    && /local supply context/.test(evidenceScreen)
    && /future supply pressure/.test(evidenceScreen)
    && /not interchangeable/.test(evidenceScreen),
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
  assert(!evidenceScreen.includes(forbiddenPublicMarketCopy), `Evidence mode public market copy contains forbidden phrase: ${forbiddenPublicMarketCopy}`)
}
assert(
  !/Public Market Benchmark/.test(icMemo)
    && !/Local Capacity Screen/.test(icMemo)
    && !/Public Market Benchmark/.test(icPackExport)
    && !/Local Capacity Screen/.test(icPackExport),
  'Public market context must not appear in Memo or IC Pack export yet.',
)
assert(
  !/Run diagnostics/.test(runHistory)
    && !/Refresh diagnostics/.test(runHistory)
    && /Run checks/.test(runHistory)
    && /Refresh checks/.test(runHistory),
  'Run History must use buyer-facing run check labels instead of diagnostics language.',
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

assert(
  /export default function RunHistoryScreen/.test(runHistoryScreen)
    && /What changed since last run/.test(runHistoryScreen)
    && /Version history and change trail/.test(runHistoryScreen)
    && /RunHistoryDrawer/.test(runHistoryScreen)
    && /defaultOpen/.test(runHistoryScreen)
    && /screenMode/.test(runHistoryScreen),
  'Run History must have a full-screen wrapper while reusing the existing drawer mechanics.',
)
assert(
  /defaultOpen = false/.test(runHistory)
    && /screenMode = false/.test(runHistory)
    && /useState\(defaultOpen\)/.test(runHistory)
    && /!screenMode/.test(runHistory),
  'RunHistoryDrawer must keep drawer behavior intact while supporting an open full-screen rendering path.',
)
assert(
  /export default function DiligenceActionScreen/.test(diligenceActionScreen)
    && /What to verify before offer/.test(diligenceActionScreen)
    && /Diligence action workspace/.test(diligenceActionScreen)
    && /What should I ask for next|request broker evidence/.test(diligenceActionScreen)
    && /DiligenceWorkspace/.test(diligenceActionScreen)
    && /DiligenceChecklist/.test(diligenceActionScreen),
  'Diligence must render as a next-action workspace composed from the existing operational panels.',
)
assert(
  /EvidenceRequestsPanel/.test(diligenceWorkspace),
  'EvidenceRequestsPanel must remain a sub-section of DiligenceWorkspace.',
)
assert(
  /function priorityLabel/.test(diligenceChecklist)
    && /Do first/.test(diligenceChecklist)
    && /This week/.test(diligenceChecklist)
    && /Before offer/.test(diligenceChecklist)
    && /function priorityLabel/.test(diligenceWorkspace)
    && /Do first/.test(diligenceWorkspace)
    && /This week/.test(diligenceWorkspace)
    && /Before offer/.test(diligenceWorkspace),
  'Diligence priority labels must be buyer-facing and display-only.',
)

console.log('Frontend regression checks passed.')
