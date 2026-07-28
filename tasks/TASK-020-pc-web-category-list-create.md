# TASK-020: PC Web category list and create vertical slice

Status: COMPLETED

Priority: P1

Parent: Phase 1A PC Web

Published by: Decision window

Published at: 2026-07-28

## Goal

Add a usable authenticated Categories view to the PC Web app, including server-ordered active-category listing and safe idempotent category creation with complete observable UI states.

## Scope Summary

- Integrate `GET /api/v1/todo-categories`.
- Integrate `POST /api/v1/todo-categories` with correct `Idempotency-Key` lifecycle.
- Add Categories navigation, list rendering, and an accessible name/color create form.
- Preserve identity, Today, and pending Todo behavior.
- Keep category update/delete, Todo mutations, SSE, backend changes, offline behavior, and Android out of scope.

## Dependencies

- Category list/create API result: `52a701f`
- Active category-name uniqueness result: `eca0af8`
- TASK-019 terminal closure: `9f96d36`
- Existing frontend under `web/`

## Required Evidence

- Focused tests for category requests, server-order rendering, form validation, idempotent retry, success refresh, and failure states.
- Playwright checks at desktop and narrow widths.
- Production build and dependency audit.
- Exact diff, whitespace, artifact, and secret checks.
- Live proxy result with safe cleanup when services and a test identity are available, or a precise environment limitation.

## Workflow History

- 2026-07-28: Decision published TASK-020 as `PLANNED` after verifying TASK-019 terminal closure commit `9f96d36` and clean local/remote parity.

## Task Review

- Result: PASS
- Target Status: READY
- Reviewed by: Task Review window
- Reviewed at: 2026-07-28 08:51 +08:00
- Blocking Issues: None

## Git Snapshot

- Status: COMPLETE
- Branch: main
- Base Commit: `9f96d36a1009d411e40585ab325222cf987ff46c`
- Snapshot Commit: `0dd40d545f0a40518afd143fba475f0276164439`
- Reason: approved TASK-020 readiness documents required a durable pre-Coding baseline

## Coding Result

Result: PASS

Completed at: 2026-07-28

### Modified Files

- `web/src/types.ts`
- `web/src/api.ts`
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/styles.css`
- `web/e2e/identity-todos.spec.ts`
- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `tasks/TASK-020-pc-web-category-list-create.md`

### Implementation Summary

- Added the typed Todo Category DTO and authenticated list/create API calls.
- Added a compact Categories workspace view that preserves backend order, distinguishes Inbox, safely validates displayed color values, and handles absent color/icon metadata.
- Added an accessible name and fixed-color create form. Requests contain only the trimmed name and optional approved color, bearer authorization, and a UUID `Idempotency-Key`.
- Added logical-attempt idempotency state: unchanged recoverable retries reuse the key, while editing a failed payload invalidates it. Submitting controls are locked in flight; success clears the form and refetches the list.
- Added loading, empty, list retry, validation, conflict, recoverable create retry, success, and list/create unauthorized states without displaying backend error details.
- Extended responsive styles and Playwright coverage for Today, Todos, and Categories at desktop and 375 px widths.

### Acceptance Criteria Results

- PASS: authenticated list integration preserves server order and does not send `user_id`.
- PASS: category name, safe optional color, Inbox identity, and absent icon/color states render without mutation controls.
- PASS: create payload and headers are constrained to the approved contract.
- PASS: idempotency key generation, unchanged retry reuse, edited-payload invalidation, and pending duplicate prevention are covered.
- PASS: success clearing/refetch and all required observable error states are covered.
- PASS: Today, Todos, identity storage, identity switching, and unauthorized clearing remain green.
- PASS: desktop and narrow Chrome checks report no horizontal overflow.
- PASS: no backend, category update/delete, Todo mutation, SSE, Android, or stable contract files were modified.
- PASS WITH ENVIRONMENT LIMITATION: PostgreSQL and both local services were available, but no safe raw test identity token was available. The live Vite proxy reached FastAPI and returned expected `401` for an invalid bearer on the category list; no live category was created and no test data was left.

### Verification Commands and Results

- `npm test` from `web/`: PASS, 2 files and 27 tests.
- `npm run build` from `web/`: PASS, TypeScript and Vite production build.
- `npm run test:e2e` from `web/`: PASS, 2 Chrome tests covering 1440x900 and 375x812.
- `npm audit --audit-level=high` from `web/`: PASS, 0 vulnerabilities.
- `python -m alembic current` from `backend/`: PASS, PostgreSQL revision `20260711_0003`.
- `with_server.py` with FastAPI on 8000 and Vite on 4173, then proxy GET `/api/v1/todo-categories` with an invalid bearer: PASS, HTTP 401. The helper left Windows child processes after stopping parent shells; their exact uvicorn/Vite command lines were verified, both PIDs were stopped, and both ports were confirmed released.
- Final `git diff --check`: PASS; line-ending warnings are informational.

### Git Diff Check

- Scope is limited to approved TASK-020 frontend, progress, and active workflow files.
- No backend implementation/test changes, dependency changes, secrets, `.env`, raw tokens, logs, caches, generated output, or debug code are present.
- `handoff/git-snapshot.md` remains a pre-existing workflow-state modification and was not edited by Coding.
- No files were staged, committed, pushed, reset, reverted, or discarded.

### Unresolved Issues

- Authenticated live `/me`, category list, and category create through the Vite proxy were not run because bootstrap token hashes cannot provide a safe raw token. Mocked component and real-browser contract coverage is complete; Code Review should treat live authenticated integration as residual environment risk, not as completed evidence.

### Task-Outside Findings

- None in repository scope.

## Code Review

Result: PASS

Target Status: COMPLETED

Reviewed by: Code Review window

Reviewed at: 2026-07-28 15:55 +08:00

Reviewed task: TASK-020 PC Web category list and create vertical slice

### Review Evidence

- Branch: `main`
- HEAD: `0dd40d545f0a40518afd143fba475f0276164439`
- origin/main: `0dd40d545f0a40518afd143fba475f0276164439`
- Snapshot Commit: `0dd40d545f0a40518afd143fba475f0276164439`
- Worktree Summary before review records: 10 modified tracked files, no staged files, no untracked files.
- `git diff --check`: PASS; only LF-to-CRLF working-copy warnings.
- `git diff --cached --check`: PASS.
- `git diff --cached`: empty.
- Artifact/secret check: PASS; ignored generated output remains untracked from Git, and no raw token or secret was added to the task diff.

### Test Commands And Results

- `npm test` from `web/`: PASS, 2 files and 27 tests.
- `npm run build` from `web/`: PASS, TypeScript and Vite production build.
- `npm run test:e2e` from `web/`: PASS, 2 Chromium tests at desktop and narrow widths.
- `npm audit --audit-level=high` from `web/`: PASS, 0 vulnerabilities.
- `python -m alembic current` from `backend/`: PASS, PostgreSQL current revision `20260711_0003`.

### Blocking Issues

None.

### Non-blocking Suggestions

- Keep authenticated live Vite-proxy category create as a future smoke check once a safe raw test identity token is available.

### Follow-up Tasks

None required for TASK-020.

### Reviewed Scope

- `web/src/types.ts`
- `web/src/api.ts`
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/styles.css`
- `web/e2e/identity-todos.spec.ts`
- `docs/phase1a-progress.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-020-pc-web-category-list-create.md`

### Recommended Commit Message

`feat(web): add category list and create view`

## Git Commit

Result: PASS

Committed by: Git Commit window

Committed at: 2026-07-28

Result Commit: `ce3d4ec72e2fdf81d957e883b6603a94a04ca8c9`

Commit Message: `feat(web): add category list and create view`

Pushed to: `origin/main`

## Closure

Pending.
