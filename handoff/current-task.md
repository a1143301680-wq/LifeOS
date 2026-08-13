# LifeOS Current Task

Last updated: 2026-08-13

## Metadata

- Task ID: TASK-024
- Task Name: PC Web Todo complete with immediate undo
- Status: READY
- Priority: P1
- Parent Task: Phase 1A PC Web
- Dependencies:
  - Todo complete API published in `2c35f1d`
  - Todo reopen API published in `c2d167f`
  - Todo list and Today APIs published in `dd0d6fa` and `2a698f3`
  - TASK-023 terminal closure published in `8046032`
  - Existing PC Web identity, Today, Todos, quick-create, and core-edit surfaces under `web/`

## Background

PC Web can create and edit pending Todos but cannot finish the daily loop by marking work complete. This slice adds a compact completion action to visible pending Todos and a short-lived Undo action in the success notice, using the existing complete and reopen endpoints without adding a completed-items view or general status filtering.

## Goal

An authenticated PC Web user can complete a visible pending Todo from Today or Todos, immediately see server-authoritative refreshed data, and undo that just-completed action while the success notice remains available.

## Scope

### In Scope

- Add typed authenticated bodyless integrations for `POST /api/v1/todos/{id}/complete` and `POST /api/v1/todos/{id}/reopen`, each with a UUID `Idempotency-Key`.
- Add a compact accessible complete command to visible pending Todo rows in Today and Todos.
- After successful completion, show an accessible success notice with an Undo command for that specific Todo.
- Keep Undo intentionally transient: it is available only for the latest successful completion represented by the current notice.
- Handle unauthorized, missing/deleted Todo, invalid state, idempotency conflict, in-flight, recoverable failure/retry, success, and refresh-failure states for both actions.
- Refresh every relevant already-loaded Today and Todos dataset after successful complete or reopen, and after stale-state responses when appropriate.
- Preserve existing identity, Today, Todos, category CRUD, Todo quick-create, and core-edit behavior.
- Add focused component/API and Playwright coverage at desktop and narrow widths.
- Attempt and record live Vite-proxy verification when services and safe disposable data are available.

### Out of Scope

- A completed-Todos list, status segmented control/filter, history view, or persistent reopen entry point.
- Todo deletion, cancel status, bulk actions, swipe gestures, or keyboard shortcut schemes.
- Editing title, category, priority, planned date, note, or due time as part of the action flow.
- SSE refresh, sync cursor storage, offline cache, PWA, or Android work.
- Backend API, authentication, database, migration, or seed-data changes.
- Changes to stable requirements, architecture, MVP, API-contract, or data-model documents.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 7.2, 8.1, 9.1, 10.1, 10.5, and 10.6
- `docs/mvp.md` Phase 1A PC Web scope
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/styles.css`
- `web/e2e/identity-todos.spec.ts`
- Backend Todo complete/reopen router and tests only as contract references

### Allowed Modify Files

- Existing `web/` source, tests, styles, Playwright specs/config, package manifest, and lockfile when justified
- `web/README.md` for concise updated run or verification instructions
- `docs/phase1a-progress.md`
- Active TASK-024 handoff, gate, Git record, and issue-log files

### Forbidden Modify Files

- Any `backend/` implementation, tests, dependencies, settings, or migrations
- Stable product, architecture, MVP, API-contract, or data-model documents
- Completed-list/status-filter, Todo delete/cancel, persistent reopen, bulk-action, note/due-time, or unrelated edit behavior
- SSE, sync recovery, offline/PWA, Reminder, Recurring Todo, or Android behavior
- Raw identity tokens, `.env` secrets, generated output, dependency directories, logs, caches, or editor-local files
- Completed TASK-005 through TASK-023 archives

## Implementation Requirements

- Reuse the existing identity bootstrap, bearer authorization, Todo row layout, notices, focus behavior, unauthorized clearing, and server refresh functions. Never send `user_id` or expose the raw token.
- Add typed complete/reopen API functions returning the existing Todo write envelope. Both requests must use `POST`, bearer auth, a UUID `Idempotency-Key`, and no request body or JSON content header.
- Add a familiar icon-based complete control with an accessible name to each visible pending Todo row. Keep edit and complete controls as distinct stable action targets.
- Prevent duplicate submission while an action is in flight. Disable conflicting actions for the active Todo without resizing or reflowing the row.
- A logical complete attempt owns one idempotency key. An unchanged recoverable retry for the same Todo reuses that key; abandoning that failure or starting a different Todo action generates a new key.
- A successful complete response ends the complete attempt. Do not resend complete merely because a later list refresh fails.
- After complete succeeds, retain only the returned Todo ID/title needed for the current Undo notice. The Undo request starts a separate logical reopen attempt with its own UUID key.
- An unchanged recoverable Undo retry reuses its reopen key. Replacing/dismissing the notice, changing identity, logging out, successful Undo, or completing another Todo clears the prior Undo context.
- On complete success, announce the completed title and expose a clear Undo command. On Undo success, announce that the Todo was restored and remove the Undo command.
- Refetch every relevant Today/Todos dataset already loaded after each successful complete or reopen. Do not remove, insert, or reorder Todo rows locally as a substitute for server refresh.
- If mutation succeeds but a refresh fails, preserve the confirmed action result and current Undo availability where applicable, expose normal dataset retry, and do not treat refresh failure as a mutation retry.
- Map `400 invalid_state_transition`, `404 not_found`, and `410 deleted_resource` to safe stale-state feedback and refresh loaded Todo data. Do not expose cross-user existence details.
- Map `409 idempotency_key_conflict` and network/server failures to concise recoverable feedback. A `401` clears approved identity storage and returns to setup.
- Closing, replacing, or navigating away from a transient notice must not issue a request. Identity changes clear all action and Undo state.
- Preserve quick-create and edit drafts. Completion must not silently submit, overwrite, or merge an open editor draft; conflicting controls should be disabled or otherwise made unambiguous.
- Keep controls and notice actions keyboard-accessible, screen-reader clear, and non-overlapping at desktop and narrow widths. Use the existing icon library.
- Preserve all credible TASK-018 through TASK-023 tests and behavior. Avoid broad state-management, architecture, or design-system refactors.
- If services and a dedicated disposable identity are available, create a disposable Todo, complete it, reopen it, then clean it up through the Vite proxy. Otherwise record the exact limitation and do not use real user data or claim authenticated live verification.

## Acceptance Criteria

- [ ] Pending Todo rows in Today and Todos expose distinct accessible edit and complete controls with stable layout.
- [ ] Complete sends a bodyless authenticated `POST /api/v1/todos/{id}/complete` with a valid UUID `Idempotency-Key` and no `user_id`.
- [ ] Duplicate complete submission is prevented while the request is in flight.
- [ ] An unchanged recoverable complete retry reuses its key; abandoning it or acting on another Todo uses a new key.
- [ ] Successful complete announces the Todo title and exposes Undo for exactly that latest completed Todo.
- [ ] Undo sends a separate bodyless authenticated `POST /api/v1/todos/{id}/reopen` with its own UUID `Idempotency-Key`.
- [ ] Duplicate Undo submission is prevented; an unchanged recoverable Undo retry reuses its reopen key.
- [ ] Successful Undo announces restoration and clears the prior Undo action.
- [ ] Completing another Todo, replacing/dismissing the notice, identity change, or logout clears the previous Undo context without a request.
- [ ] Successful complete and reopen each refetch every relevant already-loaded Today/Todos dataset in server order.
- [ ] A mutation success followed by refresh failure is not retried as a mutation; confirmed state and applicable Undo remain clear while dataset retry is available.
- [ ] Missing/deleted Todo and invalid-state responses show safe feedback, clear stale action state as appropriate, and refresh loaded Todo data without leaking cross-user existence.
- [ ] Idempotency conflict, network/server retry, unauthorized, in-flight, and success states behave safely for complete and Undo.
- [ ] Open quick-create/edit drafts are not silently submitted, overwritten, or merged by Todo actions; conflicting controls remain unambiguous.
- [ ] Existing identity, Today, Todos, category CRUD, quick-create, core edit, and identity-switch behavior remains correct.
- [ ] Desktop and narrow viewport checks show no overlap, clipping, horizontal overflow, unstable row sizing, inaccessible controls, or incoherent focus.
- [ ] Focused tests cover exact bodyless requests, independent key lifecycles, duplicate guards, transient Undo ownership, stale states, refresh failure, and success refresh.
- [ ] Production build and high-severity dependency audit pass; generated artifacts and secrets are absent from the task diff.
- [ ] Live proxy complete/reopen evidence and cleanup are recorded when safe disposable data are available; otherwise the exact limitation is reported without claiming live integration.
- [ ] No backend, completed-list/filter, delete/cancel, persistent reopen, SSE, Android, or other out-of-scope feature is modified.

## Verification Plan

- Run `npm test -- --run`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=high` from `web/`.
- Inspect complete/reopen method, path, headers, empty body, UUID key lifecycle, and forbidden-field absence.
- Verify complete, retry, duplicate guard, success notice, transient Undo ownership, Undo retry, notice replacement/dismissal, identity clearing, and focus behavior.
- Verify stale/missing/deleted/invalid-state, 409, 401, network/server, and refresh-failure behavior for both actions.
- Verify successful actions refresh all already-loaded Today/Todos datasets and preserve server ordering.
- Exercise quick create, core edit, category CRUD, identity switching, Today/Todos navigation, and unauthorized clearing for regression.
- Inspect desktop and narrow browser views, keyboard/focus behavior, row action sizing, notice action alignment, and horizontal overflow.
- Attempt live complete/reopen only with disposable identity/data and confirmed cleanup; record the exact result.
- Inspect exact changed/ignored files, run `git diff --check`, and independently check new files for whitespace, artifacts, and secrets.

## Risks

- Retrying a successful mutation because its subsequent refresh failed can produce confusing invalid-state errors.
- Reusing one key across complete and reopen violates idempotency ownership and can cause conflicts.
- A stale Undo notice can reopen the wrong or no-longer-completed Todo if ownership is not explicit.
- Completing a Todo removes it from pending views, so server refresh and visible success feedback are both essential.
- Additional row and notice actions can become cramped or inaccessible at narrow widths.

## Coding Output Requirements

Report modified files, complete/reopen API boundaries, body/header evidence, independent idempotency lifecycles, transient Undo ownership, draft interaction, refresh strategy, visible states, responsive/accessibility checks, acceptance results, unit/build/e2e/audit results, live proxy status and cleanup, diff/artifact/secret checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Snapshot

Required next action: establish the pre-Coding Git Snapshot for TASK-024 from the approved publication and workflow-state files. Do not start Coding before Git Snapshot completion.
