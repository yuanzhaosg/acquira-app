# Task: Fix Full Report Export Visibility and Sidebar Overlap

Date: 2026-05-15

## Goal

Fix two frontend UX issues in the redesigned report:

1. Full Report PDF export is not visible/discoverable; user only sees “Print IC Pack”.
2. Report Journey sidebar overlaps the right-side report content while scrolling.

## Context

Recent frontend UX commits:

- `5f3bc47 feat: add decision-first report navigation`
- `f2e039a refactor: reduce memo and underwriting repetition`
- `2693279 feat: promote evidence to full report screen`
- `e027511 feat: add full run history and diligence action screens`
- `95178a5 feat: add full report pdf export`

Current observed issues:

- User can only see the menu/action for `Print IC Pack`.
- `Export Full Report` is not visible or not wired into the report actions.
- When scrolling sections such as Underwriting, right-side report content moves underneath the left `Report Journey` sidebar, causing overlap.

## Non-goals

Do not:

- change backend API contracts
- change scoring logic
- change valuation logic
- change recommendation logic
- change Evidence Ledger semantics
- change public market benchmark semantics
- change local_demand_supply behaviour
- change re-underwrite behaviour
- change IC Pack export logic
- remove IC Pack export
- alter report data payloads
- add new report sections

This is a frontend visibility/layout bugfix only.

## Required Fixes

### 1. Make Full Report export visible

Fix the UI so the user can clearly access both:

- `Print IC Pack`
- `Export Full Report PDF`

Do not remove or repurpose the existing IC Pack export.

### 2. Fix Report Journey sidebar overlap

The left `Report Journey` sidebar must not overlap the active report content.

Use a stable desktop layout such as:

```text
grid-template-columns: 280px minmax(0, 1fr)
```

Rules:

- Sidebar may be sticky.
- Sidebar must remain in its own column.
- Main report content must remain in its own column.
- Right-side content must not scroll underneath the sidebar.
- On smaller screens, stack sidebar above content or collapse it safely.
- Avoid fixed positioning unless the main content has a matching left offset.
- Ensure z-index does not cause sidebar cards to cover report content.

### 3. Regression check

Add/update frontend QA regression checks to verify:

- Full Report export label exists.
- IC Pack export label still exists.
- Report Journey sidebar exists.
- The 6 journey labels still exist:
  - Decision
  - Memo
  - Underwriting
  - Evidence
  - Diligence
  - Run History

## Tests

Run:

```bash
npm test -- --runInBand
npm run build
```

If possible, run local smoke check:

```bash
curl -I http://localhost:3000/
```

## Acceptance Criteria

The task is complete when:

- User can access `Export Full Report PDF`.
- User can still access `Print IC Pack`.
- Sidebar no longer overlaps report content while scrolling.
- Desktop layout clearly separates sidebar and content.
- Mobile/smaller screen layout does not break.
- No backend/product semantics changed.
- Tests/build pass.

## Deliverable

Report:

- files changed
- where Full Report export is now surfaced
- layout fix approach used
- tests/build results
- confirmation IC Pack export still works
- confirmation no backend/product semantics changed
- commit hash
