# TASK-024: PC Web Todo complete with immediate undo

Status: REVIEWING

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-08-11

## Goal

Allow an authenticated PC Web user to complete a visible pending Todo from Today or Todos and immediately undo that latest completion from the success notice, with independent idempotent action lifecycles and server-authoritative refresh.

## Scope Summary

- Integrate bodyless complete and reopen action endpoints with bearer auth and separate UUID idempotency keys.
- Add accessible complete controls to pending Todo rows.
- Offer transient Undo only for the latest successful completion represented by the current notice.
- Handle duplicate guards, retries, stale state, unauthorized, refresh failure, success, and focus/accessibility states.
- Preserve identity, Today, Todos, category CRUD, quick-create, and core-edit behavior.
- Keep completed lists/filters, persistent reopen, delete/cancel, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Todo complete API result: `2c35f1d`
- Todo reopen API result: `c2d167f`
- Todo list/Today API results: `dd0d6fa`, `2a698f3`
- TASK-023 terminal closure: `8046032`
- Existing PC Web Todo row, notice, refresh, quick-create, and core-edit behavior under `web/`

## Required Evidence

- Focused tests for exact bodyless requests, independent idempotency lifecycles, duplicate guards, transient Undo ownership, stale states, refresh failure, and success refresh.
- Playwright checks at desktop and narrow widths.
- Production build and high-severity dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live complete/reopen with disposable-data cleanup when services and a safe identity are available, or a precise environment limitation.

## Workflow History

- 2026-08-11: Decision published TASK-024 as `PLANNED` after verifying TASK-023 terminal closure commit `8046032`, clean worktree, and local/tracking/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-08-13 08:34 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `804603264d41e9c2ead9fd57ead9336572eead1b`
- Snapshot Commit: `680a951de0f670da0573b60268c52e039f1d61d6`
- Reason: approved TASK-024 readiness documents required a durable pre-Coding baseline

## Coding Result

Result: PASS

Completed at: 2026-08-13

### Modified Files

- `web/src/api.ts`
- `web/src/App.tsx`
- `web/src/styles.css`
- `web/src/App.test.tsx`
- `web/e2e/identity-todos.spec.ts`
- `handoff/current-task.md`
- `tasks/TASK-024-pc-web-todo-complete-undo.md`

### Implementation Summary

- Added typed authenticated bodyless `POST /api/v1/todos/{id}/complete` and `POST /api/v1/todos/{id}/reopen` API functions with UUID `Idempotency-Key` headers and no request body or JSON content header.
- Added distinct accessible Complete and Edit icon controls to pending Todo rows in Today and Todos with stable desktop and narrow-width action space.
- Added one transient Undo context owned only by the latest successful completion notice; dismissing/replacing the notice, navigation, identity reset, successful Undo, or another completion clears the prior context without a request.
- Implemented separate complete and reopen idempotency lifecycles: unchanged network/server retries reuse their action key, conflicts use a new key, another Todo uses a new complete key, and Undo always starts with a key distinct from complete.
- Prevented duplicate action submissions and disabled conflicting row, navigation, Add, date, and identity controls while a mutation is pending; open quick-create/edit drafts disable row actions.
- Added safe handling for stale/invalid state, not found, deleted, idempotency conflict, unauthorized, network/server failure, success, and post-mutation refresh failure.
- Refetched every already-loaded Today/Todos dataset after successful complete/reopen and stale responses without mutating list order locally; a failed refresh never retries an already-confirmed mutation.
- Added accessible success/error announcements, Undo/Dismiss controls, Undo focus after completion, and Complete focus after successful restoration.

### Acceptance Criteria Results

- PASS: Today and Todos expose distinct accessible Complete and Edit controls with stable layout.
- PASS: complete/reopen requests are authenticated, bodyless POSTs with UUID idempotency keys, no JSON content header, and no `user_id`.
- PASS: complete and Undo duplicate pending requests are blocked; conflicting controls cannot start drafts or navigation mid-mutation.
- PASS: unchanged recoverable retries reuse the matching action key; conflicts, another Todo, and complete-to-reopen boundaries use new independent keys.
- PASS: successful completion announces the Todo title and exposes Undo only for the latest completion; successful Undo announces restoration and clears Undo.
- PASS: dismiss, notice replacement, navigation, identity reset, and another completion clear prior Undo ownership without issuing reopen.
- PASS: success and stale action responses refetch every already-loaded Today/Todos dataset in server order.
- PASS: confirmed complete or reopen remains confirmed when its subsequent list refresh fails; normal dataset retry remains available and mutation retry is absent.
- PASS: 400 invalid state, 404, 410, 409, 401, network/server, in-flight, success, and focus states are covered for the relevant actions.
- PASS: existing identity, Today, Todos, category CRUD, quick-create, and core-edit tests remain green; open core-edit disables Complete.
- PASS: Playwright covers complete/Undo at 1440x900 and 375x812 with no horizontal overflow.
- PASS: no backend, completed-list/filter, persistent reopen, Todo delete/cancel, note/due-time, SSE, Android, or stable contract file was modified.
- PASS WITH ENVIRONMENT LIMITATION: PostgreSQL was stopped and ports 8000/5173 were not listening; no dedicated disposable identity token was available, so authenticated live Vite-proxy complete/reopen and cleanup were not attempted and no live-integration claim is made.

### Verification Commands and Results

- `npm test -- --run` from `web/`: PASS, 2 files and 83 tests.
- `npm run build` from `web/`: PASS, TypeScript and Vite production build.
- `npm run test:e2e` from `web/`: PASS, 2 Playwright tests at 1440x900 and 375x812.
- `npm audit --audit-level=high` from `web/`: PASS, 0 vulnerabilities.
- Focused Vitest RED/GREEN runs: PASS for exact requests, independent retries, duplicate guards, transient ownership, stale actions, 409, 401, refresh failure, draft conflict, and focus.
- Local live precondition check: `postgresql-x64-18` stopped; ports 8000, 5173, and 4173 not listening.
- Warnings: final tests, build, E2E, and audit emitted no task-affecting warnings.

### Git Diff Check

- `git status --short --untracked-files=all`: only expected pre-Coding workflow records and TASK-024 Web implementation files; no untracked files.
- Exact API, component, style, component-test, and E2E diffs inspected; all modified implementation files are in the approved allowlist.
- `git diff --check`: PASS; informational LF-to-CRLF working-copy warnings only.
- `git diff --cached`: empty; nothing staged.
- `web/dist/` and `web/test-results/` are ignored and absent from the diff; no dependency directory, report, cache, log, local database, `.env`, or generated artifact is included.
- Secret scan found only synthetic `stored-token` test assertions; no raw real token, password, or environment secret was added.
- Pre-existing `handoff/git-snapshot.md` changes were preserved and not edited by Coding.

### Unresolved Issues

- Authenticated live proxy complete/reopen and cleanup remain unverified until local services and a dedicated disposable identity/data set are available.

### Task-Outside Findings

- None.

## Code Review

Result: PASS

Target Status: COMPLETED

Reviewed by: Code Review window

Reviewed at: 2026-08-13 08:59 +08:00

Branch: `main`

HEAD: `680a951de0f670da0573b60268c52e039f1d61d6`

Snapshot Commit: `680a951de0f670da0573b60268c52e039f1d61d6`

### Review Summary

- PASS: complete/reopen API calls are authenticated bodyless POSTs with UUID `Idempotency-Key`, no JSON content header, no request body, and no `user_id`.
- PASS: visible pending Todo rows expose distinct accessible Complete and Edit controls, with mutation and draft conflict guards.
- PASS: complete and reopen use independent idempotency lifecycles, duplicate guards, recoverable retry behavior, 409 reset behavior, and transient latest-only Undo ownership.
- PASS: success, stale/invalid, deleted, not found, unauthorized, network/server, refresh-failure, focus, notice dismissal, navigation, and identity-change flows are covered by implementation and tests.
- PASS: loaded Today/Todos datasets refresh after successful complete/reopen and stale responses; refresh failure does not retry a confirmed mutation.
- PASS: existing identity, Today, Todos, category CRUD, quick-create, and core-edit behavior remains covered.
- PASS: no backend, stable docs, completed list/filter, persistent reopen, Todo delete/cancel, SSE, Android, secrets, or generated artifacts were introduced.

### Verification Commands and Results

- `git status --short --untracked-files=all` from `D:\LifeOS`: only expected TASK-024 implementation and workflow files before review records; no untracked files.
- `git diff --check` from `D:\LifeOS`: PASS, LF-to-CRLF working-copy warnings only.
- `git diff --cached` and `git diff --cached --check` from `D:\LifeOS`: empty/PASS.
- `npm test -- --run` from `D:\LifeOS\web`: PASS, 2 files, 83 tests.
- `npm run build` from `D:\LifeOS\web`: PASS.
- `npm audit --audit-level=high` from `D:\LifeOS\web`: PASS, 0 vulnerabilities.
- `npm run test:e2e` from `D:\LifeOS\web`: PASS, 2 Playwright tests.
- Static checks over `web/src` and `web/e2e`: no trailing whitespace; no raw real token or generated artifact in the diff.

### Blocking Issues

None.

### Non-blocking Suggestions

- Authenticated live proxy complete/reopen verification remains unperformed because local PostgreSQL was stopped and ports 8000, 5173, and 4173 were not listening.

### Reviewed Scope

- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-024-pc-web-todo-complete-undo.md`
- `web/e2e/identity-todos.spec.ts`
- `web/src/App.test.tsx`
- `web/src/App.tsx`
- `web/src/api.ts`
- `web/src/styles.css`

### Recommended Commit Message

`feat(web): add todo complete undo`

### Instructions For Git Commit

TASK-024 remains `REVIEWING` until Git Commit succeeds. Git Commit may commit and push the reviewed file set; Code Review did not stage, commit, or push.

## Git Commit

Pending.

## Closure

Pending.
