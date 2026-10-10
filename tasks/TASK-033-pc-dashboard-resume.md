# TASK-033: PC Dashboard and Resume

Status: READY

Priority: P1

Parent: PC V1 MVP completion

Published by: Decision window

Published at: 2026-10-11

## Dependencies

- TASK-031 Project/Goal core
- TASK-032 terminal Closure Commit `e8e013f5840a95132f605590d63659e854e65744`
- Existing owner-scoped Project and nested AI Session reads, Today summary, PC identity shell, and continuation-prompt composer

## Goal

Give the signed-in PC user one actionable view for deciding what to continue: at most three focused projects with latest AI Session context and a copyable continuation prompt, alongside today's Todo summary.

## Scope Summary

- Dashboard is the signed-in default view; current Today/Todos/Categories/Projects navigation stays available.
- Select up to three owner-scoped projects with pinned-first deterministic ranking.
- Load only focused projects' latest AI Sessions and the current identity-local-day Today summary from existing APIs.
- Provide direct Project/Session/Today navigation, copy feedback, partial failure/retry, identity-race protection, and responsive PC layout.
- Focused and full Web tests, build, browser verification, and exact-scope/security checks.

## Selection And Data Contract

- Pinned projects of any status first, `updated_at DESC, id ASC`, capped at three. Fill remaining slots from unpinned `in_progress`, then `planning`, then `paused`, each sorted `updated_at DESC, id ASC`. Do not auto-select unpinned `completed` or `abandoned`. No duplicates; cap always three.
- For each selected project only, call its existing nested AI Session list; first item under `started_at DESC, id ASC` is latest. Do not query every project or invent stage/history fields. If no Session exists, show an explicit no-session state and no copy action.
- Display project name/type/status/manual progress/next step and latest session `goal`, `completed_work`, `modified_files`, `verification_result`, `remaining_issues`, `next_step`, and `recommended_next_prompt` when present. Treat `modified_files` as manually recorded change evidence and `verification_result` as recorded verification/current-state evidence, not automatic Git/test inspection. If the session exists but either field is null/blank, show exactly `Modified files not recorded` or `Verification not recorded`. With no session, show `No AI Session yet`, no session-derived fields, and no copy action. Other missing optional content may be omitted; do not invent stage or timeline data.
- The primary Resume action on every focused project is `Continue Development` for `development`; it is `Continue Progress` for `learning`, `life`, `health`, `pet`, and `other`, including when no session exists. This action opens existing Project detail. A separate session action opens the latest AI Session detail when one exists and supports return to Dashboard.
- Today summary uses existing `pending_count`, `completed_count`, and `overdue_count` for the identity's current date in its configured timezone, not the Today view's browsed date. Project, Session, and Today failures remain independent and retryable; stale results cannot cross identities/projects.
- Copy action reuses `composeAISessionPrompt("continue", project, session)` from saved data, with success/failure feedback and no provider/write request. Project/Session/Today actions open existing views, and returning from detail restores Dashboard context.
- Full file routing, boundaries, acceptance criteria, and verification plan are in `handoff/current-task.md`.

## Boundaries

- PC Web only; no backend endpoint, schema, migration, Android, autonomous writes, provider call, external chat import, or change to stable Phase 1A contracts.
- Project stage, logs/timeline, milestones, linked Todos, Notes, and Calendar belong to later slices. Dashboard must not show fabricated stage or change history.
- No browser-supplied `user_id`, cross-identity reuse, secrets, machine paths, private fixtures, or generated output.

## Acceptance Criteria

- [ ] Dashboard is the signed-in default; existing views and actions still work.
- [ ] At most three projects follow exact pinned/status/date/id ranking, including tie and terminal-status cases.
- [ ] Each project shows only its own latest saved AI Session context and has working Project/Session navigation back to Dashboard.
- [ ] Full/sparse/no-session states show saved `modified_files`/`verification_result` or exact missing-value labels without claiming automatic change history.
- [ ] Resume action uses `Continue Development` for development and `Continue Progress` for all other types, with and without a session.
- [ ] Continue prompt copy is deterministic and reports success/failure; no copy action appears without a session.
- [ ] Today counts use the identity's current local day independently of the browsed Today date and navigate to Today.
- [ ] Empty, loading, independent errors/retries, identity races, and desktop/narrow layout work without leakage or overlap.
- [ ] Full Web tests, build, focused browser flow, diff/security/scope checks pass or have exact limitations; no future-module/backend/Android scope breach.

## Verification Plan

- Focused selection and Dashboard component tests for ranking, ties, max-three, full/sparse/no-session change and verification evidence, both Resume label branches, Today date/counts, navigation, clipboard failure, partial errors, retry, and identity switching.
- Full Web suite, production build, and desktop/narrow browser flow; regress Today/Todo/Project/AI Session behavior.
- Inspect exact changed/staged files, `git diff --check`, credentials/private content, and generated artifacts.
- Real configured PostgreSQL needs normal startup migration through `20261010_0006` before a local demo. Use disposable backend verification when needed; do not silently migrate user data for this task.

## Current Stage

Previous Task Review: REJECT at 2026-10-11 00:43 +08:00 because the task omitted `modified_files`/`verification_result` and type-specific Resume labels. Decision then revised both task records for the fresh review recorded below.

Task Review: PASS at 2026-10-11 00:46 +08:00. The revised Resume evidence, missing-value, type-label, and verification contracts close the prior blocker. Full evidence is in `handoff/task-review-gate.md`.

Next Role: Git Snapshot

Required Next Action: Git Snapshot must verify the exact approved eight-file publication/readiness scope and establish the pre-Coding baseline. Do not start Coding until Snapshot completion synchronizes both task records to `IN_PROGRESS`.
