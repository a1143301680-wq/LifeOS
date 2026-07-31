# TASK-021: PC Web category update and delete vertical slice

Status: COMPLETED

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-07-29

## Goal

Finish essential PC Web category management with safe name/color editing and explicitly confirmed deletion of normal categories, preserving Inbox and correct idempotent retry behavior.

## Scope Summary

- Integrate category PATCH for name and approved color changes.
- Integrate category DELETE for non-Inbox categories.
- Add accessible edit, cancel, confirmation, retry, stale-resource, and success states.
- Refetch the active list after successful writes.
- Preserve identity, Today, Todos, category listing, and category creation.
- Keep reorder, icon editing, Todo mutations, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Category update/delete API result: `83ac3eb`
- Active category-name uniqueness result: `eca0af8`
- TASK-020 terminal closure: `342b9ae`
- Existing Categories view under `web/`

## Required Evidence

- Focused tests for PATCH/DELETE contracts, Inbox protection, idempotent retry, stale resources, confirmation/cancel, and success refresh.
- Playwright checks at desktop and narrow widths.
- Production build and dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy result with disposable-data cleanup when services and a safe identity are available, or a precise environment limitation.

## Workflow History

- 2026-07-29: Decision published TASK-021 as `PLANNED` after verifying TASK-020 terminal closure commit `342b9ae` and clean local/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-29 08:47 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `342b9ae2e25e308d6af01a83c1cc2b72e50aa6fc`
- Snapshot Commit: `586771bc227a40d2679adb6e7833e6d29b57e6ec`
- Reason: approved TASK-021 readiness documents required a durable pre-Coding baseline

## Coding Result

Result: PASS

Completed at: 2026-07-31

### Modified Files

- `web/src/api.ts`
- `web/src/App.tsx`
- `web/src/styles.css`
- `web/src/App.test.tsx`
- `web/e2e/identity-todos.spec.ts`
- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `tasks/TASK-021-pc-web-category-update-delete.md`

### Implementation Summary

- Added authenticated PATCH and DELETE category helpers. PATCH sends only trimmed `name` and approved `color` or `null`; DELETE has no request body. Both send a UUID `Idempotency-Key`.
- Added populated editing, shared constrained color controls, Inbox display-field editing, named normal-category deletion confirmation, safe focus, cancel, pending, error, retry, stale-resource, unauthorized, and success states.
- Preserved one idempotency key for unchanged recoverable retries, invalidated edit keys when payload changes, and generated a new delete key after a flow is closed and reopened.
- Added synchronous in-flight guards and disabled controls to prevent duplicate or ambiguous category writes.
- Refetched categories after successful and stale writes so active visibility and server ordering remain authoritative.
- Preserved Today, Todos, category list, and category create behavior in component and Playwright coverage.

### Acceptance Criteria Results

- PASS: Editor initialization/cancel, exact PATCH contract, bearer/UUID headers, allowed fields, color clearing, and success refresh.
- PASS: Edit validation, 400, 401, 409, 410, recoverable retry, retry-key lifecycle, changed-payload invalidation, and duplicate in-flight protection.
- PASS: Inbox name/color editing works and Inbox never exposes deletion.
- PASS: Named deletion confirmation/cancel, exact bodyless DELETE contract, bearer/UUID headers, retry-key lifecycle, and duplicate in-flight protection.
- PASS: Delete 400, 401, 404, 409, recoverable retry, cancellation, success, disappearance, and authoritative refresh.
- PASS: Desktop and 375px Playwright flows cover Today, Todos, create, edit, delete, safe confirmation focus, and horizontal-overflow checks.
- PASS: No backend, Todo mutation, SSE, category icon/reorder, Android, or other forbidden behavior was modified.
- PASS WITH ENVIRONMENT LIMITATION: live Vite-proxy writes were not attempted because `postgresql-x64-18` was stopped, ports `8000`, `4173`, and `5173` were closed, and no safe raw disposable identity token was available. No live data was created, so cleanup was unnecessary.

### Verification Commands and Results

- `npm test -- --run src/App.test.tsx` from `web/`: PASS, 43 tests.
- `npm test` from `web/`: PASS, 2 files and 45 tests.
- `npm run build` from `web/`: PASS, TypeScript and Vite production build.
- `npm run test:e2e` from `web/`: PASS, 2 Playwright tests at 1440x900 and 375x812.
- `npm audit --audit-level=high` from `web/`: PASS, 0 vulnerabilities.
- Service/port check: PostgreSQL stopped; ports 8000, 4173, and 5173 closed.
- Warnings: none from tests, build, E2E, or audit.

### Git Diff Check

- `git status --short --untracked-files=all`: only expected pre-Coding workflow records and TASK-021 frontend/progress files; no untracked files.
- Exact diff and stat inspected; implementation stays within approved scope.
- `git diff --check`: PASS; informational LF-to-CRLF working-copy warnings only.
- `git diff --cached`: empty; nothing staged.
- No secrets, raw tokens, `.env`, build output, dependencies, logs, caches, or local databases are in the task diff.
- Pre-existing `handoff/git-snapshot.md` changes were preserved and not edited by Coding.

### Unresolved Issues

- Authenticated live proxy edit/delete remains unverified until PostgreSQL/backend/Vite are running and a safe disposable identity token is available.

### Task-Outside Findings

- None.

## Code Review

Result: PASS

Target Status: COMPLETED

Reviewed by: Code Review window

Reviewed at: 2026-07-31 09:09 +08:00

Reviewed task: TASK-021 PC Web category update and delete vertical slice

### Review Evidence

- Branch: `main`
- HEAD: `586771bc227a40d2679adb6e7833e6d29b57e6ec`
- origin/main: `586771bc227a40d2679adb6e7833e6d29b57e6ec`
- Snapshot Commit: `586771bc227a40d2679adb6e7833e6d29b57e6ec`
- Worktree Summary before review records: 9 modified tracked files, no staged files, no untracked files.
- `git diff --check`: PASS; only LF-to-CRLF working-copy warnings.
- `git diff --cached --check`: PASS.
- `git diff --cached`: empty.
- Artifact/secret check: PASS; ignored generated output remains untracked from Git, and no raw token or secret was added to the task diff.
- Live proxy disposition: PostgreSQL service was stopped and ports `8000`, `4173`, and `5173` were closed; authenticated live edit/delete was not claimed.

### Test Commands And Results

- `npm test -- --run src/App.test.tsx` from `web/`: PASS, 1 file and 43 tests.
- `npm test` from `web/`: PASS, 2 files and 45 tests.
- `npm run build` from `web/`: PASS, TypeScript and Vite production build.
- `npm run test:e2e` from `web/`: PASS, 2 Chromium tests at desktop and narrow widths.
- `npm audit --audit-level=high` from `web/`: PASS, 0 vulnerabilities.
- `python -m alembic current` from `backend/`: not completed; timed out because PostgreSQL is stopped. Backend was out of scope and unchanged.

### Blocking Issues

None.

### Non-blocking Suggestions

- Keep authenticated live Vite-proxy category edit/delete as a future smoke check once PostgreSQL/backend/Vite and a safe disposable identity token are available.

### Follow-up Tasks

None required for TASK-021.

### Reviewed Scope

- `web/src/api.ts`
- `web/src/App.tsx`
- `web/src/styles.css`
- `web/src/App.test.tsx`
- `web/e2e/identity-todos.spec.ts`
- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-021-pc-web-category-update-delete.md`

### Recommended Commit Message

`feat(web): add category edit and delete`

## Git Commit

Result: PASS

Committed by: Git Commit window

Committed at: 2026-07-31

Result Commit: `137ea03592d005f463a98b3301c81d30d704da7c`

Commit Message: `feat(web): add category edit and delete`

Pushed to: `origin/main`

## Closure

Pending.
