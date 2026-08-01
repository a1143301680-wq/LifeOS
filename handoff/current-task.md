# LifeOS Current Task

Last updated: 2026-07-31

## Metadata

- Task ID: TASK-021
- Task Name: PC Web category update and delete vertical slice
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A PC Web
- Dependencies:
  - Todo Category update/delete API published in `83ac3eb`
  - Active category-name uniqueness published in `eca0af8`
  - TASK-020 terminal closure published in `342b9ae`
  - Existing PC Web Categories list/create view under `web/`

## Background

TASK-020 made active categories visible and added safe idempotent creation. The next closeable slice should finish essential category management by allowing name/color edits and confirmed deletion of normal categories while preserving the Inbox invariant and all earlier PC Web behavior.

## Goal

An authenticated PC Web user can edit an active category's name and optional approved color, or explicitly confirm deletion of a normal category, with correct idempotency, server-authoritative refresh, and clear recoverable states.

## Scope

### In Scope

- Add authenticated `PATCH /api/v1/todo-categories/{id}` integration for `name` and `color`.
- Add authenticated `DELETE /api/v1/todo-categories/{id}` integration for non-Inbox categories.
- Add accessible edit and delete controls to the existing Categories view.
- Allow Inbox display-field editing while never exposing an Inbox delete action.
- Add explicit deletion confirmation that identifies the selected category.
- Handle edit/delete validation, conflict, unauthorized, stale/deleted resource, recoverable failure/retry, in-flight, success, cancel, and refresh states.
- Preserve server ordering by refetching the active category list after successful writes.
- Preserve existing identity, Today, Todos, category list, and category create behavior.
- Add focused component/API and Playwright coverage at desktop and narrow widths.
- Attempt and record live Vite-proxy verification when services and a safe test identity are available.

### Out of Scope

- Category icon editing, drag reorder, direct `sort_order` editing, Inbox identity changes, or category restoration.
- Todo create, edit, complete, reopen, delete, category assignment, detail, filters, or pagination UI.
- SSE refresh, sync cursor storage, offline cache, PWA, or Android work.
- Backend API, authentication, database, CORS, migration, or seed-data changes.
- Changes to stable requirements, architecture, MVP, API-contract, or data-model documents.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 7.2, 8.1, 9.1, 9.3, and 9.4
- `docs/mvp.md` Phase 1A PC Web scope
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/styles.css`
- `web/e2e/identity-todos.spec.ts`
- Backend category update/delete schemas and tests only as contract references

### Allowed Modify Files

- Existing `web/` source, tests, styles, Playwright specs/config, package manifest, and lockfile when justified
- `web/README.md` for concise updated run/verification instructions
- `docs/phase1a-progress.md`
- Active TASK-021 handoff, gate, Git record, and issue-log files

### Forbidden Modify Files

- Any `backend/` implementation, tests, dependencies, settings, or migrations
- Stable product, architecture, MVP, API-contract, or data-model documents
- Category icon/reorder/restore, Todo mutation, SSE, sync-recovery, offline/PWA, or Android behavior
- Raw identity tokens, `.env` secrets, generated output, dependency directories, logs, caches, or editor-local files
- Completed TASK-005 through TASK-020 archives

## Implementation Requirements

- Reuse the existing identity bootstrap, bearer authorization, category loading, safe color palette, unauthorized clearing, and recoverable-error behavior. Never send `user_id` or expose the raw token.
- Add typed PATCH and DELETE helpers using the existing API boundary. Both writes must send a UUID `Idempotency-Key`.
- Editing may send only a trimmed non-empty `name` and optional approved `color`. Clearing color must use the contract-supported `color: null`. Do not send `icon`, `sort_order`, `is_inbox`, `user_id`, or timestamps.
- The edit UI must initialize from the selected category, support cancel without mutation, constrain name to 120 characters, and disable duplicate submission while in flight.
- A logical edit attempt retains one idempotency key for an unchanged recoverable retry. Any edit to the failed payload invalidates the prior attempt and requires a new key.
- Inbox may expose the same name/color edit control as other active categories, but must never render or enable a delete control.
- Normal-category deletion requires an explicit confirmation step showing the category name. Cancel closes confirmation without a request.
- A logical delete attempt retains one idempotency key across an ambiguous/recoverable retry for the same category. Closing/canceling and starting a later deletion creates a new logical attempt.
- On successful edit or delete, close the active editor/confirmation and refetch categories so server ordering and active visibility remain authoritative.
- Map expected `400 validation_error` and `409 idempotency_key_conflict` to concise safe feedback. For `404 not_found` or `410 deleted_resource`, explain that the category is no longer available and refresh the list. Never display raw backend internals.
- A `401` from either write clears approved identity storage and returns to setup. Recoverable network/server errors preserve the current edit or confirmation context and expose retry.
- Do not allow concurrent category writes that can make the active row/attempt ambiguous. Keep action control dimensions stable and keyboard/focus behavior accessible.
- Keep all TASK-018 through TASK-020 behavior and credible tests intact. Avoid broad architecture or design-system refactors.
- If services and a safe test identity are available, run live edit/delete verification only against disposable test data created for that purpose and confirm cleanup. Otherwise record the exact limitation and do not claim live write integration.

## Acceptance Criteria

- [x] An authenticated user can open an active category editor populated with its current name and color, then cancel without issuing a request.
- [x] A valid edit sends only trimmed `name` and approved `color` or `null` to the correct PATCH endpoint with bearer authorization and a UUID `Idempotency-Key`.
- [x] Unchanged recoverable edit retry reuses its idempotency key; changing the failed payload generates a new key.
- [x] Edit validation/conflict, stale/deleted resource, network/server retry, unauthorized, in-flight, cancel, and success states behave correctly.
- [x] Inbox name/color editing works, but Inbox never exposes or enables deletion.
- [x] A normal category can be selected for deletion only through an explicit confirmation naming that category; cancel sends no request.
- [x] Delete sends no body or forbidden identity fields, uses bearer authorization and a UUID `Idempotency-Key`, and prevents duplicate in-flight submission.
- [x] An unchanged recoverable delete retry reuses its idempotency key; a later newly opened delete flow uses a new key.
- [x] Delete validation/conflict, stale/deleted resource, network/server retry, unauthorized, cancel, and success states behave correctly.
- [x] Successful edit/delete closes transient UI and refetches the server-ordered active-category list.
- [x] Switching among Today, Todos, and Categories and existing category creation remain correct.
- [x] Desktop and narrow viewport checks show no overlap, clipping, horizontal overflow, inaccessible controls, or incoherent confirmation behavior.
- [x] Existing tests remain green and focused new tests cover request contracts, Inbox protection, idempotent retries, stale resources, successful refresh, and major failure states.
- [x] Production build and dependency audit pass; generated artifacts and secrets are absent from the task diff.
- [x] Live proxy evidence and cleanup are recorded when services and a safe identity are available; otherwise the exact limitation is reported without claiming live integration.
- [x] No backend, Todo mutation, SSE, category reorder/icon, or other out-of-scope feature is modified.

## Verification Plan

- Run `npm test`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=high` from `web/`.
- Inspect PATCH payloads and PATCH/DELETE headers for exact endpoint, allowed fields, bearer authorization, UUID idempotency lifecycle, and forbidden-field absence.
- Verify edit initialization/cancel, color clearing, duplicate-name validation, unchanged retry, changed-payload invalidation, stale resource refresh, unauthorized clearing, and success refresh.
- Verify Inbox has editing but no delete control; verify normal-category delete confirmation, cancel, retry, stale resource handling, and successful disappearance after refetch.
- Exercise existing category creation and Today/Todos/Categories navigation.
- Inspect desktop and narrow browser views, keyboard/focus behavior, confirmation state, action alignment, and no horizontal overflow.
- Attempt the documented live Vite-proxy write path only with disposable data and safe cleanup; record the exact result.
- Inspect exact changed/ignored files, run `git diff --check`, and independently check new files for whitespace, artifact, and secret issues.

## Risks

- Incorrect write-attempt identity can replay an idempotency key against changed edit data.
- Accidentally exposing Inbox delete would violate a core backend invariant.
- A stale selected category can leave the editor or confirmation detached from the refreshed list.
- Destructive action placement can cause accidental deletion on narrow or keyboard-driven interfaces.
- Live write verification can alter real data if disposable setup and cleanup are not explicit.

## Coding Output Requirements

Report modified files, PATCH/DELETE API changes, edit/delete idempotency lifecycle, Inbox protection, confirmation/focus behavior, request constraints, list refresh behavior, visible states, responsive/accessibility checks, acceptance results, unit/build/e2e/audit results, live proxy status and cleanup, diff/artifact/secret checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit (Terminal Closure Commit)

Closure Check: PASS

Checked at: 2026-08-01 23:37 +08:00

Result Commit: `137ea03592d005f463a98b3301c81d30d704da7c`

Completion Commit: `078748a4e3421c5cbd63ab30b74ee012bd2c4c83`

Remote Verification: local `main`, `origin/main`, and remote `refs/heads/main` all matched `078748a4e3421c5cbd63ab30b74ee012bd2c4c83` before Closure documentation edits.

Required next action: commit and push only the Decision-approved TASK-021 Closure documents with message `docs(task): close TASK-021`. After remote parity is verified, return to Decision; do not run another Closure Check.
