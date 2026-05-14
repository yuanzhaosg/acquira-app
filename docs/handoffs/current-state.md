# Acquira Frontend Current State

Last updated: 2026-05-14

## Current Frontend Repo

Repo:

`acquira-app`

Confirmed frontend structure:

- `package.json`
- `src/`
- `src/components/report/`

Current branch:

`fix/backend-url-config-cleanup`

## Current Production Backend Release

Backend source-of-truth release:

`ccs-manual-sa3-override-20260513`

Health endpoint:

`https://web-production-c3589.up.railway.app/health`

Verified backend health marker:

`release = ccs-manual-sa3-override-20260513`

## Backend Capability Relevant To Frontend

Backend can attach:

`workflow.market_audit.public_market_benchmark`

when all conditions are true:

1. Railway has CCS workbook env vars configured.
2. CCS workbook parses successfully.
3. Manual context or extracted payload contains explicit target SA3 code or SA3 name.
4. SA3 matches parsed CCS benchmark data.

Manual SA3 override is live and supports:

- `manualContext.sa3Code`
- `manualContext.sa3Name`
- `manual_context.sa3_code`
- `manual_context.sa3_name`

Manual context takes priority over extracted SA3 and is treated as manual/admin context, not source-document evidence.

## Product Boundaries For Frontend Work

Do not change:

- backend scoring logic
- valuation gate logic
- recommendation logic
- extraction logic
- public market benchmark semantics
- Evidence Ledger semantics
- local_demand_supply behaviour
- IC Pack/export behaviour
- Memo mode behaviour unless explicitly scoped
- re-underwrite behaviour

## Public Market Benchmark Frontend Behaviour

Expected frontend path:

`workflow.market_audit.public_market_benchmark`

Expected Evidence mode behaviour:

- Show Public Market Benchmark when present.
- Do not show it in Memo mode unless separately scoped.
- Do not change IC Pack/export.
- Do not affect scoring, valuation gate, or recommendation.
- Can display benchmark context attached from explicit manual/admin SA3 context.

## local_demand_supply

Current behaviour:

`workflow.market_audit.local_demand_supply` remains absent unless manually supplied elsewhere.

Do not add frontend behaviour that implies it is auto-attached.

## Latest Relevant Backend Commits

- `c952802 add manual sa3 benchmark override`
- `547e212 chore: mark manual sa3 override release`

## Latest Known Backend Tests

- `py_compile` passed
- `python -m unittest discover`: 100 tests OK, 1 skipped
- `scripts/qa_public_market_context.py --report-payload --check` manual SA3 payload passed

## Active Frontend Task

`docs/tasks/2026-05-14-report-ux-navigation-redesign.md`

Purpose:

Redesign report navigation and section relationships so the report feels like a guided investment decision workflow:

`Decision -> Story -> Logic -> Proof -> Action -> Version history`

This is a frontend UX / information architecture slice.
