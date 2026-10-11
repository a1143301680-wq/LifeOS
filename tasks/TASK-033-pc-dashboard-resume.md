# TASK-033: PC Dashboard and Resume

Status: COMPLETED

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

- [x] Dashboard is the signed-in default; existing views and actions still work.
- [x] At most three projects follow exact pinned/status/date/id ranking, including tie and terminal-status cases.
- [x] Each project shows only its own latest saved AI Session context and has working Project/Session navigation back to Dashboard.
- [x] Full/sparse/no-session states show saved `modified_files`/`verification_result` or exact missing-value labels without claiming automatic change history.
- [x] Resume action uses `Continue Development` for development and `Continue Progress` for all other types, with and without a session.
- [x] Continue prompt copy is deterministic and reports success/failure; no copy action appears without a session.
- [x] Today counts use the identity's current local day independently of the browsed Today date and navigate to Today.
- [x] Empty, loading, independent errors/retries, identity races, and desktop/narrow layout work without leakage or overlap.
- [x] Full Web tests, build, focused browser flow, diff/security/scope checks pass or have exact limitations; no future-module/backend/Android scope breach.

## Verification Plan

- Focused selection and Dashboard component tests for ranking, ties, max-three, full/sparse/no-session change and verification evidence, both Resume label branches, Today date/counts, navigation, clipboard failure, partial errors, retry, and identity switching.
- Full Web suite, production build, and desktop/narrow browser flow; regress Today/Todo/Project/AI Session behavior.
- Inspect exact changed/staged files, `git diff --check`, credentials/private content, and generated artifacts.
- Real configured PostgreSQL needs normal startup migration through `20261010_0006` before a local demo. Use disposable backend verification when needed; do not silently migrate user data for this task.

## Current Stage

Previous Task Review: REJECT at 2026-10-11 00:43 +08:00 because the task omitted `modified_files`/`verification_result` and type-specific Resume labels. Decision then revised both task records for the fresh review recorded below.

Task Review: PASS at 2026-10-11 00:46 +08:00. The revised Resume evidence, missing-value, type-label, and verification contracts close the prior blocker. Full evidence is in `handoff/task-review-gate.md`.

Git Snapshot: COMPLETE on branch `main`; base commit `e8e013f5840a95132f605590d63659e854e65744`; snapshot commit `172e71e90e0b4b9a8c5618510565df80a79ac34f`.

Snapshot Reason: approved TASK-033 readiness documents required a durable pre-Coding baseline.

Next Role: Decision

Required Next Action: perform the Decision Closure Check using Result Commit `b3007633757193ccded94aceffdf21ed05e4b8d1` and the completion record.

## Coding Result

- Result: PASS; final status: REVIEWING. No stage, commit, or push.
- Modified Files: `web/src/App.tsx`, `web/src/styles.css`, new `web/src/Dashboard.tsx` and `web/src/dashboard-selection.ts`; focused tests in `web/src/Dashboard.test.tsx`, `web/src/dashboard-selection.test.ts`, `web/src/App.dashboard.test.tsx`, and `web/e2e/dashboard.spec.ts`; existing App/AI/Sync/Project/Session and Todo browser tests updated only for the new default navigation; `docs/pc-delivery-plan.md` and active TASK-033 state/record files. The pre-existing `handoff/git-snapshot.md` modification was preserved unchanged.
- Implementation Summary: Dashboard is the signed-in default. It selects up to three projects by pinned-first/status/date/ID order, requests AI Sessions only for those projects, and loads identity-timezone current-day Today summary independently. Saved manual Session context, exact missing-value labels, type-specific Resume actions, local continuation copy, partial retries, 401 handling, and Project/Session/Today navigation are implemented. Returning to Dashboard refetches ranking. No backend, provider, sync write, stage, or timeline feature was added.
- Acceptance Criteria Results: All nine criteria met. Selector ties/overflow/terminal statuses, full/sparse/no-session evidence, all non-development action labels, clipboard success/failure, partial errors, stale request suppression, identity switch, return navigation, timezone date independence, and desktop/narrow overflow are covered by focused automated tests.
- Verification Commands and Results: `npm test` in `web`: 143 passed across 16 files. `npm run build` in `web`: PASS. `npx playwright test`: 8 passed, 2 skipped (existing optional disposable-backend Project and AI Session cases). Focused `npx playwright test e2e/dashboard.spec.ts`: 2 passed at 1280px and 375px. Playwright emitted only `NO_COLOR`/`FORCE_COLOR` environment warnings. No backend test was run because TASK-033 has no backend changes.
- Git Diff Check: `git status --short --untracked-files=all`, `git diff --stat`, tracked diff review, `git diff --check`, and `git diff --cached` completed. Changed files are inside the approved Web/test/progress/state allowlist; `git diff --check` exit 0 with informational LF-to-CRLF warnings, staging empty. Targeted credential/machine-path and new-file trailing-whitespace scans found no matches. No generated output appears in Git status.
- Unresolved Issues: The configured user PostgreSQL database was not modified. Normal startup must verify and upgrade it through `20261010_0006` before a real local AI Session/Dashboard demonstration; the Dashboard browser flow used synthetic API data. The two existing conditional live-backend browser cases remained skipped in the normal suite.
- Task-Outside Findings: None.

## Coding Rework Result (CR-TASK-033-001)

- Result: PASS; final status: REVIEWING. No stage, commit, or push.
- Modified Files In This Rework: `web/e2e/dashboard.spec.ts`, `handoff/current-task.md`, and this task archive only. All prior TASK-033 implementation, snapshot state, Code Review gate, and issue-log evidence were preserved.
- Implementation Summary: Both Dashboard page-heading assertions now use exact accessible-name matching, so the project heading `LifeOS dashboard` cannot collide with the page heading. No product behavior changed.
- Acceptance Criteria Results: The 1280px and 375px Dashboard flows pass in both focused and full browser runs. The Code Review locator finding is addressed for independent re-review.
- Verification Commands And Results: In `D:\LifeOS\web`, `npx playwright test e2e/dashboard.spec.ts` -> 2 passed; `npx playwright test` -> 8 passed, 2 skipped (the existing conditional live-backend Project and AI Session cases), 0 failed. Both emitted only the existing `NO_COLOR`/`FORCE_COLOR` environment warning. Vitest and build were not rerun because this rework changed only two Playwright locators; prior Code Review independently recorded 143 Web tests and build PASS.
- Git Diff Check: `git status --short --untracked-files=all`, `git diff --stat`, `git diff --check`, and `git diff --cached` inspected. All working-tree paths remain inside the approved TASK-033 scope; `git diff --check` exits 0 with informational LF-to-CRLF warnings, and staging is empty. The new browser spec remains untracked as part of the prior TASK-033 implementation; no generated output, secret, or extra implementation file was added by this rework.
- Unresolved Issues: The two optional live-backend browser cases remain skipped; configured PostgreSQL was not modified. Code Review gate remains CHANGES_REQUESTED pending independent re-review.
- Task-Outside Findings: None.

## Code Review Result

- Result: CHANGES_REQUESTED
- Target Status: CHANGES_REQUESTED
- Reviewed by: Code Review window
- Reviewed at: 2026-10-11 09:25 +08:00
- Blocking Issues: `CR-TASK-033-001` (P2). The Dashboard E2E page-heading locator uses substring matching and becomes ambiguous with the `LifeOS dashboard` project heading, causing a timing-dependent 375px failure in the full Playwright suite.
- Implementation Review: no product-contract defect was found in selection, focused Session loading, Today timezone behavior, Resume evidence, navigation/copy, partial errors, or stale-response handling. No scope breach was found.
- Independent Verification: focused Vitest 18 passed; full Web 143 passed; build PASS; full Playwright failed with 7 passed / 2 skipped / 1 failed; immediate focused Dashboard rerun passed 2/2, confirming a flaky locator rather than deterministic browser evidence.
- Git Checks: `git diff --check` and cached check PASS; staging empty; HEAD and `origin/main` remain at Snapshot Commit `172e71e90e0b4b9a8c5618510565df80a79ac34f`.
- Authorization: Git Commit is not allowed. Coding must repair only the persisted blocker and return for re-review.
- Next Role: Coding.

## Code Review Re-review Result

- Result: PASS
- Target Status: COMPLETED
- Reviewed by: Code Review window
- Reviewed at: 2026-10-11 09:30 +08:00
- Blocking Issues: None. `CR-TASK-033-001` is verified closed.
- Rework Review: both Dashboard heading assertions use exact accessible-name matching; no product code or unrelated scope changed.
- Independent Verification: focused Dashboard Playwright 2 passed; complete Playwright 8 passed / 2 documented conditional live-backend tests skipped / 0 failed. The initial review's focused Vitest 18 passed, full Web 143 passed, and production build PASS remain applicable because rework changed only Playwright locators.
- Git Checks: `git diff --check` and cached check PASS; staging empty; HEAD and `origin/main` remain at Snapshot Commit `172e71e90e0b4b9a8c5618510565df80a79ac34f`.
- Residual Risk: the configured user PostgreSQL database still requires normal startup verification/upgrade through `20261010_0006` before a real local AI Session/Dashboard demonstration; the two optional live-backend browser cases remain conditional.
- Recommended Commit Message: `feat(dashboard): add PC Resume dashboard`
- Authorization: Git Commit may commit and push the exact reviewed scope. Keep task status `REVIEWING` until publication succeeds.
- Next Role: Git Commit.

## Git Commit

- Status: COMPLETE
- Result Commit: `b3007633757193ccded94aceffdf21ed05e4b8d1`
- Commit Message: `feat(dashboard): add PC Resume dashboard`
- Push Target: `origin/main`
- Remote Parity: PASS; local HEAD, `origin/main`, and remote `refs/heads/main` matched after push.
- Code Review Re-review: PASS
- Next Role: Decision

## Closure

- Closure Check: PENDING
- Terminal Closure Commit: not authorized until Decision records a PASS and exact closure-file allowlist.
