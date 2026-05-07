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

console.log('Frontend regression checks passed.')
