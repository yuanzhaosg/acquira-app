# AGENTS.md - Acquira Frontend Codex Rules

Before changing code, read:

1. PRODUCT_BOUNDARIES.md
2. AI_WORKFLOW.md
3. docs/handoffs/current-state.md
4. The active task file under docs/tasks/

Do not rely on stale chat history over repo docs.

## Working Rules

- Keep each change narrow.
- Do not change product logic outside the active task.
- Do not refactor unrelated files.
- Do not silently change scoring, valuation, recommendation, export, Memo mode, evidence basket, or re-underwrite behaviour.
- Treat backend payload semantics as source-of-truth contracts.
- For frontend UX tasks, change presentation and information architecture only unless the task explicitly allows API or data-shape changes.
- Run the tests and build commands listed in the task before committing.
- Report:
  - files changed
  - tests run
  - commit hash
  - screenshots or visual verification when frontend UI changes

## Commit Rules

Use small descriptive commits.

Examples:

- `docs: add frontend workflow source of truth`
- `clarify report decision navigation`
- `add report decision dashboard`

Do not commit secrets, local files, generated reports, fixture outputs, or build artifacts unless explicitly requested.
