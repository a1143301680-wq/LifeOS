# LifeOS Code Review Gate

Last updated: 2026-10-15

## Gate Status

Result: PASS

Target Status: COMPLETED

Reviewed by: Code Review window

Reviewed at: 2026-10-15 09:57:58 +08:00

Reviewed task: TASK-036 PC Project/Goal Todo links

Branch: main

HEAD: 39872aa423abfa03092593797bb5e1f7630f4b89

Snapshot Commit: 39872aa423abfa03092593797bb5e1f7630f4b89

## Review Evidence

- Worktree Summary: 18 tracked modified files and 12 untracked files after Code Review persistence, including this gate, for an exact 30-file reviewed publish scope. Staging is empty.
- Contract: `docs/api-project-todo-links.md` many-to-many storage, source projection, unavailable placeholders, whole-list PUT, pagination, idempotency, locking, no-Todo-mutation, and PC source-detail rules were checked against implementation and tests.
- Backend: GET/PUT are owner-scoped; new links require active owned Todos; retained unavailable links survive reorder/removal; Todo rows lock in deterministic UUID order after the shared Project lock; effective writes update only links and the parent Project once.
- Source/sync integrity: tests compare complete Todo rows, sync rows, and cursor sequence before/after association writes. Unlink removes only the association, and source edits/deletion alter later projections without bumping the Project.
- Migration: `20261015_0009` follows `20261014_0008`, creates an empty constrained association table, has downgrade support, and is verified on disposable PostgreSQL for legacy-data/cursor preservation, repeated head, downgrade/re-upgrade, API persistence, constraints, four-way Project locking, and both link/delete serial outcomes.
- PC: all-status opaque cursor paging, deduplication, off-page/unavailable selection retention, 50-item bound, reorder/remove, Save/Cancel, retry keys, refresh-only readback failures, source GET-only detail, focus return, and identity/Project stale-response suppression are implemented and covered.
- Scope: no Todo model/write/sync change, reverse-project UI, progress inference, stage/milestone change, Dashboard/Calendar integration, Android, AI/provider/prompt change, dependency churn, old migration rewrite, or completed-archive edit was introduced.
- Security/artifacts: targeted scans found only existing environment-variable reads, runtime variable names, and synthetic test tokens. No credentials, private fixtures, databases, screenshots, caches, generated output, or debug code appear in Git status.
- `D:\LifeOS\backend`: `python -m pytest tests/test_project_todo_links.py -q --tb=short` -> 12 passed in 2.42s.
- `D:\LifeOS\backend`: `$env:LIFEOS_TEST_PG_BIN='D:\PostgreSQL\18\bin'; python -m pytest tests/test_project_todo_link_migration.py -q --tb=short` -> 1 passed in 9.18s.
- `D:\LifeOS\backend`: with the same PostgreSQL-bin environment, `python -m pytest -q` -> 186 passed in 41.79s.
- `D:\LifeOS\backend`: `python -m alembic heads` -> `20261015_0009 (head)`.
- `D:\LifeOS\web`: `npm test -- --run src/ProjectTodoLinks.test.tsx src/ProjectTodoDetail.test.tsx` -> 2 files / 21 passed.
- `D:\LifeOS\web`: `npm test -- --run` -> 20 files / 180 passed.
- `D:\LifeOS\web`: `npm run build` -> PASS.
- `D:\LifeOS\web`: `npx playwright test` -> 14 passed, 2 existing conditional live-backend cases skipped; only the existing `NO_COLOR`/`FORCE_COLOR` warning appeared.
- Desktop 1280px and narrow 375px editor/saved-list screenshots were inspected; controls fit without horizontal overflow or incoherent overlap.
- `git diff --check`: PASS with informational LF-to-CRLF warnings only. `git diff --cached --check`: PASS; staging is empty.

## Checks

- [x] Existing/new Projects have no inferred links; the same owned Todo may be linked to multiple Projects without source copying or mutation.
- [x] Migration and constraints preserve Project/stage/milestone/Session/Todo/user/sync data and cursor state on disposable PostgreSQL.
- [x] GET/PUT enforce auth, ownership, exact UUID/field/bound rules, ordering, unavailable retention, and atomic rollback.
- [x] Link/reorder/unlink/clear/relink and current source projection work without Todo or sync mutation.
- [x] Replay/conflict/no-op, parent version/timestamp, shared Project locking, and Todo-delete serialization match the contract.
- [x] PC candidate pagination, off-page selection, Save/Cancel, retries, readback recovery, and stale-context suppression are covered.
- [x] Source detail uses only Todo GET, handles 401/404/410/network states, refreshes current data, and restores Project focus.
- [x] Project, stages, milestones, AI Sessions, Dashboard/Resume, Today/Todo, identity, and sync regressions pass without scope expansion.
- [x] Both active task records remain `REVIEWING`; Code Review did not stage, commit, or push.

## Blocking Issues

None.

## Non-blocking Suggestions

- The configured user PostgreSQL database is known only through revision `20261014_0008`; normal startup/deployment must apply `20261015_0009` before link use.
- Link Playwright flows use API stubs. Real persistence, migration, locking, source deletion serialization, and sync integrity are separately verified through FastAPI TestClient against disposable PostgreSQL.
- Two existing optional live-backend browser cases remain conditionally skipped. Pre-existing PostgreSQL service processes are running on the host with details unavailable to this window; they were not altered, and no disposable database artifacts entered the repository.

## Follow-up Tasks

None required for TASK-036 publication. Project logs/timeline, lifecycle, Notes, Calendar/Dashboard integration, Android, and AI memory/Agent work remain deferred.

## Reviewed Scope

- `backend/alembic/versions/20261015_0009_add_project_todo_links.py`
- `backend/app/api/v1/project_todo_links.py`
- `backend/app/api/v1/router.py`
- `backend/app/models/__init__.py`
- `backend/app/models/project_todo_link.py`
- `backend/app/schemas/project_todo_link.py`
- `backend/app/services/project_todo_links.py`
- `backend/tests/test_project_milestone_migration.py`
- `backend/tests/test_project_todo_link_migration.py`
- `backend/tests/test_project_todo_links.py`
- `docs/api-project-todo-links.md`
- `docs/pc-delivery-plan.md`
- `handoff/code-review-gate.md`
- `handoff/current-task.md`
- `handoff/git-snapshot.md`
- `tasks/TASK-036-pc-project-todo-links.md`
- `web/e2e/ai-sessions.spec.ts`
- `web/e2e/dashboard.spec.ts`
- `web/e2e/project-milestones.spec.ts`
- `web/e2e/project-stages.spec.ts`
- `web/e2e/project-todo-links.spec.ts`
- `web/e2e/projects.spec.ts`
- `web/src/App.tsx`
- `web/src/ProjectTodoDetail.test.tsx`
- `web/src/ProjectTodoDetail.tsx`
- `web/src/ProjectTodoLinks.test.tsx`
- `web/src/ProjectTodoLinks.tsx`
- `web/src/api.ts`
- `web/src/styles.css`
- `web/src/types.ts`

## Recommended Commit Message

`feat(project): link todos to projects`

## Instructions

Git Commit may publish exactly the 30 reviewed TASK-036 files above. Keep both active task records at `REVIEWING` until implementation commit and push succeed, then perform the workflow's terminal status update. Do not include unrelated paths.
