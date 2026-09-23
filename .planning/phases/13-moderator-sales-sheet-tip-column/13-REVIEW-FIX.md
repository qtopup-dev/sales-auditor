---
phase: 13-moderator-sales-sheet-tip-column
fixed_at: 2026-09-23T00:00:00Z
review_path: .planning/phases/13-moderator-sales-sheet-tip-column/13-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-09-23
**Source review:** .planning/phases/13-moderator-sales-sheet-tip-column/13-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02 — critical_warning scope; Info items excluded)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Turnover KPI is computed identically to Profit — voided sales never counted in Turnover

**Files modified:** `packages/backend/src/routes/admin.ts`
**Commit:** 4e2c7b2
**Applied fix:** Changed `turnoverSum`'s `CASE WHEN status = 'active' THEN ... ELSE 0 END` to an unconditional `SUM(priceSnapshot + COALESCE(tip, 0))` in all four per-period `$queryRaw` blocks (today/yesterday/thisMonth/lastMonth), since the outer `WHERE status IN ('active', 'void')` already scopes the rows. `profitSum` was left unchanged (still active-only via its own `CASE`). The explanatory comment at line 129 ("profitSum = SUM WHERE active; turnoverSum = SUM WHERE active OR void") was already accurate to the intended behavior, so no comment change was needed.

Verified:
- `npx tsc -p packages/backend/tsconfig.json --noEmit` — no errors.
- Live check against the user's running dev server (`:3001`, not started/stopped by this session): logged in as `admin`/`admin1234`, `GET /api/admin/summary` returned `profit.lastMonth: "90.00"` vs `turnover.lastMonth: "1951.00"` — turnover ≥ profit and differs where void sales exist, confirming the fix. Temporary cookie jar deleted after the check.

### WR-02: `tip.check.ts` self-check is not wired into any script, build step, or CI — will silently rot

**Files modified:** `packages/backend/package.json`, `package.json` (repo root), `packages/backend/tsconfig.json`
**Commit:** a240d2c
**Applied fix:** Added `"test": "tsx src/lib/tip.check.ts"` to `packages/backend/package.json`, and a root `"test": "npm run test --workspace=@alejinput/backend"` script so `npm test` works from the repo root. Added `"exclude": ["src/**/*.check.ts"]` to `packages/backend/tsconfig.json` so the check file no longer compiles into `dist/lib/tip.check.js` and ships in the production image. `.github/workflows/deploy.yml` was intentionally left untouched per scope.

Verified:
- `npm test` from the repo root printed `tip checks passed`.
- `npm run build` in `packages/backend` (after `rm -rf dist`) succeeded with `dist/lib/` containing only `db.*`, `prisma.*`, `tip.*` — no `tip.check.js`/`tip.check.d.ts`.

## Skipped Issues

None — both in-scope findings were fixed.

---

_Fixed: 2026-09-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
