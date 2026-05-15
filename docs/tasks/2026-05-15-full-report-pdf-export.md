# Task: Full Report PDF Export

Date: 2026-05-15

## Goal

Add a Full Report PDF export option for the redesigned report journey.

The frontend now has a 6-step report journey:

```text
Decision -> Memo -> Underwriting -> Evidence -> Diligence -> Run History
```

Existing IC Memo export should remain unchanged.

Full Report PDF is intended for:

- diligence review
- advisor/lawyer/accountant review
- Claude audit/critique
- internal evidence review

## Non-goals

Do not:

- change backend APIs
- change scoring
- change valuation logic
- change recommendation logic
- change extraction logic
- change Evidence Ledger semantics
- change public market benchmark semantics
- change local_demand_supply behaviour
- remove or alter existing IC Memo export
- export raw debug JSON
- rely on interactive maps or drawers in print

## Required Behaviour

### 1. Add export options

Expose two clear export actions:

- `Export IC Memo`
- `Export Full Report`

Use clear UI copy:

- IC Memo PDF: concise recommendation for sharing
- Full Report PDF: diligence/evidence review pack

### 2. Full Report PDF contents

Full Report PDF should include:

- Decision Dashboard
- Memo
- Underwriting
- Evidence
- Diligence
- Run History summary

The section order must follow:

```text
Decision -> Memo -> Underwriting -> Evidence -> Diligence -> Run History
```

### 3. Print-safe fallbacks

Interactive components should have print-safe summaries:

- Competitive Map should export as a summary, not rely on interactive map rendering.
- Supply/pipeline map should export as a summary if available.
- Drawer-only controls should not appear in print.

### 4. Preserve existing export

Keep existing IC Memo export unchanged.

## Wording Rules

Approved market wording:

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

## Acceptance Criteria

The task is complete when:

- Existing IC Memo export still works.
- Full Report PDF export is available.
- Full Report print layout includes all six journey sections.
- Interactive maps do not break PDF output.
- No backend/product semantics changed.
- Tests/build pass.

## Deliverable

Report:

- files changed
- export UI changes
- print/PDF approach used
- tests/build results
- confirmation IC Memo export unchanged
- commit hash
