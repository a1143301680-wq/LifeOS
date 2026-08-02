# LifeOS Current Task

Last updated: 2026-08-02

## Metadata

- Task ID: TASK-022
- Task Name: PC Web Todo quick-create vertical slice
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A PC Web
- Dependencies:
  - Todo create API published in `f2fe55e`
  - Todo list and Today APIs published in `dd0d6fa` and `2a698f3`
  - TASK-021 terminal closure published in `501d6c2`
  - Existing PC Web identity, Today, Todos, and category-management views under `web/`

## Background

The PC Web app can read Todos and fully manage active categories, but users still cannot add a Todo. The first Todo mutation slice should deliver a practical quick-create flow with correct category selection, plain calendar-date handling, idempotent retries, and server-authoritative refresh without combining the later edit/action/SSE work.

## Goal

An authenticated PC Web user can quickly create a pending Todo with a required title, optional active category, priority, and optional planned date, then immediately see the server result reflected in the relevant Today and Todos views.

## Scope

### In Scope

- Add authenticated `POST /api/v1/todos` integration with a UUID `Idempotency-Key`.
- Add a compact, accessible quick-create entry from the existing Today and Todos work surfaces.
- Support title, active category or server-default Inbox, priority, and optional planned date.
- Default the planned date to the currently selected Today date when opening from Today; default it to no planned date when opening from Todos.
- Load or reuse active categories for the category picker while preserving server order.
- Handle validation, stale/deleted category, idempotency conflict, unauthorized, in-flight, recoverable failure/retry, cancel, and success states.
- Refresh relevant already-loaded Today and Todos data after successful creation so the server remains authoritative.
- Preserve existing identity, Today, Todos, and category CRUD behavior.
- Add focused component/API and Playwright coverage at desktop and narrow widths.
- Attempt and record live Vite-proxy verification when services and a safe disposable identity are available.

### Out of Scope

- Todo note or due-time entry in the quick-create form.
- Todo detail, edit, complete, reopen, delete, filters, or pagination controls.
- Client-generated Todo IDs, completed/canceled status, recurring behavior, or reminders.
- SSE refresh, sync cursor storage, offline cache, PWA, or Android work.
- Backend API, authentication, database, CORS, migration, or seed-data changes.
- Changes to stable requirements, architecture, MVP, API-contract, or data-model documents.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 7.2, 8.1, 9.1, 10.1, and 10.2
- `docs/mvp.md` Phase 1A PC Web scope
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/calendar-date.ts`
- `web/src/styles.css`
- `web/e2e/identity-todos.spec.ts`
- Backend Todo create schema and tests only as contract references

### Allowed Modify Files

- Existing `web/` source, tests, styles, Playwright specs/config, package manifest, and lockfile when justified
- `web/README.md` for concise updated run/verification instructions
- `docs/phase1a-progress.md`
- Active TASK-022 handoff, gate, Git record, and issue-log files

### Forbidden Modify Files

- Any `backend/` implementation, tests, dependencies, settings, or migrations
- Stable product, architecture, MVP, API-contract, or data-model documents
- Todo note/due-time input, edit, complete, reopen, delete, filter, pagination, or detail behavior
- SSE, sync-recovery, offline/PWA, Reminder, Recurring Todo, or Android behavior
- Raw identity tokens, `.env` secrets, generated output, dependency directories, logs, caches, or editor-local files
- Completed TASK-005 through TASK-021 archives

## Implementation Requirements

- Reuse the existing identity bootstrap, bearer authorization, active-category data, plain calendar-date helpers, unauthorized clearing, and recoverable-error behavior. Never send `user_id` or expose the raw token.
- Add a typed Todo-create payload and write envelope using the existing API boundary. Send only `title`, optional `category_id`, `priority`, and optional `planned_date`.
- Trim title, reject blank input, and enforce the backend maximum of 500 characters before submission. Priority must be one of `high`, `medium`, or `low` and default to `medium`.
- Use a native or equivalently accessible plain-date control for `planned_date`; send `YYYY-MM-DD` unchanged and never convert it through browser-local UTC timestamps.
- When quick create opens from Today, initialize `planned_date` to the currently selected Today date. When it opens from Todos, initialize with no planned date. Later user edits to the form are authoritative.
- The category picker must preserve server order and include an explicit Inbox/default choice represented by omitting `category_id`, not by client-sending a guessed Inbox ID. Normal active categories send their selected UUID.
- Do not send `id`, `note`, `due_at`, `status`, `completed_at`, `user_id`, timestamps, or other system fields.
- Generate one UUID `Idempotency-Key` per logical create attempt. An unchanged recoverable retry reuses that key; changing any payload field after failure invalidates the prior attempt and generates a new key.
- Prevent duplicate submission while a request is in flight. Cancel closes and clears the transient draft without a request; reopening starts a new draft and logical attempt.
- On success, close and clear the form, announce success accessibly, and refetch every relevant Today/Todos dataset that has already been loaded. Do not insert or sort the response locally as a substitute for server refresh.
- Map expected `400 validation_error` and `409 idempotency_key_conflict` to concise safe feedback. If a selected category becomes unavailable, refresh categories, reset selection to Inbox/default, preserve other draft fields, and allow a new attempt.
- A `401` clears approved identity storage and returns to setup. Network/server failures preserve the unchanged draft and expose retry.
- Keep create controls compact and stable at desktop/narrow widths with accessible labels, priority selection, keyboard flow, focus restoration, and no overlapping action surfaces.
- Preserve all credible TASK-018 through TASK-021 tests and behavior. Avoid broad architecture or design-system refactors.
- If services and a dedicated disposable identity are available, create and clean up a live test Todo through the Vite proxy. Otherwise record the exact limitation and do not use a real user's token or claim live write integration.

## Acceptance Criteria

- [ ] Today and Todos expose a clear accessible quick-create command; opening and canceling it sends no request and restores a sensible focus target.
- [ ] Opening from Today defaults `planned_date` to the selected Today calendar date; opening from Todos defaults it to unset without timezone drift.
- [ ] The form validates a trimmed non-empty title up to 500 characters and constrains priority to high/medium/low.
- [ ] Category choices preserve server order; selecting Inbox/default omits `category_id`, while a selected active normal category sends its UUID.
- [ ] Create sends only approved fields to `POST /api/v1/todos` with bearer authorization and a valid UUID `Idempotency-Key`.
- [ ] No request sends `user_id`, status, note, due time, client ID, timestamps, or other forbidden fields.
- [ ] An unchanged recoverable retry reuses its idempotency key; changing any failed payload field causes a new key.
- [ ] Duplicate in-flight submission is prevented; cancel/reopen starts a fresh draft and logical attempt.
- [ ] Validation, idempotency conflict, stale/deleted category, network/server retry, unauthorized, in-flight, cancel, and success states behave correctly.
- [ ] A stale selected category triggers category refresh, resets to Inbox/default, preserves other draft fields, and allows a new create attempt.
- [ ] Successful create closes and clears the draft and refetches every relevant already-loaded Today/Todos dataset in server order.
- [ ] Existing identity, Today, Todos, category list/create/update/delete, and identity-switch behavior remains correct.
- [ ] Desktop and narrow viewport checks show no overlap, clipping, horizontal overflow, inaccessible controls, or incoherent form focus.
- [ ] Existing tests remain green and focused new tests cover payloads, date defaults, category semantics, idempotent retry, stale category, success refresh, and major failure states.
- [ ] Production build and dependency audit pass; generated artifacts and secrets are absent from the task diff.
- [ ] Live proxy evidence and cleanup are recorded when services and a disposable identity are available; otherwise the exact limitation is reported without claiming live integration.
- [ ] No backend, Todo edit/action, SSE, note/due-time, or other out-of-scope feature is modified.

## Verification Plan

- Run `npm test`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=high` from `web/`.
- Inspect POST payload and headers for exact allowed fields, plain planned date, bearer authorization, UUID idempotency lifecycle, and forbidden-field absence.
- Verify Today/Todos opening defaults, cancel/focus restoration, title/priority/category validation, unchanged retry, changed-payload invalidation, and duplicate-submit protection.
- Verify stale/deleted category refresh/reset behavior, unauthorized clearing, safe errors, and success refresh of already-loaded Today/Todos data.
- Exercise existing category CRUD and Today/Todos/Categories navigation for regression.
- Inspect desktop and narrow browser views, keyboard/focus behavior, form controls, action alignment, and no horizontal overflow.
- Attempt live creation only with disposable identity/data and confirmed cleanup; record the exact result.
- Inspect exact changed/ignored files, run `git diff --check`, and independently check new files for whitespace, artifact, and secret issues.

## Risks

- Incorrect idempotency-attempt boundaries can duplicate Todos after ambiguous failures.
- Category-default handling can accidentally send a stale or guessed Inbox ID instead of relying on the server invariant.
- Planned dates can drift if converted through JavaScript timestamps instead of treated as calendar dates.
- Refreshing only the visible view can leave the other already-loaded view stale.
- Live verification can pollute real data without a disposable identity and cleanup path.

## Coding Output Requirements

Report modified files, Todo-create API/payload, idempotency lifecycle, Today/Todos date defaults, category/default semantics, focus behavior, refresh strategy, visible states, responsive/accessibility checks, acceptance results, unit/build/e2e/audit results, live proxy status and cleanup, diff/artifact/secret checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Decision

Required next action: run Decision Closure Check for TASK-022 after verifying result commit `5a1a433da980c1ec98eec69fac2162a695a19deb` and completion record publication.
