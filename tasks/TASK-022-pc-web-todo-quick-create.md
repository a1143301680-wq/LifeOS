# TASK-022: PC Web Todo quick-create vertical slice

Status: COMPLETED

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-08-01

## Goal

Add a usable authenticated Todo quick-create flow with title, server-default Inbox or active category, priority, optional planned date, correct idempotent retry, and server-authoritative Today/Todos refresh.

## Scope Summary

- Integrate `POST /api/v1/todos` with a UUID `Idempotency-Key`.
- Add quick-create commands to Today and Todos.
- Support title, category/default Inbox, priority, and plain planned date.
- Handle validation, stale category, retry, unauthorized, cancel, success, and accessible focus states.
- Preserve identity, Today, Todos, and category CRUD behavior.
- Keep note/due-time input, Todo edit/actions, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Todo create API result: `f2fe55e`
- Todo list/Today API results: `dd0d6fa`, `2a698f3`
- TASK-021 terminal closure: `501d6c2`
- Existing PC Web work surfaces and category data under `web/`

## Required Evidence

- Focused tests for POST contract, date defaults, category omission/selection, idempotent retry, stale category, cancel/focus, and success refresh.
- Playwright checks at desktop and narrow widths.
- Production build and dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy result with disposable-data cleanup when services and a safe identity are available, or a precise environment limitation.

## Workflow History

- 2026-08-01: Decision published TASK-022 as `PLANNED` after verifying TASK-021 terminal closure commit `501d6c2` and clean local/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-08-01 23:48 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `501d6c2aff2f9a81d448a57d13d37cdb722ea6c1`
- Snapshot Commit: `4e36d976a52aedd0c0806ed5adf1090df18d71c2`
- Reason: approved TASK-022 readiness documents required a durable pre-Coding baseline

## Coding Result

Result: PASS

Completed at: 2026-08-01

### Modified Files

- `web/src/types.ts`
- `web/src/api.ts`
- `web/src/App.tsx`
- `web/src/styles.css`
- `web/src/App.test.tsx`
- `web/e2e/identity-todos.spec.ts`
- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `tasks/TASK-022-pc-web-todo-quick-create.md`

### Implementation Summary

- Added a typed authenticated `POST /api/v1/todos` boundary accepting only title, optional category UUID, constrained priority, and optional plain planned date, with a UUID `Idempotency-Key`.
- Added compact Add todo commands and an accessible quick-create work band to Today and Todos. Today inherits the selected calendar date; Todos starts without a planned date.
- Represented Inbox/default by omitting `category_id`; normal category options preserve server order and send the selected UUID.
- Added trim/length validation, pending guards, cancel/success focus restoration, safe 400/409 feedback, 401 identity clearing, recoverable retries, and stale-category refresh/reset while preserving the rest of the draft.
- Reused one idempotency key for unchanged recoverable retries and generated a new key after any failed payload change or cancel/reopen boundary.
- Refetched every already-loaded Today/Todos dataset after success instead of locally inserting or sorting the response.
- Preserved the existing identity, Today, Todos, and category CRUD flows and extended desktop/narrow Playwright coverage.

### Acceptance Criteria Results

- PASS: Today/Todos entry, cancel without request, title autofocus, cancel/success focus restoration, and source-specific date defaults.
- PASS: title trim/blank/500-character validation, fixed priority choices, server-order categories, and default-Inbox omission semantics.
- PASS: exact bearer-authenticated POST payload, UUID idempotency key, forbidden-field absence, and unchanged plain `YYYY-MM-DD` handling.
- PASS: unchanged retry key reuse, changed-draft invalidation, cancel/reopen invalidation, and duplicate in-flight prevention.
- PASS: 400 validation, 409 conflict, 401 identity clearing, network/server retry, and stale/deleted category refresh/reset behavior.
- PASS: success closes/clears the draft and refreshes all previously loaded Today/Todos datasets from the server.
- PASS: existing identity, Today, Todos, category CRUD, navigation, desktop, and 375px narrow behavior remain covered.
- PASS: no backend, Todo edit/action, note/due-time, SSE, Android, or stable contract files were modified.
- PASS WITH ENVIRONMENT LIMITATION: PostgreSQL, FastAPI on port 8000, and Vite on port 5173 were available; a Vite-proxy POST with an explicitly invalid bearer returned expected 401 and created no data. No dedicated disposable raw identity token was available, so authenticated live creation and cleanup were not attempted.

### Verification Commands and Results

- `npm test` from `web/`: PASS, 2 files and 55 tests.
- `npm run build` from `web/`: PASS, TypeScript and Vite production build.
- `npm run test:e2e` from `web/`: PASS, 2 Playwright tests at 1440x900 and 375x812.
- `npm audit --audit-level=high` from `web/`: PASS, 0 vulnerabilities.
- Live availability check: `postgresql-x64-18` running; ports 8000 and 5173 listening.
- Vite-proxy unauthorized POST smoke: PASS, HTTP 401; no Todo created and no cleanup required.
- Warnings: none from tests, build, E2E, or audit.

### Git Diff Check

- `git status --short --untracked-files=all`: only expected pre-Coding workflow records and TASK-022 frontend/progress files; no untracked files.
- Exact frontend diff and stat inspected; implementation remains within approved scope.
- `git diff --check`: PASS; informational LF-to-CRLF working-copy warnings only.
- `git diff --cached`: empty; nothing staged.
- No secrets, raw tokens, `.env`, generated output, dependencies, logs, caches, local databases, debug code, or broad formatting changes appear in the task diff.
- Pre-existing `handoff/git-snapshot.md` changes were preserved and not edited by Coding.

### Unresolved Issues

- Authenticated live proxy creation/cleanup remains unverified until a dedicated disposable identity token is available.

### Task-Outside Findings

- None.

## Code Review

Result: PASS

Reviewed by: Code Review window

Reviewed at: 2026-08-02 10:37 +08:00

Branch: main

HEAD: `4e36d976a52aedd0c0806ed5adf1090df18d71c2`

Snapshot Commit: `4e36d976a52aedd0c0806ed5adf1090df18d71c2`

### Reviewed Scope

- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-022-pc-web-todo-quick-create.md`
- `web/e2e/identity-todos.spec.ts`
- `web/src/App.test.tsx`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/styles.css`
- `web/src/types.ts`

### Review Summary

- PASS: TASK-022 is correctly completed within approved scope.
- PASS: Web Todo quick-create sends only approved create fields, uses bearer auth plus UUID `Idempotency-Key`, omits `category_id` for Inbox/default, and never sends `user_id` or excluded Todo/system fields.
- PASS: Today and Todos entry points, date defaults, category order/selection, stale category recovery, idempotency retry boundaries, duplicate-submit guard, success clear/notice, and server-authoritative refresh behavior are covered.
- PASS: Existing identity, Today, Todos, category list/create/update/delete, identity clearing, desktop, and narrow viewport behavior remain covered.
- PASS: No backend, stable contract docs, Todo edit/action, note/due-time, SSE, Android, dependency, generated artifact, secret, or broad formatting change is included.

### Verification Commands and Results

- `npm test` from `D:\LifeOS\web`: PASS, 2 files and 55 tests.
- `npm run build` from `D:\LifeOS\web`: PASS.
- `npm run test:e2e` from `D:\LifeOS\web`: PASS, 2 Playwright tests; warning only that `NO_COLOR` is ignored because `FORCE_COLOR` is set.
- `npm audit --audit-level=high` from `D:\LifeOS\web`: PASS, 0 vulnerabilities.
- `git diff --check` from `D:\LifeOS`: PASS; informational LF-to-CRLF working-copy warnings only.
- `git diff --cached --check` from `D:\LifeOS`: PASS, no staged changes.

### Blocking Issues

- None.

### Non-blocking Suggestions

- Consider retrying category load when quick-create opens and `categoryStatus` is `error`, so users who previously hit a category-list load failure get a fresh picker attempt. This does not block TASK-022 because the default-Inbox path remains usable and covered.
- Code Review could not independently repeat Coding's invalid-bearer Vite-proxy smoke because PostgreSQL service `postgresql-x64-18` is currently Stopped and ports 8000/5173 are not listening. Repeat live proxy or disposable authenticated create/cleanup when services and a safe identity are available.

### Recommended Commit Message

`feat(web): add todo quick create`

## Git Commit

Result: PASS

Committed by: Git Commit window

Committed at: 2026-08-02

Result Commit: `5a1a433da980c1ec98eec69fac2162a695a19deb`

Commit Message: `feat(web): add todo quick create`

Push Target: `origin/main`

Files Committed:

- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-022-pc-web-todo-quick-create.md`
- `web/e2e/identity-todos.spec.ts`
- `web/src/App.test.tsx`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/styles.css`
- `web/src/types.ts`

## Closure

Pending.
