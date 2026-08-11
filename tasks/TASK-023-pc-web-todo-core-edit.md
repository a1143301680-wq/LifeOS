# TASK-023: PC Web Todo core edit vertical slice

Status: COMPLETED

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-08-04

## Goal

Allow an authenticated PC Web user to edit a visible pending Todo's title, active category, priority, and planned date from Today or Todos, with correct idempotent retry and server-authoritative refresh.

## Scope Summary

- Integrate `PATCH /api/v1/todos/{id}` with bearer auth and a UUID `Idempotency-Key`.
- Add accessible row edit commands and one reusable core-field editor for Today and Todos.
- Support title, active category including Inbox, priority, and plain/cleared planned date.
- Retry category loading on editor open after an earlier load failure.
- Handle validation, stale category/Todo, retry, unauthorized, cancel, success, and focus states.
- Preserve existing identity, Today, Todos, category CRUD, and quick-create behavior.
- Keep note/due-time, Todo status actions/delete, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Todo update API result: `09cd984`
- Todo list/Today API results: `dd0d6fa`, `2a698f3`
- TASK-022 terminal closure: `275f4a2`
- Existing PC Web work surfaces, active-category state, and quick-create flow under `web/`

## Required Evidence

- Focused tests for exact PATCH payload, form initialization, planned-date clear, Inbox/category behavior, idempotent retry, stale category/Todo, cancel/focus, and success refresh.
- Playwright checks at desktop and narrow widths.
- Production build and high-severity dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy result with disposable-data cleanup when services and a safe identity are available, or a precise environment limitation.

## Workflow History

- 2026-08-04: Decision published TASK-023 as `PLANNED` after verifying TASK-022 terminal closure commit `275f4a2`, clean worktree, and local/tracking/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-08-11 22:04 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `275f4a23ae2f8010173bc72ed14110420909aa62`
- Snapshot Commit: `433495c077dead61a2e16b7c9da71f73a109948f`
- Reason: approved TASK-023 readiness documents required a durable pre-Coding baseline

## Coding Result

Result: PASS

Completed at: 2026-08-11

### Modified Files

- `web/src/types.ts`
- `web/src/api.ts`
- `web/src/App.tsx`
- `web/src/styles.css`
- `web/src/App.test.tsx`
- `web/e2e/identity-todos.spec.ts`
- `web/package-lock.json`
- `handoff/current-task.md`
- `tasks/TASK-023-pc-web-todo-core-edit.md`

### Implementation Summary

- Added a typed authenticated `PATCH /api/v1/todos/{id}` boundary with a UUID `Idempotency-Key` and an exact four-field payload: `title`, `category_id`, `priority`, and `planned_date`.
- Added compact accessible row edit commands to Today and Todos plus one shared core-field editor with title autofocus, cancel focus restoration, and post-refresh focus placement.
- Kept category choices server ordered, sent the active Inbox UUID for edits, waited for active categories before resolving historical categories, and fell back to Inbox for deleted or unavailable historical categories.
- Added title trim/blank/500-character validation, constrained priorities, plain `YYYY-MM-DD` handling, and `null` for a cleared planned date.
- Reused an idempotency key for unchanged network/server retries, invalidated it after any draft change, and blocked duplicate in-flight submissions.
- Added safe 400/409 feedback, 401 identity clearing, explicit category-load retry, stale-category recovery that preserves the draft, and stale-Todo closure with server-authoritative refresh.
- Refetched every already-loaded Today/Todos dataset after success or stale Todo detection instead of mutating list order locally.
- Updated vulnerable transitive development dependencies in `package-lock.json` through `npm audit fix`; no direct dependency or manifest change was needed.

### Acceptance Criteria Results

- PASS: Today and Todos rows expose icon-based edit commands with accessible labels and stable dedicated layout space.
- PASS: open/init, title autofocus, active category or Inbox fallback, priority, plain planned date, cancel/no-request, and cancel/success focus behavior are covered.
- PASS: PATCH uses bearer auth, UUID idempotency, active Inbox UUID semantics, and only the four allowed fields; forbidden and system fields are absent.
- PASS: title validation, priority constraints, unchanged date transmission, and cleared-date `null` behavior are covered.
- PASS: unchanged retry key reuse, field-change invalidation, fresh open boundaries, and duplicate pending-request prevention are implemented.
- PASS: category idle/error loading, explicit retry, no guessed category submission, stale-category Inbox recovery, and draft preservation are implemented.
- PASS: stale Todo, 400, 409, 401, network/server retry, pending, cancel, and success states behave safely.
- PASS: success and stale Todo paths refetch every already-loaded Today/Todos dataset from the server.
- PASS: existing identity, Today, Todos, quick-create, and category CRUD tests remain green.
- PASS: desktop 1440x900 and narrow 375x812 Playwright flows cover Todo edit and report no horizontal overflow.
- PASS: no backend, note/due-time, Todo status/delete, SSE, Android, or stable contract files were modified.
- PASS WITH ENVIRONMENT LIMITATION: no dedicated disposable identity token was available, so authenticated live Vite-proxy PATCH and cleanup were not attempted; no real user data was touched and no live-integration claim is made.

### Verification Commands and Results

- `npm test -- --run` from `web/`: PASS, 2 files and 67 tests.
- `npm run build` from `web/`: PASS, TypeScript and Vite production build.
- `npm run test:e2e` from `web/`: PASS, 2 Playwright tests at 1440x900 and 375x812.
- `npm audit --audit-level=high` from `web/`: initial FAIL exposed high-severity `nanoid` and `undici` plus moderate `postcss`; after `npm audit fix`, final PASS with 0 vulnerabilities.
- Focused Vitest tracer and recovery tests: PASS for open/cancel, exact PATCH, category retry/fallback, idempotency, stale category/Todo, validation, 400/409, 401, and pending duplicate guard.
- Warnings: final tests, build, E2E, and audit emitted no task-affecting warnings.

### Git Diff Check

- `git status --short --untracked-files=all`: only the expected pre-Coding workflow records and TASK-023 Web implementation files; no untracked files.
- Exact source, test, E2E, CSS, API/type, and lockfile diffs inspected; changes remain within the approved allowlist.
- `git diff --check`: PASS; informational LF-to-CRLF working-copy warnings only.
- `git diff --cached`: empty; nothing staged.
- `web/dist/` and `web/test-results/` are ignored and absent from the diff; no dependency directory, report, cache, log, local database, `.env`, or generated artifact is included.
- Secret scan found only the existing synthetic `stored-token` test assertion; no raw real token, password, or environment secret was added.
- Pre-existing `handoff/git-snapshot.md` changes were preserved and not edited by Coding.

### Unresolved Issues

- Authenticated live proxy PATCH and cleanup remain unverified until a dedicated disposable identity token/data set is available.

### Task-Outside Findings

- None.

## Code Review

Result: PASS

Reviewed by: Code Review window

Reviewed at: 2026-08-11 22:40 +08:00

Branch: main

HEAD: `433495c077dead61a2e16b7c9da71f73a109948f`

Snapshot Commit: `433495c077dead61a2e16b7c9da71f73a109948f`

### Reviewed Scope

- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-023-pc-web-todo-core-edit.md`
- `web/e2e/identity-todos.spec.ts`
- `web/package-lock.json`
- `web/src/App.test.tsx`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/styles.css`
- `web/src/types.ts`

### Review Summary

- PASS: TASK-023 is correctly completed within approved scope.
- PASS: Web Todo edit uses `PATCH /api/v1/todos/{id}` with bearer auth and UUID `Idempotency-Key`, sends only `title`, `category_id`, `priority`, and `planned_date`, and sends active Inbox UUID for Inbox edits.
- PASS: Editor initialization, plain date clearing to `null`, title validation, category load retry, historical-category Inbox fallback, stale category/Todo recovery, idempotency retry boundaries, duplicate-submit guard, success notice, and server-authoritative refresh behavior are covered.
- PASS: Existing identity, Today, Todos, category CRUD, Todo quick-create, identity clearing, desktop, and narrow viewport behavior remain covered.
- PASS: No backend, stable contract docs, note/due-time, Todo status/delete/action, SSE, Android, direct dependency, generated artifact, secret, or broad formatting change is included.

### Verification Commands and Results

- `npm test -- --run` from `D:\LifeOS\web`: PASS, 2 files and 67 tests.
- `npm run build` from `D:\LifeOS\web`: PASS.
- `npm run test:e2e` from `D:\LifeOS\web`: PASS, 2 Playwright tests.
- `npm audit --audit-level=high` from `D:\LifeOS\web`: PASS, 0 vulnerabilities.
- `git diff --check` from `D:\LifeOS`: PASS; informational LF-to-CRLF working-copy warnings only.
- `git diff --cached --check` from `D:\LifeOS`: PASS, no staged changes.

### Blocking Issues

- None.

### Non-blocking Suggestions

- Code Review could not independently repeat authenticated Vite-proxy PATCH and cleanup because PostgreSQL service `postgresql-x64-18` is currently Stopped and ports 8000/5173 are not listening. Repeat with disposable Todo data and a safe identity when services are available.
- The frontend currently infers whether a shared 404/410 came from the selected category or the Todo by refreshing active categories. This is covered and acceptable for TASK-023, but a future backend error detail would make recovery less heuristic.

### Recommended Commit Message

`feat(web): add todo core edit`

## Git Commit

Result: PASS

Committed by: Git Commit window

Committed at: 2026-08-11

Result Commit: `af3dcd327246e1d56c730646e745488a8965844c`

Commit Message: `feat(web): add todo core edit`

Push Target: `origin/main`

Files Committed:

- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-023-pc-web-todo-core-edit.md`
- `web/e2e/identity-todos.spec.ts`
- `web/package-lock.json`
- `web/src/App.test.tsx`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/styles.css`
- `web/src/types.ts`

## Closure

Result: PASS

Checked by: Decision window

Checked at: 2026-08-11 23:16 +08:00

Result Commit: `af3dcd327246e1d56c730646e745488a8965844c`

Completion Commit: `5db6fdf34d062c21a0c5305a541f665489aaf62f`

Remote Verification: local `HEAD`, `origin/main`, and remote `refs/heads/main` all matched completion commit `5db6fdf34d062c21a0c5305a541f665489aaf62f` before closure-document edits.

Working Tree Before Closure Docs: clean; no staged or untracked files.

### Independent Verification

- `npm test -- --run` from `web/`: PASS, 2 files and 67 tests.
- `npm run build` from `web/`: PASS, TypeScript and Vite production build.
- `npm run test:e2e` from `web/`: PASS, 2 Playwright tests at desktop and narrow widths.
- `npm audit --audit-level=high` from `web/`: PASS, 0 vulnerabilities.
- Code Review: PASS with no blocking findings.
- All 20 acceptance criteria were confirmed from implementation, Code Review evidence, and the independent verification above.

### Issue Disposition

- No unresolved TASK-023 P0, P1, or P2 issue is recorded in `handoff/issue-log.md`.
- Authenticated live Vite-proxy PATCH and cleanup remain unverified because no dedicated disposable identity token/data set was available; PostgreSQL was stopped and ports 8000/5173 were not listening during Closure Check.
- This environment limitation is non-blocking under the approved task: no real user data was touched and no authenticated live-write claim is made. Repeat later only with safe disposable data and confirmed cleanup.
- No other follow-up is required to close TASK-023.

### Remaining Follow-ups

- Continue PC Web Todo status actions and SSE refresh as separate slices after terminal closure.
- Preserve note/due-time editing and Todo deletion as separately prioritized work; they were outside TASK-023.
- PC Web remains partial, followed by Android and cross-client Phase 1A acceptance.

### Terminal Closure Commit

Approved files:

- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `handoff/project-state.md`
- `tasks/TASK-023-pc-web-todo-core-edit.md`

Recommended commit message: `docs(task): close TASK-023`

After this exact-scope commit is pushed and remote parity is verified, return control to Decision. This is the terminal Closure Commit for TASK-023; do not run another Closure Check for it.
