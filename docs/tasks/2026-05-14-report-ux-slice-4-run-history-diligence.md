# Task: Report UX Slice 4 - Run History and Diligence Action Layer

Date: 2026-05-14

## Goal

Make Diligence the next-action workspace and Run History the version/change trail.

The report journey should now complete as:

Decision -> Memo -> Underwriting -> Evidence -> Diligence -> Run History

## Context

Completed slices:

- `5f3bc47 feat: add decision-first report navigation`
- `f2e039a refactor: reduce memo and underwriting repetition`
- `2693279 feat: promote evidence to full report screen`

Evidence is now the proof layer. The next step is to make Diligence and Run History clearer.

## Product Model

Use this distinction:

```text
Decision = verdict
Memo = story
Underwriting = judgement logic
Evidence = proof layer
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
- change DiligenceChecklist logic
- change RunComparisonView logic
- change RunSnapshotView logic
- change RunDiffSummary logic

This is a frontend UX / composition / labelling slice only.

## Scope

### 1. Create Full Run History Screen

Create:

`src/components/report/RunHistoryScreen.tsx`

or an equivalent wrapper.

Use existing run-related components where safe:

- RunComparisonView
- RunSnapshotView
- RunDiffSummary
- RunVersionBanner

Do not change their internal logic.

The Run History screen should help the user understand:

- what changed
- when it changed
- which run is current
- whether the recommendation changed, if existing data supports it
- what evidence or blockers changed, if existing data supports it

Keep any existing `RunHistoryDrawer` behaviour intact.

### 2. Improve Diligence As Action Workspace

The Diligence screen should clearly communicate:

```text
What should I ask for next?
What blocks the decision?
What should I verify before offer?
```

Where existing components exist, compose them as sub-sections under Diligence rather than separate top-level screens:

- DiligenceWorkspace
- EvidenceRequestsPanel
- DiligenceChecklist

### 3. Add Display-only Priority Labels

Add buyer-facing priority labels to diligence/checklist/request items where practical:

- Do first
- This week
- Before offer

Rules:

- Display-only labels.
- Do not change checklist logic.
- Do not add backend fields.
- If no priority field exists, use conservative UI grouping based on existing blocker / missing / request status only.
- Do not infer new diligence logic.

### 4. Improve Labels

Use buyer-facing labels:

- What to verify before offer
- Broker evidence requests
- Upload follow-up documents
- Re-run underwriting
- What changed since last run

Avoid exposing technical labels as primary headings.

## Tests

Run:

```bash
npm test -- --runInBand
npm run build
```

Run existing frontend QA regression script if applicable.

## Acceptance Criteria

- Run History is a full report screen.
- Existing run drawer / programmatic entry points remain intact.
- Diligence reads as the next-action workspace.
- Checklist/request priority labels are display-only.
- No backend/product semantics change.
- Tests/build pass.

## Deliverable

Report:

- files changed
- Run History screen behaviour
- Diligence screen structure
- priority label approach
- tests/build results
- confirmation drawer entry points remain intact
- confirmation no backend/product semantics changed
- commit hash
