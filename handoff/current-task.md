# LifeOS Current Task

Last updated: 2026-07-28

## Metadata

- Task ID: TASK-020
- Task Name: PC Web category list and create vertical slice
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A PC Web
- Dependencies:
  - Todo Category list/create API published in `52a701f`
  - Active category-name uniqueness published in `eca0af8`
  - TASK-019 terminal closure published in `9f96d36`
  - Existing PC Web identity, Today, and pending Todo views under `web/`

## Background

The PC Web app now supports identity validation, Today aggregation, and the pending Todo list. The next closeable slice should let the authenticated user inspect their active categories and create a category with correct idempotency and observable write states, without combining category update/delete or Todo mutations.

## Goal

An authenticated PC Web user can open a Categories view, see only their active categories in server order, and create a named category with an optional color through a safe, retryable, idempotent workflow.

## Scope

### In Scope

- Add authenticated `GET /api/v1/todo-categories` integration.
- Add authenticated `POST /api/v1/todo-categories` integration with a UUID `Idempotency-Key`.
- Add a compact Categories entry alongside Today and Todos.
- Render category name, color, Inbox identity, and useful category metadata without exposing system internals.
- Add an accessible create-category form with required name and optional constrained color selection.
- Handle category loading, empty, recoverable error/retry, unauthorized, submitting, validation/conflict, success, and failed-create retry states.
- Preserve existing identity, Today, and pending Todo behavior.
- Add focused component/API and Playwright coverage at desktop and narrow widths.
- Attempt and record live Vite-proxy verification when PostgreSQL, backend, and a safe test identity are available.

### Out of Scope

- Category rename, color update, reorder, Inbox modification, or delete.
- Todo create, edit, complete, reopen, delete, category assignment, detail, filters, or pagination UI.
- SSE refresh, sync cursor storage, offline cache, PWA, or Android work.
- Backend API, authentication, database, CORS, migration, or seed-data changes.
- Free-form icon authoring or a broad icon/category design system.
- Changes to stable requirements, architecture, MVP, API-contract, or data-model documents.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 7.2, 8.1, 9.1, and 9.2
- `docs/mvp.md` Phase 1A PC Web scope
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/styles.css`
- `web/e2e/identity-todos.spec.ts`
- Backend category schemas and list/create tests only as contract references

### Allowed Modify Files

- Existing `web/` source, tests, styles, Playwright specs/config, package manifest, and lockfile when justified
- `web/README.md` for concise updated run/verification instructions
- `docs/phase1a-progress.md`
- Active TASK-020 handoff, gate, Git record, and issue-log files

### Forbidden Modify Files

- Any `backend/` implementation, tests, dependencies, settings, or migrations
- Stable product, architecture, MVP, API-contract, or data-model documents
- Category update/delete, Todo mutation, SSE, sync-recovery, offline/PWA, or Android behavior
- Raw identity tokens, `.env` secrets, generated output, dependency directories, logs, caches, or editor-local files
- Completed TASK-005 through TASK-019 archives

## Implementation Requirements

- Reuse the existing identity bootstrap, bearer authorization, unauthorized clearing, and recoverable-error behavior. Never send `user_id` or expose the raw token.
- Add a typed active-category DTO for `id`, `name`, `color`, `icon`, `is_inbox`, `sort_order`, `created_at`, and `updated_at`.
- Fetch `GET /api/v1/todo-categories` when Categories is first opened and on explicit retry/refresh. Preserve the order returned by the server; do not client-sort.
- Add Categories to the existing compact workspace navigation without introducing a routing framework or speculative global state layer.
- Show Inbox distinctly but do not offer any Inbox mutation. Render absent color/icon values gracefully.
- Provide a labelled create form. Name must be trimmed, non-empty, and limited to the backend maximum of 120 characters before submission. Use a small fixed set of accessible color swatches plus a no-color choice; do not accept arbitrary unsafe style strings.
- Do not send `is_inbox`, `user_id`, timestamps, or client-calculated `sort_order`. Omit optional `color` when no color is selected.
- Generate a UUID `Idempotency-Key` for each logical create attempt. A recoverable retry of the same unchanged payload must reuse the same key; changing the payload after failure must invalidate that attempt and generate a new key.
- Disable duplicate submissions while a create is in flight. On success, clear the form and refetch the category list so server ordering remains authoritative.
- Map expected `400 validation_error` responses to concise user-facing validation feedback without displaying backend internals. Network/server failures must preserve the form and allow retry. A `401` clears identity storage and returns to token setup.
- Keep Today and Todos behavior and tests intact. Avoid broad extraction/refactoring unless directly required to prevent meaningful duplication in this slice.
- Inspect local service and safe test-identity availability. If available, run live `/me`, category list, and category create verification through the Vite proxy without leaving accidental test data. Otherwise record the exact limitation and do not claim live integration.

## Acceptance Criteria

- [x] A valid identity can open Categories and load only the authenticated user's active categories in server order.
- [x] Category rows show name, optional color, and a clear non-editable Inbox distinction.
- [x] The create form submits only an allowed trimmed name and optional approved color to `POST /api/v1/todo-categories`.
- [x] Every logical create attempt sends bearer authorization and a valid UUID `Idempotency-Key`, without `user_id`, `is_inbox`, token leakage, or client `sort_order`.
- [x] An unchanged recoverable retry reuses its idempotency key; editing the failed payload causes the next submission to use a new key.
- [x] Duplicate submission is prevented while pending; success clears the form and refreshes the server-ordered list.
- [x] Loading, empty, list error/retry, create validation/conflict, create network/server error/retry, success, and unauthorized states behave correctly.
- [x] Unauthorized list or create responses clear approved identity storage; recoverable failures preserve identity and form values.
- [x] Switching among Today, Todos, and Categories preserves the published behavior of the earlier views.
- [x] Desktop and narrow viewport checks show no overlap, clipping, horizontal overflow, or inaccessible form/navigation controls.
- [x] Existing tests remain green and focused new tests cover category requests, rendering, idempotent retry, validation, success refresh, and major failure states.
- [x] Production build and dependency audit pass; generated artifacts and secrets are absent from the task diff.
- [x] Live proxy evidence is recorded when services and a safe identity are available; otherwise the exact limitation is reported without claiming live integration.
- [x] No backend, category update/delete, Todo mutation, SSE, or other out-of-scope feature is modified.

## Verification Plan

- Run `npm test`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=high` from `web/`.
- Verify mocked category list responses for populated, empty, unauthorized, and recoverable-error flows.
- Inspect create request body and headers, including UUID idempotency generation/reuse and forbidden-field absence.
- Verify successful create refetches and renders server order; verify failed create preserves form values and correct retry behavior.
- Exercise Today/Todos/Categories switching and existing identity switching.
- Inspect desktop and narrow browser views for navigation, category rows, create form, feedback, focus behavior, and no horizontal overflow.
- Attempt the documented live Vite-proxy path when services and safe identity data permit it; record the exact result.
- Inspect exact changed/ignored files, run `git diff --check`, and independently check new files for whitespace, artifact, and secret issues.

## Risks

- Incorrect idempotency-key lifecycle can create duplicate categories after ambiguous network failures.
- Client-side sorting can diverge from backend category ordering.
- Displaying a color value directly as CSS can permit malformed styling unless constrained or safely validated.
- Adding a third view can regress the existing Today/Todos navigation and responsive header.
- Live write verification can leave test categories in a real user's data if cleanup is not planned.

## Coding Output Requirements

Report modified files, typed category API changes, idempotency-key lifecycle, request payload constraints, navigation/form/list behavior, visible states, responsive/accessibility checks, acceptance results, unit/build/e2e/audit results, live proxy status and cleanup, diff/artifact/secret checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit (Terminal Closure Commit)

Closure Check: PASS

Checked at: 2026-07-29 08:34 +08:00

Result Commit: `ce3d4ec72e2fdf81d957e883b6603a94a04ca8c9`

Completion Commit: `8500740282891a103e38c9aae891df94eed61481`

Remote Verification: local `main`, `origin/main`, and remote `refs/heads/main` all matched `8500740282891a103e38c9aae891df94eed61481` before Closure documentation edits.

Required next action: commit and push only the Decision-approved TASK-020 Closure documents with message `docs(task): close TASK-020`. After remote parity is verified, return to Decision; do not run another Closure Check.
