# LifeOS Phase 1A Progress Tracker

Last updated: 2026-09-10

Purpose: give the Decision window a concrete progress map so tasks are selected from Phase 1A scope, not from memory or impulse.

## Status Values

- `done`: implemented, reviewed, and published.
- `partial`: foundation exists, but endpoint or behavior is incomplete.
- `next`: recommended next task.
- `pending`: not started.
- `blocked`: waiting on a required decision or external setup.
- `deferred`: intentionally out of the current slice.

## Backend Foundation

| Capability | Status | Evidence / Notes |
| --- | --- | --- |
| FastAPI app skeleton | done | Commit `6a85b4a` |
| PostgreSQL/Alembic foundation | done | Commits `6a85b4a`, `6eea5e8` |
| `users` model/migration | done | Commit `6a85b4a` |
| Argon2id bearer token auth | done | `GET /api/v1/me` tests |
| Response/error envelope | done | Backend tests passing |
| `idempotency_keys` model | done | Commit `6a85b4a` |
| Idempotency execution boundary | done | Reused across all current Todo/category write endpoints |
| `sync_changes` model/helper | done | PostgreSQL sequence verified in `ISSUE-20260711-001` |
| Default Todo category seeding | done | Published in `d1c0dbf`; Code Review PASS; 38 backend tests passed |
| SSE fanout foundation | done | Published in `b4a2c1e`; Code Review PASS; 101 backend tests passed |

## Phase 1A Endpoint Progress

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /api/v1/me` | done | Implemented, tested, published |
| `GET /api/v1/todo-categories` | done | Implemented, tested, published in `52a701f` |
| `POST /api/v1/todo-categories` | done | Implemented, tested, and protected by DB-level active-name uniqueness |
| `PATCH /api/v1/todo-categories/{id}` | done | Implemented, tested, reviewed, and published in `83ac3eb` |
| `DELETE /api/v1/todo-categories/{id}` | done | Implemented, tested, reviewed, and published in `83ac3eb` |
| `GET /api/v1/todos` | done | Published in `dd0d6fa`; Code Review PASS; 83 backend tests passed |
| `GET /api/v1/todos/today` | done | Published in `2a698f3`; Code Review PASS; 88 backend tests passed |
| `POST /api/v1/todos` | done | Published in `f2fe55e`; Code Review PASS; 47 backend tests passed; live PostgreSQL verification deferred |
| `GET /api/v1/todos/{id}` | done | Published in `deb240b`; Code Review PASS; 54 backend tests passed |
| `PATCH /api/v1/todos/{id}` | done | Published in `09cd984`; Code Review PASS; 62 backend tests passed |
| `POST /api/v1/todos/{id}/complete` | done | Published in `2c35f1d`; Code Review PASS; 67 backend tests passed |
| `POST /api/v1/todos/{id}/reopen` | done | Published in `c2d167f`; Code Review PASS; 72 backend tests passed |
| `DELETE /api/v1/todos/{id}` | done | Published in `3a97402`; Code Review PASS; 78 backend tests passed |
| `GET /api/v1/sync/changes` | done | Published in `f6f9091`; Code Review PASS; 94 backend tests passed |
| `GET /api/v1/sync/events` | done | Published in `b4a2c1e`; Code Review PASS; process-local post-commit fanout |

## Open Issues That Affect Sequencing

| Issue | Status | Decision |
| --- | --- | --- |
| `ISSUE-20260711-001` PostgreSQL sync cursor verification | verified | Closed for sequencing |
| `ISSUE-20260711-002` DB-level active category name uniqueness | verified | Closed for sequencing |

## Platform Completion

| Platform | Status | Evidence / Notes |
| --- | --- | --- |
| Phase 1A backend | done | All contracted endpoints published; 101 backend tests pass |
| PC Web | done | Phase 1A scope closed through TASK-025 terminal closure `b2d0197`; 107 tests, build, two Playwright flows, and high-severity audit gate passed |
| Android | next | TASK-027 toolchain and runnable Compose foundation is `PLANNED`; no Android project or SDK existed at publication baseline |
| PC/Android end-to-end sync acceptance | pending | Requires both clients |

## Recommended Task Order

1. Review and deliver TASK-027 Android toolchain and runnable Compose foundation.
2. Add Android identity validation and token persistence.
3. Add identity-scoped local cache, sync pull, and Today/Todo reads.
4. Add Android quick add, edit, and complete writes.
5. Run PC/Android end-to-end Phase 1A acceptance.

## Decision Rule

When choosing the next Coding window task:

- Prefer closing open P1/P2 issues before adding more endpoints.
- Prefer small vertical slices that exercise auth, idempotency, sync, and tests.
- Do not start Reminder, Recurring Todo, Strong Reminder, Android offline replay, or full login work during Phase 1A.

Audit verdict: the Phase 1A backend and PC Web are complete, but Phase 1A overall remains incomplete until Android and PC/Android end-to-end sync acceptance are delivered. See `docs/phase1a-completion-audit.md`.
