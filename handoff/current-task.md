# LifeOS Current Task

Last updated: 2026-08-11

## Metadata

- Task ID: TASK-023
- Task Name: PC Web Todo core edit vertical slice
- Status: REVIEWING
- Priority: P1
- Parent Task: Phase 1A PC Web
- Dependencies:
  - Todo update API published in `09cd984`
  - Todo list and Today APIs published in `dd0d6fa` and `2a698f3`
  - TASK-022 terminal closure published in `275f4a2`
  - Existing PC Web identity, Today, Todos, categories, and Todo quick-create surfaces under `web/`

## Background

PC Web can now create and display pending Todos, but users cannot correct the core planning fields after creation. This slice adds an editor for the same high-frequency fields already used by quick create while keeping note/due-time editing, status actions, deletion, and SSE separate.

## Goal

An authenticated PC Web user can edit a visible pending Todo's title, active category, priority, and planned date from Today or Todos, then immediately see server-authoritative data in every already-loaded Todo view.

## Scope

### In Scope

- Add typed authenticated `PATCH /api/v1/todos/{id}` integration with a UUID `Idempotency-Key`.
- Add a compact accessible edit command to Todo rows in Today and Todos.
- Edit title, active category including Inbox, priority, and optional planned date.
- Initialize the editor from the selected Todo and preserve `YYYY-MM-DD` planned dates without timestamp conversion.
- Load or retry active categories when the editor opens and preserve server order.
- Handle validation, stale/deleted category, missing/deleted Todo, idempotency conflict, unauthorized, in-flight, recoverable failure/retry, cancel, and success states.
- Refresh every relevant already-loaded Today and Todos dataset after a successful update.
- Preserve existing identity, Today, Todos, category CRUD, and Todo quick-create behavior.
- Add focused component/API and Playwright coverage at desktop and narrow widths.
- Attempt and record live Vite-proxy verification when services and safe disposable data are available.

### Out of Scope

- Editing Todo `note` or `due_at`.
- Completing, reopening, canceling, or deleting a Todo.
- Todo detail route, modal history, filters, pagination controls, or bulk actions.
- SSE refresh, sync cursor storage, offline cache, PWA, or Android work.
- Backend API, authentication, database, migration, or seed-data changes.
- Changes to stable requirements, architecture, MVP, API-contract, or data-model documents.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 6, 7.2, 8.1, 9.1, 10.1, and 10.4
- `docs/mvp.md` Phase 1A PC Web scope
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/calendar-date.ts`
- `web/src/styles.css`
- `web/e2e/identity-todos.spec.ts`
- Backend Todo update schema/router/tests only as contract references

### Allowed Modify Files

- Existing `web/` source, tests, styles, Playwright specs/config, package manifest, and lockfile when justified
- `web/README.md` for concise updated run or verification instructions
- `docs/phase1a-progress.md`
- Active TASK-023 handoff, gate, Git record, and issue-log files

### Forbidden Modify Files

- Any `backend/` implementation, tests, dependencies, settings, or migrations
- Stable product, architecture, MVP, API-contract, or data-model documents
- Todo note/due-time input, complete, reopen, cancel, delete, filter, pagination, or detail behavior
- SSE, sync recovery, offline/PWA, Reminder, Recurring Todo, or Android behavior
- Raw identity tokens, `.env` secrets, generated output, dependency directories, logs, caches, or editor-local files
- Completed TASK-005 through TASK-022 archives

## Implementation Requirements

- Reuse the existing identity bootstrap, bearer authorization, active-category state, plain calendar-date helpers, unauthorized clearing, notices, focus behavior, and server refresh functions. Never send `user_id` or expose the raw token.
- Add a typed Todo-update payload and write envelope at the existing API boundary. The editor may send only `title`, `category_id`, `priority`, and `planned_date`.
- Trim title, reject blank input, and enforce the backend maximum of 500 characters before submission. Priority must remain `high`, `medium`, or `low`.
- Treat `planned_date` as a plain `YYYY-MM-DD`; clearing it sends `null`. Never convert it through a browser-local or UTC timestamp.
- Category choices preserve server order. Editing to Inbox sends the active Inbox category UUID; do not reuse create's omitted-category default rule for PATCH. Do not offer deleted categories as selectable targets.
- For a Todo whose historical category is deleted, missing, or unavailable, initialize the category choice to the active Inbox while preserving all other fields. Do not guess an Inbox ID before active categories load.
- Do not send `note`, `due_at`, `status`, `completed_at`, `deleted_at`, `version`, `user_id`, timestamps, or other system fields. Omitting `note` and `due_at` must preserve their server values.
- Generate one UUID `Idempotency-Key` per logical update attempt. An unchanged recoverable retry reuses that key; changing any submitted field after failure invalidates the prior attempt and generates a new key.
- Prevent duplicate submission while a request is in flight. Cancel closes and discards the draft without a request; reopening starts a new draft and logical attempt.
- Opening the editor when category state is `idle` or `error` must request categories again. A category-load failure keeps an explicit retry path and must not silently submit a guessed category.
- If the selected category becomes unavailable, refresh categories, select active Inbox when available, preserve other draft fields, and allow a new attempt.
- If the Todo becomes missing or deleted, close the stale editor, show safe feedback, and refresh already-loaded Todo datasets.
- On success, close the editor, announce success accessibly, restore focus sensibly, and refetch every relevant Today/Todos dataset already loaded. Do not mutate or reorder list data locally as a substitute for server refresh.
- A `401` clears approved identity storage and returns to setup. Expected validation and idempotency conflicts use concise safe feedback. Network/server failures preserve the unchanged draft and expose retry.
- Keep row actions and the editor compact, stable, keyboard-accessible, and non-overlapping at desktop and narrow widths. Use the existing icon library and accessible labels.
- Preserve all credible TASK-018 through TASK-022 tests and behavior. Avoid broad state-management, architecture, or design-system refactors.
- If services and a dedicated disposable identity are available, update a disposable Todo through the Vite proxy and restore or delete the test data. Otherwise record the exact limitation and do not use real user data or claim authenticated live verification.

## Acceptance Criteria

- [ ] Todo rows in Today and Todos expose a clear accessible edit command without making the whole row an ambiguous action target.
- [ ] Opening the editor initializes title, active category, priority, and planned date from the selected Todo and places focus sensibly.
- [ ] Cancel sends no request, discards the draft, and restores focus to the originating edit command.
- [ ] Title is trimmed, non-empty, and at most 500 characters; priority is constrained to high/medium/low.
- [ ] Category choices preserve server order; Inbox sends its active UUID, and deleted or unavailable categories are not selectable.
- [ ] Planned date is sent unchanged as `YYYY-MM-DD`, and clearing it sends `null` without timezone drift.
- [ ] PATCH sends only `title`, `category_id`, `priority`, and `planned_date` with bearer authorization and a valid UUID `Idempotency-Key`.
- [ ] PATCH never sends `user_id`, status, note, due time, version, timestamps, or other forbidden fields, preserving omitted note/due values.
- [ ] An unchanged recoverable retry reuses its idempotency key; changing any failed submitted field causes a new key.
- [ ] Duplicate in-flight submission is prevented; cancel/reopen starts a fresh logical attempt.
- [ ] Category loading retries when the editor opens from idle/error; load failure has an explicit retry and cannot submit a guessed category.
- [ ] A stale selected category refreshes categories, selects active Inbox when available, preserves other fields, and permits a new attempt.
- [ ] Missing/deleted Todo, validation, idempotency conflict, network/server retry, unauthorized, in-flight, cancel, and success states behave safely.
- [ ] Successful edit closes the draft and refetches every relevant already-loaded Today/Todos dataset in server order.
- [ ] Existing identity, Today, Todos, category CRUD, quick-create, and identity-switch behavior remains correct.
- [ ] Desktop and narrow viewport checks show no overlap, clipping, horizontal overflow, inaccessible controls, or incoherent focus.
- [ ] Focused tests cover exact payloads, initialization, clear date, category semantics/retry, idempotent retry, stale Todo/category, success refresh, and major failure states.
- [ ] Production build and high-severity dependency audit pass; generated artifacts and secrets are absent from the task diff.
- [ ] Live proxy evidence and cleanup are recorded when safe disposable data are available; otherwise the exact limitation is reported without claiming live integration.
- [ ] No backend, note/due-time, Todo status/delete, SSE, Android, or other out-of-scope feature is modified.

## Verification Plan

- Run `npm test`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=high` from `web/`.
- Inspect PATCH payload and headers for exact allowed fields, Inbox UUID behavior, plain/cleared planned date, bearer authorization, UUID idempotency lifecycle, and forbidden-field absence.
- Verify open/init, cancel/focus restoration, validation, unchanged retry, changed-draft invalidation, duplicate-submit prevention, category load retry, and stale category/Todo behavior.
- Verify successful edit refreshes already-loaded Today and Todos datasets and preserves server ordering.
- Exercise quick create, category CRUD, identity switching, Today/Todos navigation, and unauthorized clearing for regression.
- Inspect desktop and narrow browser views, keyboard/focus behavior, row actions, editor controls, and horizontal overflow.
- Attempt live update only with disposable identity/data and confirmed cleanup; record the exact result.
- Inspect exact changed/ignored files, run `git diff --check`, and independently check new files for whitespace, artifacts, and secrets.

## Risks

- PATCH Inbox semantics differ from create semantics: omitting `category_id` preserves the old category, while editing to Inbox must send the active Inbox UUID.
- A stale category or Todo can leave the editor pointed at data that can no longer be mutated.
- Incorrect idempotency-attempt boundaries can repeat or conflict with updates after ambiguous failures.
- Local list mutation can diverge from backend ordering and Today section membership.
- Row action additions can become cramped or inaccessible on narrow screens.

## Coding Output Requirements

Report modified files, Todo-update API/payload, category and date semantics, idempotency lifecycle, editor/focus behavior, refresh strategy, visible states, responsive/accessibility checks, acceptance results, unit/build/e2e/audit results, live proxy status and cleanup, diff/artifact/secret checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit

Required next action: commit and push the Code Review-approved TASK-023 file set. Keep TASK-023 at REVIEWING until Git Commit publishes the result and updates both task-status files to COMPLETED.
