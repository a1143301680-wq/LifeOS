# LifeOS Current Task

Last updated: 2026-10-11

## Metadata

- Task ID: TASK-033
- Task Name: PC Dashboard and Resume
- Status: COMPLETED
- Priority: P1
- Parent Task: PC V1 MVP completion
- Dependencies: TASK-031 Project/Goal core; TASK-032 AI Session records terminal Closure Commit `e8e013f5840a95132f605590d63659e854e65744`; existing Today summary and PC identity shell

## Background

PC users can manage Projects/Goals and manually record AI Sessions, but still have to visit separate views to decide what to continue. `docs/pc-delivery-plan.md` makes this the third demonstration slice. Project stages and unified timeline belong to TASK-034; this Dashboard must not invent their data.

## Goal

After identity validation, one PC screen shows up to three focused Projects/Goals, each one's next step and latest AI Session context, plus today's Todo summary, with direct navigation to the underlying Project/Session and Today views.

## In Scope

- Add a Dashboard view to the existing PC navigation and make it the default signed-in view.
- Select up to three focused projects using the deterministic selection contract below.
- Show project state, manual progress, next step, latest AI Session context including manually recorded changed files and verification result, plus a copyable continuation prompt when a session exists.
- Show current local-day Today summary from the existing API and navigation to Today.
- Handle partial loading/errors/retry, identity and project switching, desktop/narrow layout, and focused tests/browser verification.

## Out Of Scope

- New database tables, migrations, API endpoints, backend aggregation, or changes to existing Project/AI Session/Today contracts.
- Stage generation, project logs/timeline, milestones, linked Todos, Notes, Calendar, statistics, Android, AI provider calls, external chat import, autonomous writes, or a global recommendation engine.
- Reworking completed task archives or stable product/API/architecture documents.

## Relevant Files

- `docs/pc-delivery-plan.md`: PC-first sequence and TASK-033 checkpoint
- `docs/requirements.md`: sections 6 and 8 PC Dashboard and Resume
- `docs/mvp.md`: Phase 2 Dashboard acceptance and Phase 3 AI Session handoff
- `web/src/App.tsx`: navigation, identity switching, Today/Project/AI Session states, `composeAISessionPrompt`
- `web/src/api.ts`, `web/src/types.ts`, `web/src/calendar-date.ts`, `web/src/styles.css`
- `web/src/App.projects.test.tsx`, `web/src/App.ai-sessions.test.tsx`, `web/src/ai-session-prompts.test.ts`, `web/e2e/projects.spec.ts`, `web/e2e/ai-sessions.spec.ts`
- `backend/app/api/v1/projects.py`, `backend/app/api/v1/ai_sessions.py`, existing Today API: read-only contract reference

## Allowed Files

- `web/src/App.tsx`, `web/src/styles.css`; `web/src/api.ts`, `web/src/types.ts`, `web/src/calendar-date.ts` only if existing helpers/types require narrowly scoped changes
- New focused Dashboard selector/component helpers and tests under `web/src/**`, plus focused browser tests under `web/e2e/**`
- Existing `web/src/**` or `web/e2e/**` tests only where Dashboard default/navigation changes require updates
- `docs/pc-delivery-plan.md` only for verified task progress, not scope changes
- Active TASK-033 workflow/gate/Git/issue files

## Forbidden Files And Changes

- `backend/**`, `android/**`, Alembic migrations, stable API/product/architecture/data-model docs, accepted ADRs, completed task archives, or unrelated Todo/sync/AI Today logic
- Browser-selected `user_id`, cross-identity data reuse, silent external/provider calls, autonomous Project/Todo writes, secrets, machine paths, private fixtures, or generated output
- Placeholder stages or fabricated completion/change history; TASK-034 owns stages and timeline

## Implementation Requirements

1. Add `dashboard` to the existing `AppView` navigation. After successful identity validation, show Dashboard by default; switching identity invalidates Dashboard data and all in-flight requests. Today, Todos, Categories, and Projects remain directly accessible and retain existing behavior.
2. Fetch the signed-in user's existing Project list. Select at most three distinct projects: all pinned projects first, sorted `updated_at DESC, id ASC`, taking at most three; fill remaining slots with unpinned `in_progress`, then unpinned `planning`, then unpinned `paused`, each group sorted `updated_at DESC, id ASC`. Never auto-select unpinned `completed` or `abandoned`; pinned projects of any status still take precedence. A project updated/pinned in the existing view must be reflected on return/refresh, without stale cached ranking.
3. For each focused project only, use the existing nested AI Session list and take its first item (`started_at DESC, id ASC`) as latest. Do not issue session requests for every project. Show project name/type/status/manual progress/next step and latest session `goal`, `completed_work`, `modified_files`, `verification_result`, `remaining_issues`, `next_step`, and `recommended_next_prompt` when present. `modified_files` is a manually entered record of what changed; `verification_result` is the recorded verification/current-state evidence, not a live Git or test scan. If a session exists but either is null/blank, display `Modified files not recorded` or `Verification not recorded`, respectively, rather than hiding those Resume questions or fabricating answers. If no session exists, display `No AI Session yet` and no session-derived fields or copy action. Other missing optional content may be omitted; stage, linked-Todo, and timeline fields are omitted until TASK-034.
4. The primary Resume action on every focused project is labeled `Continue Development` when `project.type` is `development`, otherwise `Continue Progress` for `learning`, `life`, `health`, `pet`, and `other`; it opens the existing project detail even when no AI Session exists. A separate session action, when a session exists, opens that project's existing AI Session detail and permits returning to Dashboard. Copy continuation uses the existing `composeAISessionPrompt("continue", project, session)` contract from saved data; surface clipboard success/failure. If no session exists, do not show a copy action. Do not create or update a record from Dashboard.
5. Get Today summary from existing `GET /api/v1/todos/today` for the authenticated identity's **current date in its configured timezone**, not the date last browsed in the Today view. Display `pending_count`, `completed_count`, and `overdue_count` as returned, plus a direct Today navigation action. Opening Today uses its normal date state; Dashboard does not alter Todo status or the existing selected-date workflow.
6. Project-list, per-project AI Session, and Today requests have independent loading/error/empty/retry states. A failed Session request cannot hide the project or Today summary; a failed Today request cannot hide projects. Suppress stale responses after identity change, selection change, or navigation away and back. A 401 follows existing identity-expired handling. Keep desktop and narrow viewports usable without horizontal overflow or incoherent overlap.
7. Derive display data from current API responses without persisting a second Dashboard store or adding a backend endpoint. Display only the saved manual `modified_files` text as change evidence; do not claim an automatically derived change history, project stage, or timeline exists when TASK-034 has not provided those records.

## Acceptance Criteria

- [x] Dashboard is the default signed-in PC view and existing navigation/workflows remain reachable.
- [x] Focused selection follows the exact pinned/status/date/id order, caps at three, and updates after Project changes.
- [x] Each focused item uses only its own latest AI Session, shows accurate saved context, and navigates to Project/Session detail and back.
- [x] Full and sparse AI Sessions expose saved `modified_files` and `verification_result` or the exact missing-value labels; no session and no automatic change history are represented honestly.
- [x] Primary Resume action uses `Continue Development` only for development projects and `Continue Progress` for every other project type, including projects without a session.
- [x] Continuation copy reuses the saved-session template with visible success/failure and no provider or write request.
- [x] Today counts come from current local day in the identity timezone, independent of the Today view's browsed date, and open Today correctly.
- [x] Empty, loading, partial failure/retry, identity switch, stale response, desktop/narrow states are tested without cross-user leakage or layout overflow.
- [x] Full Web tests, production build, browser flows, and exact Git/security scans pass or record exact environmental limits; no backend/Android/future-module scope breach occurs.

## Verification Plan

- Unit/component tests for selection ties, pinned overflow, excluded terminal projects, full/sparse/no-session change and verification evidence, both Resume label branches across project types, Project/Session navigation, copy feedback, Today date/counts, partial failures, retry, and identity switch races.
- Full Web test suite and production build; focused desktop/narrow browser flow through Dashboard to Project/Session and Today using an existing/disposable backend as needed. Record conditional skips and runtime limitations honestly.
- Regress existing Today, Todo, Project, AI Session, and identity flows. Inspect `git diff --check`, exact changed/staged files, credentials/private data, and generated artifacts.

## Risks

- The PC app currently shares view-level state in one component; Dashboard requests must not resurrect stale identity or project data.
- Current backend has no stage or automated change-history records. The AI Session's manually entered `modified_files` is available now; present it as recorded context without implying an automatic Git scan. TASK-034 will add stages/timeline.
- The configured user PostgreSQL database must be verified/upgraded through `20261010_0006` by normal startup before real local AI Session/Dashboard demonstration. Task Review may approve this UI slice using disposable backend evidence; do not mutate user data as a gate shortcut.

## Coding Output Requirements

Report changed files, selection and data-loading behavior, navigation/copy flow, timezone handling, independent state/error behavior, tests/build/browser evidence, exact scope/security scans, limitations, and next role.

## Current Stage

Closure Check: PASS

Checked At: 2026-10-11 09:35 +08:00

Result Commit: `b3007633757193ccded94aceffdf21ed05e4b8d1`

Completion Commit: `2ffe578239caff67465161cae0b14420c270d402`

Next Role: Git Commit (Terminal Closure Commit)

Required Next Action: commit and push only the four Closure-authorized documents listed in `tasks/TASK-033-pc-dashboard-resume.md` with message `docs(task): close TASK-033`; verify local/tracking/remote parity and return control to Decision. Do not run another Closure Check or publish TASK-034 here.
