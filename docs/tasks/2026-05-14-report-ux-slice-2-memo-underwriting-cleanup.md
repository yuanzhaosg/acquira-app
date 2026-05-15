# Task: Report UX Slice 2 - Memo and Underwriting Cleanup

Date: 2026-05-14

## Goal

Reduce repetition between Memo, Underwriting, and Evidence.

Memo should tell the investment story.
Underwriting should explain decision logic.
Evidence should remain the proof layer.

## Context

Slice 1 is complete:

`5f3bc47 feat: add decision-first report navigation`

The report now uses a 6-step sidebar journey:

Decision -> Memo -> Underwriting -> Evidence -> Diligence -> Run History

Current issue:
Memo and Underwriting still repeat evidence-heavy sections, especially market / competitive data and valuation-gate style warnings.

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
- change ValuationGatePanel logic

## Scope

### 1. Memo Cleanup

In `ICMemoView.tsx`:

- Remove raw `MarketAuditPanel` rendering from Memo if present.
- Replace market-heavy tables with a short plain-language narrative.
- Add a clear action/link/button to navigate to Evidence: `View market evidence`.
- Keep thesis, risks, recommendation summary, and key facts intact.
- Do not remove important risk content; move proof-heavy content to Evidence.

### 2. Underwriting Cleanup

In the Underwriting screen/rendering path:

- Make Underwriting focus on:
  - score/status
  - rationale
  - blockers
  - valuation readiness
  - links to Evidence / Diligence
- Avoid duplicating raw evidence tables.
- If `ValuationGatePanel` currently appears as a standalone screen or overly technical section, render it as a contextual callout inside Underwriting.
- Do not change `ValuationGatePanel.tsx` logic.
- Use buyer-friendly label:
  - `Can we rely on this valuation?`
  - or `What this means for your purchase`

### 3. Navigation Links

Add links/actions where practical:

From Memo:

- View market evidence
- View underwriting logic

From Underwriting:

- View supporting evidence
- Open diligence actions

Use existing local state navigation if possible.
Do not add routing or API changes.

## Wording

Avoid technical buyer-facing labels where possible:

- `Valuation Gate` -> `Can we rely on this valuation?`
- `What We Do Not Know` -> `What to verify before offer`
- `Market Audit` -> `Market Evidence`

Approved market wording:

- realised CCS usage
- public aggregate market evidence
- CBDC pricing benchmark
- market benchmark
- capacity screen

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

Also run existing frontend QA regression script if applicable.

## Acceptance Criteria

- Memo no longer duplicates raw market/evidence panels.
- Memo points users to Evidence for market proof.
- Underwriting reads as decision logic rather than another evidence dump.
- Valuation readiness is shown in buyer-friendly language.
- Existing evidence semantics are unchanged.
- Existing backend/product semantics are unchanged.
- Tests/build pass.

## Deliverable

Report:

- files changed
- what was removed from Memo
- how Underwriting was reframed
- where valuation readiness appears
- tests/build results
- confirmation no scoring/valuation/evidence logic changed
- commit hash
