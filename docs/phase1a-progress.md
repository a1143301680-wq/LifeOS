# LifeOS Phase 1A Progress Tracker

Last updated: 2026-07-11

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
| Idempotency execution boundary | partial | Implemented for category create; needs reuse across future writes |
| `sync_changes` model/helper | done | PostgreSQL sequence verified in `ISSUE-20260711-001` |
| SSE fanout foundation | pending | Not started |

## Phase 1A Endpoint Progress

| Endpoint | Status | Notes |
| --- | --- | --- |
| `GET /api/v1/me` | done | Implemented, tested, published |
| `GET /api/v1/todo-categories` | done | Implemented, tested, published in `52a701f` |
| `POST /api/v1/todo-categories` | done | Implemented, tested, and protected by DB-level active-name uniqueness |
| `PATCH /api/v1/todo-categories/{id}` | pending | Requires category update rules and idempotency |
| `DELETE /api/v1/todo-categories/{id}` | pending | Requires soft delete and Inbox protection |
| `GET /api/v1/todos` | pending | Cursor pagination and filters not started |
| `GET /api/v1/todos/today` | pending | Aggregation not started |
| `POST /api/v1/todos` | pending | Requires `todos` model/migration |
| `GET /api/v1/todos/{id}` | pending | Includes `410 deleted_resource` behavior |
| `PATCH /api/v1/todos/{id}` | pending | Requires forbidden-field validation |
| `POST /api/v1/todos/{id}/complete` | pending | Requires status transition and sync change |
| `POST /api/v1/todos/{id}/reopen` | pending | Requires status transition and sync change |
| `DELETE /api/v1/todos/{id}` | pending | Requires soft delete tombstone |
| `GET /api/v1/sync/changes` | pending | Durable pull recovery endpoint |
| `GET /api/v1/sync/events` | pending | SSE wake-up only |

## Open Issues That Affect Sequencing

| Issue | Status | Decision |
| --- | --- | --- |
| `ISSUE-20260711-001` PostgreSQL sync cursor verification | verified | Closed for sequencing |
| `ISSUE-20260711-002` DB-level active category name uniqueness | verified | Closed for sequencing |

## Recommended Task Order

1. Finish Todo Category CRUD: `PATCH` and `DELETE`.
2. Add `todos` model/migration and `POST /api/v1/todos`.
3. Add Todo detail/update/complete/reopen/delete.
4. Add Todo list cursor pagination and filters.
5. Add Today Todo aggregation.
6. Add `GET /api/v1/sync/changes`.
7. Add `GET /api/v1/sync/events`.

## Decision Rule

When choosing the next Coding window task:

- Prefer closing open P1/P2 issues before adding more endpoints.
- Prefer small vertical slices that exercise auth, idempotency, sync, and tests.
- Do not start Reminder, Recurring Todo, Strong Reminder, Android offline replay, or full login work during Phase 1A.
