# LifeOS Task Review Gate

Last updated: 2026-08-04

## Gate Status

Result: PASS

Target Status: READY

Reviewed by: Task Review window

Reviewed at: 2026-08-11 22:04 +08:00

Reviewed task: TASK-023 PC Web Todo core edit vertical slice

## Required Review

- [x] Goal, scope, exclusions, dependencies, and allowed files form one closeable slice.
- [x] PATCH fields, Inbox/category semantics, plain-date clearing, and forbidden fields are unambiguous.
- [x] Idempotency, stale category/Todo recovery, category-load retry, and server refresh are testable.
- [x] Focus, accessibility, responsive behavior, error states, and safe live-write cleanup are explicit.
- [x] Branch, HEAD, worktree, staged changes, whitespace, dependencies, and Git Snapshot readiness are persisted.

## Issues

No blocking issues.

## Review Evidence

- Reviewed task: TASK-023 PC Web Todo core edit vertical slice
- Reviewed at: 2026-08-11 22:04 +08:00
- Branch: `main`
- HEAD: `275f4a23ae2f8010173bc72ed14110420909aa62`
- Dependency evidence:
  - Todo update API commit `09cd984` is an ancestor of HEAD.
  - Todo list API commit `dd0d6fa` is an ancestor of HEAD.
  - Today API commit `2a698f3` is an ancestor of HEAD.
  - TASK-022 terminal closure commit `275f4a2` is HEAD and `origin/main`.
  - Existing PC Web identity, Today, Todos, categories, and Todo quick-create surfaces are present under `web/`.
- Worktree Summary:
  - ` M docs/phase1a-progress.md`
  - ` M handoff/code-review-gate.md`
  - ` M handoff/current-task.md`
  - ` M handoff/git-commit.md`
  - ` M handoff/git-snapshot.md`
  - ` M handoff/project-state.md`
  - ` M handoff/task-review-gate.md`
  - `?? tasks/TASK-023-pc-web-todo-core-edit.md`
- Changed Files:
  - `docs/phase1a-progress.md`
  - `handoff/code-review-gate.md`
  - `handoff/current-task.md`
  - `handoff/git-commit.md`
  - `handoff/git-snapshot.md`
  - `handoff/project-state.md`
  - `handoff/task-review-gate.md`
  - `tasks/TASK-023-pc-web-todo-core-edit.md`
- Staged Changes: None
- `git diff --check`: exit 0; only LF-to-CRLF working-copy warnings were reported.
- `git diff --cached --check`: exit 0.
- Independent new-file whitespace check:
  - `tasks/TASK-023-pc-web-todo-core-edit.md`: no trailing whitespace; final line is not blank.
  - `git diff --no-index --check NUL tasks/TASK-023-pc-web-todo-core-edit.md` emitted no whitespace diagnostics; exit 1 is the expected no-index difference status.
- Issue-log search: no unresolved TASK-023 blocker found. The only PATCH-related hit was verified historical `ISSUE-20260711-004` for Todo Category update null fields.
- Local service state:
  - `postgresql-x64-18` is `Stopped`.
  - `127.0.0.1:8000` is not listening.
  - `127.0.0.1:5173` is not listening.
  - Coding must start required services and use disposable data plus cleanup before claiming authenticated live Todo update success, or record the exact environment limitation.
- Ignored artifacts observed: `web/dist/`, `web/node_modules/`, `web/test-results/`, backend `.pytest_cache/`, and `web/*.tsbuildinfo` are ignored and not part of the commitable changed-file set.
- Secret/artifact check: task diff contains no raw identity token, `.env` secret, generated output, dependency directory, log, cache, or editor-local file. The only token reference is the documented `localStorage` key name.
- Git Snapshot readiness: READY. The current eight commitable changes are TASK-023 publication and active workflow-state files only; no staged files, business implementation changes, backend changes, stable product/API/architecture/data-model changes, note/due-time input, Todo status/delete/filter/pagination/detail work, SSE/sync/offline/PWA/Android work, secrets, dependency directories, build output, logs, or caches are included.

## Task Review Notes

- TASK-023 is a single closeable PC Web frontend slice: add core-field Todo edit from Today and Todos, submit `PATCH /api/v1/todos/{id}`, handle draft/error/idempotency states, and refresh already-loaded Todo datasets from the server.
- The frontend task intentionally narrows the broader backend update contract: send only `title`, `category_id`, `priority`, and `planned_date`; never send `note`, `due_at`, `status`, `completed_at`, `deleted_at`, `version`, `user_id`, timestamps, or other system fields.
- Backend references confirm PATCH requires bearer auth and UUID `Idempotency-Key`, rejects missing/cross-user Todo as `404 not_found`, rejects deleted Todo as `410 deleted_resource`, rejects missing/cross-user category as `404 not_found`, rejects deleted category as `410 deleted_resource`, stores `todo.updated`, increments version, and persists Todo, sync change, and idempotency response in one transaction.
- Inbox/category semantics are explicit enough for implementation: unlike create, editing to Inbox sends the active Inbox category UUID; `category_id` omission preserves the old category; deleted or unavailable categories are not selectable.
- Plain date behavior is sufficiently specified: preserve `YYYY-MM-DD` unchanged and send `planned_date: null` when clearing the planned date.
- Retry boundaries are explicit enough for tests: unchanged recoverable retry reuses the UUID idempotency key; changing any submitted field, cancel/reopen, or a new draft starts a new logical attempt.
- Verification is executable with existing frontend scripts: `npm test`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=high`.
- Scope excludes backend, stable product/API/architecture/data-model docs, note/due-time input, complete/reopen/cancel/delete/filter/pagination/detail behavior, SSE/sync/offline/PWA/Android work, raw tokens, `.env` secrets, generated output, dependency directories, logs, caches, editor files, and completed TASK-005 through TASK-022 archives.

## Instructions

On PASS, update both `handoff/current-task.md` and `tasks/TASK-023-pc-web-todo-core-edit.md` to `Status: READY`. On REJECT, keep or set both to `Status: PLANNED`. Persist all evidence required by `docs/workflow.md`; do not start Coding.
