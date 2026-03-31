# CLAUDE.md — Acquira Code Review Workflow

## Codex MCP Review Loop

When asked to **review** or **modify** code, follow this workflow:

1. Use the `codex` tool to initiate a review — send the `git diff` of the changes as context
2. Analyse Codex's feedback and identify what needs fixing
3. Make the changes yourself
4. Use `codex-reply` (with the same `threadId`) to send the new diff for re-review
5. If Codex still has feedback, iterate — **maximum 3 rounds**

Trigger phrase: **"review"** → automatically invokes this workflow.

---

## Project Conventions

- **Never push to `main` directly** — always branch + PR
- Branch naming: `fix/description` or `feat/description`
- Always run `npm run build` locally before pushing — must pass clean
- PRs go against `main`

## Stack

- Next.js 16 + TypeScript
- Supabase (DB + Auth)
- Anthropic Claude (pipeline)
- Vercel (auto-deploy on main merge)
- Railway (acquira-api FastAPI backend)

## Key Files

- `src/app/api/map-data/route.ts` — supply/demand map logic + ABS data
- `src/lib/prompts/scoring-v2.ts` — deal scoring algorithm
- `src/components/map/SupplyMapPage.tsx` — map UI
- `src/components/report/ReportView.tsx` — deal report UI
