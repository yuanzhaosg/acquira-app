# Task: Report UX Review and Polish

Date: 2026-05-14

## Goal

Review the completed report UX journey end-to-end and fix only clear UX regressions, confusing labels, broken navigation, or spacing/readability issues.

The report journey is now:

```text
Decision -> Memo -> Underwriting -> Evidence -> Diligence -> Run History
```

## Context

Completed frontend UX redesign commits:

- `5f3bc47 feat: add decision-first report navigation`
- `f2e039a refactor: reduce memo and underwriting repetition`
- `2693279 feat: promote evidence to full report screen`
- `e027511 feat: add full run history and diligence action screens`

The section model is:

```text
Decision = verdict first
Memo = investment story
Underwriting = judgement logic
Evidence = proof layer
Diligence = next actions
Run History = change trail
```

## Non-goals

Do not add new features.

Do not change:

- backend API contracts
- scoring logic
- valuation gate logic
- recommendation logic
- extraction logic
- Evidence Ledger semantics
- public market benchmark semantics
- local_demand_supply behaviour
- re-underwrite behaviour
- IC Pack export behaviour
- UnifiedNav
- backend payload shapes
- Supabase migrations

This is a frontend UX review, labelling, navigation, spacing, and readability slice only.

## Review Checklist

Check:

- Decision is the clear default landing screen.
- Memo does not duplicate Evidence.
- Underwriting reads as decision logic, not raw proof.
- Evidence explains EDR / CCS / Competitive Map clearly.
- Diligence reads as next actions.
- Run History explains what changed.
- Navigation links work.
- Labels are buyer-friendly.
- No technical/debug labels dominate the UX.
- No backend/product semantics changed.

## Scope

Fix only small UX issues discovered during review, such as:

- unclear labels
- missing or broken section navigation actions
- confusing headings
- obvious spacing/readability problems
- duplicated buyer-facing copy introduced by the slice work
- report journey wording that conflicts with product boundaries

If the review finds no clear issue, do not change code.

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

- the completed report journey has been reviewed end-to-end
- any small UX regressions found during review are fixed
- no new product features are added
- no backend/product semantics change
- tests/build pass
- changes are committed and pushed only if fixes are made

## Deliverable

Report:

- review findings
- files changed, if any
- tests/build results
- whether anything was committed/pushed
- confirmation no backend/product semantics changed
