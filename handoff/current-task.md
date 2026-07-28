# LifeOS Current Task

Last updated: 2026-07-28

## Metadata

- Task ID: TASK-019
- Task Name: PC Web Today view vertical slice
- Status: COMPLETED
- Priority: P1
- Parent Task: Phase 1A PC Web
- Dependencies:
  - TASK-015 Today Todo aggregation API published in `2a698f3`
  - TASK-018 terminal closure published in `dc710ba`
  - Existing PC Web identity and pending Todo list foundation under `web/`

## Background

TASK-018 established token-derived identity and a usable pending Todo list. The next PC Web slice should expose the backend Today aggregation without mixing in category management, Todo mutations, SSE, or Android work.

## Goal

An authenticated PC Web user can open a Today view for the current date in the resolved identity timezone, inspect the backend-provided overdue, due, planned, and recent Inbox sections, and move between dates without losing the existing pending Todo list experience.

## Scope

### In Scope

- Add authenticated `GET /api/v1/todos/today?date=YYYY-MM-DD` integration.
- Add a compact Today/Todos view switch without introducing a routing framework.
- Default Today to the current calendar date in the `/me` identity timezone.
- Add previous-date, next-date, date-selection, and return-to-today controls.
- Render the four API sections and pending/completed/overdue summary while preserving server ordering.
- Handle Today loading, empty, recoverable error/retry, and unauthorized states.
- Add focused unit/component and Playwright coverage for desktop and narrow viewports.
- Attempt and record a live Vite-proxy smoke test when PostgreSQL and the backend can be made available.

### Out of Scope

- Todo category views or management.
- Todo create, edit, complete, reopen, or delete actions.
- SSE refresh, sync cursor storage, offline cache, PWA, or Android work.
- Backend API, database, authentication, CORS, migration, or seed-data changes.
- Pagination/filter controls, Todo detail screens, or a routing framework.
- Changes to stable requirements, architecture, MVP, API-contract, or data-model documents.

## Related Files

### Expected Read Files

- `docs/api-phase1a.md` sections 2, 7.2, 9.4, 10.1, and 11
- `docs/mvp.md` Phase 1A PC Web scope
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/styles.css`
- `web/e2e/identity-todos.spec.ts`
- Backend Today response DTO/tests only as contract references

### Allowed Modify Files

- Existing `web/` source, tests, styles, Playwright specs/config, package manifest, and lockfile when justified
- `web/README.md` for concise updated run/verification instructions
- `docs/phase1a-progress.md`
- Active TASK-019 handoff, gate, Git record, and issue-log files

### Forbidden Modify Files

- Any `backend/` implementation, tests, dependencies, settings, or migrations
- Stable product, architecture, MVP, API-contract, or data-model documents
- Category, mutation, SSE, sync-recovery, offline/PWA, or Android behavior
- Raw identity tokens, `.env` secrets, generated output, dependency directories, logs, caches, or editor-local files
- Completed TASK-005 through TASK-018 archives

## Implementation Requirements

- Reuse the existing identity bootstrap, bearer authorization, API error handling, and token-clearing behavior. Never send `user_id` or expose the raw token.
- Add a typed Today response for `date`, `timezone`, `sections`, `summary`, and `server_time`, and request the selected date as an encoded `YYYY-MM-DD` query value.
- Derive the initial date from the resolved user's timezone, not the browser's timezone. Use calendar-date arithmetic that cannot shift the selected date through local UTC conversion.
- Present Today and Todos as two compact application views. Preserve the existing pending Todo list behavior and avoid adding a router for this two-view slice.
- Render `overdue`, `due`, `planned`, and `inbox_recent` in API order with clear section labels and counts. Do not reassign, merge, or resort Todos on the client.
- Display the API summary counts for pending, completed, and overdue items. Empty sections and an entirely empty Today response must remain understandable without decorative card nesting.
- Provide accessible previous/next controls, a labelled date input or equivalent native date selector, and a return-to-today control. Keep dimensions stable at desktop and narrow widths.
- Keep identity switching and unauthorized handling consistent with TASK-018. A Today `401` clears identity storage; recoverable failures keep the identity and expose retry.
- Extend tests without deleting credible TASK-018 coverage. Cover timezone-derived initial date, exact request URL/header, section rendering/order, date navigation, empty/error/retry, unauthorized clearing, and switching between Today and Todos.
- Use the existing frontend stack and dependencies unless a new dependency is demonstrably necessary. Do not introduce speculative state management or design-system abstractions.
- Inspect the local PostgreSQL/backend availability. If available or startable within normal permissions, run a live `/me`, `/todos`, and `/todos/today` smoke test through the Vite proxy. Otherwise record the exact environment blocker and retain mocked contract/browser evidence; do not modify backend scope to work around it.

## Acceptance Criteria

- [x] A valid stored or newly entered identity opens a usable Today view whose initial date matches the identity timezone.
- [x] The client sends authenticated `GET /api/v1/todos/today?date=YYYY-MM-DD` requests without `user_id` or token leakage.
- [x] Today renders all four backend sections in their supplied order and displays pending, completed, and overdue summary counts.
- [x] Previous, next, direct date selection, and return-to-today controls request the correct calendar date without timezone drift.
- [x] Switching between Today and Todos preserves the existing identity and pending-list behavior.
- [x] Loading, entirely empty, section-empty, recoverable error/retry, and unauthorized states behave correctly.
- [x] Unauthorized clears approved identity storage; recoverable failures preserve it.
- [x] Desktop and narrow viewport checks show no overlap, clipping, horizontal overflow, or inaccessible controls.
- [x] Existing tests remain green and focused new tests cover Today API, timezone/date behavior, rendering, navigation, and major failure states.
- [x] Production build and dependency audit pass; generated artifacts and secrets are absent from the task diff.
- [x] Live proxy smoke evidence is recorded when the local services are available; otherwise the exact environment limitation is reported without claiming live integration.
- [x] No backend or other out-of-scope Phase 1A feature is modified.

## Verification Plan

- Run `npm test`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=high` from `web/`.
- Verify mocked Today responses for populated, empty, unauthorized, and recoverable-error flows.
- Verify the identity timezone initial date and previous/next calendar arithmetic with deterministic tests.
- Inspect request URLs and authorization headers for exact contract use and absence of `user_id` or raw-token exposure.
- Inspect desktop and narrow browser views, including date controls, all section labels, summary values, and no horizontal overflow.
- Attempt the documented live Vite-proxy smoke path if PostgreSQL/backend availability permits it and record the result.
- Inspect exact changed/ignored files, run `git diff --check`, and independently check new files for whitespace/artifact/secret issues.

## Risks

- Browser-local date handling can choose the wrong day for an identity in another timezone.
- Client-side sorting or section reassignment can silently contradict the Today API contract.
- Adding navigation can regress the already-published pending Todo list or identity flow.
- Live integration may remain unverified while the local PostgreSQL service is stopped.
- A broad frontend architecture change would make this slice harder to review and close.

## Coding Output Requirements

Report modified files, typed API changes, timezone/date strategy, view navigation, visible states, responsive/accessibility checks, acceptance results, unit/build/e2e/audit results, live proxy smoke status, diff/artifact/secret checks, unresolved issues, and task-outside findings.

## Current Stage

Next role: Git Commit (Terminal Closure Commit)

Closure Check: PASS

Checked at: 2026-07-28 08:39 +08:00

Result Commit: `d57fd9af38176583634c698e4c9a6276dd384177`

Completion Commit: `aead2226d46b0663c858f94a71b1d26c55b9eb92`

Remote Verification: local `main`, `origin/main`, and remote `refs/heads/main` all matched `aead2226d46b0663c858f94a71b1d26c55b9eb92` before Closure documentation edits.

Required next action: commit and push only the Decision-approved TASK-019 Closure documents with message `docs(task): close TASK-019`. After remote parity is verified, return to Decision; do not run another Closure Check.
