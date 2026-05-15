# Task: Report UX Slice 3 - Evidence Full Screen

Date: 2026-05-14

## Goal

Promote Evidence into a full proof-layer screen that explains source facts, market evidence, warnings, and metric differences clearly.

Evidence should answer:

> What supports or challenges the report?

## Context

Completed slices:

- `5f3bc47 feat: add decision-first report navigation`
- `f2e039a refactor: reduce memo and underwriting repetition`

Memo now points users to Evidence for market proof.

The next issue is that market evidence can look repetitive or conflicting, especially:

- EDR
- adjusted kids per place
- public CCS benchmark
- Competitive Map
- Supply Map

These should be explained as different evidence lenses, not interchangeable metrics.

## Product Model

Use this distinction:

```text
Memo = narrative
Underwriting = decision logic
Evidence = proof/source layer
Diligence = next actions
Run History = change trail
```

## Non-goals

Do not:

- change backend API contracts
- change scoring logic
- change valuation gate logic
- change recommendation logic
- change extraction logic
- change Evidence Ledger semantics
- change public market benchmark semantics
- change `local_demand_supply` behaviour
- change re-underwrite behaviour
- change IC Pack export behaviour
- change UnifiedNav
- change MarketAuditPanel logic
- change FactsReviewPanel logic
- change CompetitiveMap logic
- change SupplyMap logic

This is a frontend UX / composition / explanation slice only.

## Scope

### 1. Create EvidenceScreen

Create:

`src/components/report/EvidenceScreen.tsx`

It should compose existing evidence-related panels where safe, such as:

- FactsReviewPanel
- MarketAuditPanel
- ExtractionWarnings
- existing public market benchmark rendering, if already available
- existing evidence readiness / warning summaries, if already available

Do not alter the underlying data logic of those panels.

### 2. Keep EvidenceDrawer Intact

Do not remove or break `EvidenceDrawer`.

The drawer should still work for quick lookups triggered from Memo or Underwriting.

The full Evidence screen is the main proof-layer view.

The drawer remains a contextual quick-view tool.

### 3. Move Market Evidence Explanation Into Evidence

Add a plain-language explanation block:

`How to read market evidence`

It should explain:

- EDR / internal demand-supply screen: used as an internal capacity and demand-supply screen.
- Public CCS benchmark: public aggregate market evidence showing realised CCS usage and CBDC pricing benchmark at SA3 level.
- Competitive Map: local competitor and supply context.
- Supply Map / pipeline: local supply and future supply pressure.

Make clear these are different lenses and may not produce identical numbers.

### 4. Explain Metric Conflicts Inline

Where market evidence appears, add buyer-facing copy such as:

```text
These metrics are not interchangeable. EDR is an internal capacity screen, while CCS benchmark data shows public aggregate realised CCS usage at SA3 level. Competitive Map data shows local supply context. Use them together to understand market pressure; do not treat any one metric as proof of target occupancy.
```

### 5. Update ReportView

The Evidence step in the 6-step report journey should render `EvidenceScreen`.

CompetitiveMap and SupplyMapPage should be accessible from Evidence as sub-views, embedded sections, or links/buttons, not top-level report navigation items.

## Wording Rules

Approved wording:

- realised CCS usage
- public aggregate market evidence
- CBDC pricing benchmark
- market benchmark
- capacity screen
- local supply context
- future supply pressure

Forbidden wording:

- demand per centre
- proof of demand
- proof of occupancy
- actual demand
- true demand
- definitive unmet demand

## Tests

Run:

```bash
npm test -- --runInBand
npm run build
```

Run existing frontend QA regression script if applicable.

## Acceptance Criteria

- Evidence is a full report screen.
- EvidenceDrawer still exists and remains available for quick lookups.
- Market evidence is explained as different lenses, not conflicting truth claims.
- Public CCS benchmark wording is compliant with product boundaries.
- Competitive Map / Supply Map are not top-level report nav items.
- No backend/product semantics change.
- Tests/build pass.

## Deliverable

Report:

- files changed
- panels included in EvidenceScreen
- how EDR / CCS / Competitive Map differences are explained
- where Competitive Map / Supply Map are accessible
- tests/build results
- confirmation EvidenceDrawer remains intact
- confirmation no scoring/evidence/backend semantics changed
- commit hash
