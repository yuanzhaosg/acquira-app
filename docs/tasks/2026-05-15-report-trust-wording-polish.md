# Task: Report Trust, Conflict Flags, and Wording Polish

Date: 2026-05-15

## Goal

Fix presentation-layer trust issues found in the Full Report PDF and IC Pack review.

The report structure is now correct:

```text
Decision -> Memo -> Underwriting -> Evidence -> Diligence -> Run History
```

This task improves evidence honesty, conflict visibility, buyer-facing wording, and export auditability.

## Context

Recent frontend UX/export commits:

- `5f3bc47 feat: add decision-first report navigation`
- `f2e039a refactor: reduce memo and underwriting repetition`
- `2693279 feat: promote evidence to full report screen`
- `e027511 feat: add full run history and diligence action screens`
- `95178a5 feat: add full report pdf export`

Claude audit identified two blocking trust issues:

1. Memo headline facts show disputed Revenue / EBITDA without a conflict flag.
2. “Why This Deal Could Work” can make positive claims from internally inconsistent financials.

It also identified wording violations around market/demand language and several export polish issues.

## Non-goals

Do not:

- change backend API contracts
- change extraction logic
- change scoring logic
- change valuation gate logic
- change recommendation logic
- change Evidence Ledger semantics
- change public market benchmark semantics
- change local_demand_supply behaviour
- change re-underwrite behaviour
- change IC Pack export purpose
- alter payload shapes
- add new derived metrics
- infer SA3 from postcode/suburb/address
- inject fixture data

This is presentation-layer only.

## Required Fixes

### 1. Add conflict/review badges to Memo headline metrics

Inspect:

- `src/components/report/ICMemoView.tsx`
- related metric/fact rendering helpers

If headline metrics such as Revenue, EBITDA, occupancy, payroll, rent, or asking price are sourced from evidence states such as:

- disputed
- conflicting
- review_required
- needs_review
- blocked
- low confidence

then display a visible badge next to the metric:

- `DISPUTED`
- `REVIEW REQUIRED`
- `LOW CONFIDENCE`

Do not change the value.

Do not hide the value unless the existing payload marks it unusable.

The goal is to prevent disputed values from appearing as clean facts.

### 2. Reframe or suppress unsafe “Why This Deal Could Work” claims

Find where “Why This Deal Could Work” is rendered or generated in IC Pack / report export.

If key financial facts are disputed, conflicting, blocked, or review-required:

- do not make positive profitability claims as if confirmed
- either suppress that positive bullet, or reframe it as conditional

Example safer wording:

```text
Reported profitability may be attractive, but financial evidence is disputed and requires reconciliation before relying on valuation or offer assumptions.
```

Do not change recommendation logic.

This is wording/presentation only.

### 3. Fix PRODUCT_BOUNDARIES wording violations in IC Pack market copy

Search for and replace buyer-facing wording that overclaims demand.

Fix these patterns:

1. Current:

```text
convert children aged 0-4 into likely long-day-care demand
```

Replace with:

```text
estimate long-day-care participation
```

2. Current:

```text
Occupancy & Demand
```

Replace with:

```text
Occupancy & Enrolment
```

3. Current:

```text
estimated demand ratio
```

Replace with:

```text
EDR capacity screen
```

or:

```text
EDR (capacity screen)
```

4. Current:

```text
demand fundamentals
```

Replace with:

```text
supply position
```

or:

```text
market capacity position
```

Approved wording:

- realised CCS usage
- public aggregate market evidence
- CBDC pricing benchmark
- market benchmark
- capacity screen
- local supply context
- future supply pressure
- supply position
- enrolment

Forbidden wording:

- demand per centre
- proof of demand
- proof of occupancy
- actual demand
- true demand
- definitive unmet demand

### 4. Deduplicate repeated market / pipeline warnings in IC Pack

If the same pipeline/supply warning appears multiple times across the IC Pack market section, consolidate it into one warning block.

Do not remove the warning.

Do not change the underlying risk logic.

### 5. Add version / commit footer to Full Report PDF

The IC Pack already has a footer similar to:

```text
IC_PACK_EXPORT_VERSION ledger-v2 / commit ...
```

Add equivalent audit/version metadata to Full Report PDF.

Suggested wording:

```text
FULL_REPORT_EXPORT_VERSION ledger-v2 / commit [commit or build marker]
```

Do not expose raw debug JSON.

### 6. Rename Evidence table column `USE` to `STATUS`

Inspect:

- `src/components/report/FactsReviewPanel.tsx`
- related evidence table components

Rename buyer-facing column header:

```text
USE
```

to:

```text
STATUS
```

Do not change the underlying field or evidence logic.

### 7. Add Run History first-run helper text

If Run History shows:

```text
Detailed run diff is unavailable for this current snapshot.
```

add buyer-friendly helper text:

```text
Run comparisons appear from Run 2 onwards.
```

Do not change run comparison logic.

## Tests

Run:

```bash
npm test -- --runInBand
npm run build
```

Run any existing frontend regression script if applicable.

## Acceptance Criteria

The task is complete when:

- disputed/review-required headline metrics are visibly flagged
- unsafe positive profitability wording is suppressed or hedged when financial facts are disputed
- IC Pack no longer uses forbidden demand wording
- repeated market/pipeline warnings are deduplicated
- Full Report PDF has audit/version footer
- Evidence table says `STATUS`, not `USE`
- Run History first-run empty state is clearer
- no backend/product semantics changed
- tests/build pass

## Deliverable

Report:

- files changed
- how disputed metrics are flagged
- how “Why This Deal Could Work” was made safer
- wording replacements made
- export footer approach
- tests/build results
- confirmation no scoring/valuation/recommendation/evidence logic changed
- commit hash
