# Task: Report UX Slice 1 - Decision-First Navigation

Date: 2026-05-14

## Goal

Create the Decision-first report journey and 6-step sidebar navigation.

The report should open with a verdict-first Decision screen and guide the buyer through:

1. Decision
2. Memo
3. Underwriting
4. Evidence
5. Diligence
6. Run History

## Scope

- Create `src/components/report/DecisionDashboard.tsx`.
- Update `src/components/report/ReportView.tsx` to render a 6-step sidebar journey.
- Make Decision the default active report screen.
- Keep `RunVersionBanner` visible across report screens.
- Keep existing Memo, Underwriting, Evidence, Diligence, and Run History content mostly unchanged.
- Update frontend regression checks only as needed.

## Decision Dashboard Rules

- Use only existing report payload data.
- Do not add API calls.
- Do not derive new metrics.
- Display a verdict banner from existing recommendation / score / valuation status.
- Display simple signal cards only where values already exist in the payload:
  - asking price multiple
  - local supply / market signal
  - occupancy
  - conflict flags / blockers
- Include one next-step CTA that switches to Diligence.

## Non-goals

Do not:

- implement Evidence full-screen redesign
- implement Run History full-screen redesign
- implement Diligence priority labels
- remove market data from Memo
- change backend API contracts
- change scoring logic
- change valuation gate logic
- change recommendation logic
- change Evidence Ledger semantics
- change public market benchmark semantics
- change `local_demand_supply` behaviour
- change re-underwrite behaviour
- change IC Pack export
- change `UnifiedNav`

## Acceptance Criteria

- Decision is the default report screen.
- Sidebar shows the six steps in order.
- `RunVersionBanner` remains visible across report screens.
- Existing Memo, Underwriting, Evidence, Diligence, and Run History entry points remain accessible.
- No report data shape changes.
- Frontend tests pass.
- Frontend build passes.
