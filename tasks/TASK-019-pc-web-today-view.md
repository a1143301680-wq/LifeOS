# TASK-019: PC Web Today view vertical slice

Status: REVIEWING

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-07-23

## Goal

Add a usable authenticated Today view to the existing PC Web app, driven by `GET /api/v1/todos/today`, with identity-timezone date selection, four backend-defined sections, summary counts, and complete observable UI states.

## Scope Summary

- Integrate the typed Today aggregation endpoint.
- Add Today/Todos view switching and calendar-date navigation.
- Preserve backend section assignment and ordering.
- Cover loading, empty, error/retry, unauthorized, responsive, and accessibility behavior.
- Preserve all TASK-018 identity and pending-list behavior.
- Keep categories, Todo mutations, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- TASK-015 Today API result: `2a698f3`
- TASK-018 terminal closure: `dc710ba`
- Existing frontend under `web/`

## Required Evidence

- Focused unit/component tests for Today requests, timezone date derivation, rendering, navigation, and failure states.
- Playwright checks at desktop and narrow widths.
- Production build and dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy smoke result when services are available, or a precise environment limitation.

## Workflow History

- 2026-07-23: Decision published TASK-019 as `PLANNED` after verifying TASK-018 terminal closure commit `dc710ba` and clean local/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-23 08:47 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `dc710ba5fc2b4b2c6f736daea950caf8ea0d065a`
- Snapshot Commit: `6925aaf2269e18eebff12e96565be3e4cde80190`
- Reason: approved TASK-019 readiness documents required a durable pre-Coding baseline

## Coding Result

### Result

- Result: PASS
- Final Status: REVIEWING
- Next Role: Code Review

### Modified Files

- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `tasks/TASK-019-pc-web-today-view.md`
- `web/e2e/identity-todos.spec.ts`
- `web/src/App.test.tsx`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/calendar-date.test.ts`
- `web/src/calendar-date.ts`
- `web/src/styles.css`
- `web/src/test/setup.ts`
- `web/src/types.ts`

### Implementation Summary

- Added typed Today API data for selected date, timezone, four fixed sections, summary counts, and response envelope handling.
- Added authenticated `GET /api/v1/todos/today?date=YYYY-MM-DD` requests through the existing bearer-token client without `user_id` or token-bearing URLs.
- Made Today the authenticated default view and added compact Today/Todos switching without a routing or state-management dependency. The existing pending Todo list loads on first switch and remains available when returning from Today.
- Derived the initial date with the resolved identity timezone using `Intl.DateTimeFormat.formatToParts`. Previous/next operations move a parsed calendar tuple with UTC getters only, avoiding browser-local timezone conversion and covering month/year boundaries.
- Added previous, next, native date selection, and return-to-today controls; pending/completed/overdue summary; API-ordered overdue, due, planned, and recent Inbox sections; section-empty and entirely-empty states.
- Reused identity switching and unauthorized clearing. Today and Todo recoverable errors preserve identity and provide retry; either endpoint returning 401 clears both approved identity storage keys.
- Extended the existing restrained workbench UI for desktop and narrow widths using stable controls, semantic headings/lists, visible labels, focus behavior, and Lucide icons.

### Acceptance Criteria Results

- PASS: valid stored/new identity opens Today using the identity-timezone calendar date.
- PASS: Today requests use the exact encoded date URL and bearer header, with no `user_id`, token URL, visible error, log, or production-output exposure.
- PASS: all four API sections render in supplied order with section counts and pending/completed/overdue summary values; no client sorting or reassignment occurs.
- PASS: previous, next, direct selection, and return-to-today produce the expected calendar dates without timezone drift.
- PASS: Today/Todos switching preserves identity and the published pending-list behavior.
- PASS: identity/Today loading, entirely empty, section-empty, Today/Todo recoverable error and retry, and unauthorized states are covered.
- PASS: desktop 1440x900 and narrow 375x812 browser checks show no overlap, clipping, or horizontal overflow; screenshot inspection found no console errors.
- PASS: existing and new tests, production build, and dependency audit pass; ignored generated artifacts and secrets are absent from the task diff.
- PASS: no backend, stable contract document, category, mutation, SSE, offline, PWA, or Android code changed.

### Verification Commands And Results

- `cd D:\LifeOS\web; npm test`: PASS; 2 test files and 16 tests passed.
- `cd D:\LifeOS\web; npm run test:e2e`: PASS; 2 Playwright tests passed using installed Chrome.
- `cd D:\LifeOS\web; npm run build`: PASS; TypeScript project build and Vite production build completed.
- `cd D:\LifeOS\web; npm audit --audit-level=high`: PASS; 0 vulnerabilities.
- Browser screenshot inspection: PASS; desktop and 375px Today views rendered all controls, summary, and sections; narrow metrics were `scrollWidth=375`, `clientWidth=375`; console errors: none.
- Development server: running at `http://127.0.0.1:5173/`.
- Live Vite-proxy smoke attempt: BLOCKED by local service permissions. `Start-Service postgresql-x64-18` returned `Cannot open postgresql-x64-18 service on computer '.'`; PostgreSQL remained `Stopped`, and no backend listened on port 8000. No live `/me`, `/todos`, or `/todos/today` success is claimed.

### Git Diff Check

- `git diff --check`: PASS; exit 0 with LF-to-CRLF working-copy warnings only.
- Independent recursive trailing-whitespace scan for `web/` source/config/tests: PASS; no matches.
- `git diff --cached`: empty; no staged changes.
- Secret/artifact scan: PASS; no real token, `.env`, production test token, `user_id`, dependency directory, build output, cache, log, or browser report appears in the task file set.
- Scope check: PASS; no `backend/`, Android, stable API/product/architecture/data-model, package dependency, or completed task archive changes.
- Pre-existing workflow files preserved: `handoff/git-snapshot.md` remains the expected post-snapshot state change and was not overwritten or reverted.

### Unresolved Issues

None. Live integration remains unverified only because the local PostgreSQL Windows service cannot be opened from the current normal-permission process.

### Task-Outside Findings

None.

## Code Review

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-07-28 08:33 +08:00
- Branch: main
- HEAD: `6925aaf2269e18eebff12e96565be3e4cde80190`
- Snapshot Commit: `6925aaf2269e18eebff12e96565be3e4cde80190`
- Reviewed Scope:
  - `docs/phase1a-progress.md`
  - `handoff/current-task.md`
  - `handoff/git-snapshot.md`
  - `tasks/TASK-019-pc-web-today-view.md`
  - `web/e2e/identity-todos.spec.ts`
  - `web/src/App.test.tsx`
  - `web/src/App.tsx`
  - `web/src/api.ts`
  - `web/src/calendar-date.test.ts`
  - `web/src/calendar-date.ts`
  - `web/src/styles.css`
  - `web/src/test/setup.ts`
  - `web/src/types.ts`
- Verification:
  - `cd D:\LifeOS\web; npm test` -> PASS, 2 test files and 16 tests passed.
  - `cd D:\LifeOS\web; npm run build` -> PASS.
  - `cd D:\LifeOS\web; npm run test:e2e` -> PASS, 2 Playwright tests passed.
  - `cd D:\LifeOS\web; npm audit --audit-level=high` -> PASS, 0 vulnerabilities.
  - `git diff --check` -> PASS; LF-to-CRLF warnings only.
  - `git diff --cached --check` -> PASS.
  - Independent non-generated `web/` trailing-whitespace scan -> PASS.
  - Generated/local artifacts are ignored by `.gitignore`.
  - Local service check: PostgreSQL was running and port 5432 reachable, but backend port 8000 was not listening; live proxy smoke was not completed.
- Blocking Issues: None.
- Non-blocking Suggestions:
  - Run a live proxy smoke test for `/me`, `/todos`, and `/todos/today` after starting the backend service on port 8000.
- Follow-up Tasks:
  - Continue with the planned PC Web category/mutation/SSE slices after TASK-019 is published.
- Recommended Commit Message: `feat(web): add Today view`

## Git Commit

Pending.

## Closure

Pending.
