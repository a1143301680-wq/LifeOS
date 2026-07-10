# LifeOS Phase 1 Data Model

Version: V1 draft
Date: 2026-07-10

Scope:

- Users
- Todo categories
- Todo
- Reminder
- Recurring Todo
- Reminder events
- SSE sync events
- Android offline sync support

Phase 1A API decisions are documented in:

- `docs/api-phase1a.md`

Phase 1 goal:

> Support two separated users, PC/Android Todo management, Android reminders, recurring tasks, and REST + SSE synchronization.

## 1. Design Rules

### User Isolation

Every user-owned table must include `user_id`.

The backend must always filter by the `user_id` resolved from the bearer token. Clients must not send `user_id` in Phase 1A API requests.

### Soft Delete

Use `deleted_at` for user-facing data that can sync across devices.

Recommended soft-delete tables:

- `todo_categories`
- `todos`
- `reminders`
- `recurring_todo_templates`

Hard delete can be used later for cleanup jobs.

### Timezone

Store timestamps as `timestamptz`.

Store user timezone separately as a user setting. For V1, default timezone can be `Asia/Shanghai`.

### IDs

Use UUID primary keys.

Reason:

- Android can create local pending records offline.
- Server can accept client-generated IDs safely if needed.
- Sync logic is easier than integer-only IDs.

## 2. Enum Values

These can be implemented as PostgreSQL enums or text fields with backend validation. For early development, text plus validation is more migration-friendly.

### User ID

Use UUID as the real `user_id`.

Use a human-readable alias for V1 identity selection:

- `me`
- `partner`

The UI can show "Me" and "Partner", but all relational data should reference the UUID user id.

### Todo Status

- `pending`
- `completed`
- `canceled`

### Todo Priority

- `high`
- `medium`
- `low`

### Reminder Level

- `normal`
- `strong`

### Reminder Status

- `scheduled`
- `fired`
- `snoozed`
- `ignored`
- `completed`
- `canceled`

### Recurrence Frequency

- `daily`
- `weekly`
- `monthly`
- `custom`

### Sync Event Type

Examples:

- `todo.created`
- `todo.updated`
- `todo.completed`
- `todo.deleted`
- `category.updated`
- `reminder.updated`
- `recurrence.updated`
- `sync.refresh`

## 3. Entity Relationship Summary

```text
users
  +-- todo_categories
  +-- todos
  |   +-- reminders
  |   |   +-- reminder_events
  |   +-- recurring_todo_templates
  +-- recurring_todo_templates
  |   +-- todos
  |   +-- reminders
  +-- sync_changes
```

Important relationship:

- `recurring_todo_templates` generates `todos`.
- Users complete generated Todo instances.
- `reminders` belong to Todo instances.
- `reminder_events` record what happened to a reminder.

## 4. Tables

## 4.1 users

Stores the two local identities and future user settings.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes | Stable real user id. |
| alias | text | yes | V1 identity alias, such as `me` or `partner`. |
| display_name | text | yes | Display name in UI. |
| bootstrap_token_hash | text | yes | Argon2id PHC string for the per-identity bootstrap token. |
| timezone | text | yes | Default `Asia/Shanghai`. |
| created_at | timestamptz | yes | Server timestamp. |
| updated_at | timestamptz | yes | Server timestamp. |

Seed rows:

| alias | display_name |
| --- | --- |
| me | Me |
| partner | Partner |

Rules:

- `alias` must be unique.
- API bootstrap can return both users for local identity selection.
- All user-owned tables store `user_id = users.id`, not `alias`.
- The raw bootstrap token must not be stored in plaintext.
- Raw bootstrap tokens are generated from at least 32 bytes of secure random entropy and shown only during initialization or manual rotation.
- Store bootstrap token hashes using Argon2id PHC strings. Initial target parameters: 64 MiB memory cost, time cost 3, parallelism 1.

## 4.1.1 idempotency_keys

Stores write request fingerprints and original responses for idempotent API behavior.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes | Primary key. |
| user_id | uuid | yes | Owner resolved from the bearer token. |
| key | uuid | yes | Value from `Idempotency-Key`. |
| method | text | yes | Uppercase HTTP method. |
| path | text | yes | Normalized API path. |
| request_hash | text | yes | SHA-256 canonical request fingerprint. |
| response_status | integer | yes | Original response status. |
| response_body | jsonb | yes | Original response body. |
| created_at | timestamptz | yes | Server timestamp. |
| expires_at | timestamptz | yes | Retention cutoff. |

Recommended indexes:

- unique `(user_id, key)`
- `(expires_at)`

Rules:

- Applies to every Phase 1A write endpoint.
- Missing `Idempotency-Key` returns `400 idempotency_key_required`.
- Same user, key, and request hash returns the original response.
- Same user and key with a different request hash returns `409 idempotency_key_conflict`.
- Retain records for 7 days.

## 4.2 todo_categories

User-owned category list.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes | Primary key. |
| user_id | uuid | yes | Owner. |
| name | text | yes | Category name. |
| color | text | no | Optional UI color token or hex. |
| icon | text | no | Optional icon key. |
| is_inbox | boolean | yes | Exactly one Inbox per user. |
| sort_order | integer | yes | UI order. |
| created_at | timestamptz | yes | Server timestamp. |
| updated_at | timestamptz | yes | Server timestamp. |
| deleted_at | timestamptz | no | Soft delete. |

Constraints:

- One active Inbox per user.
- Category names should be unique per user among active categories.
- Inbox cannot be deleted.
- Deleting a non-Inbox category is a soft delete.
- Existing Todos keep their `category_id` for historical display.
- New filters should hide deleted categories by default but may show "Deleted category" on historical Todos.

Default categories:

- Inbox
- Work
- Study
- Life
- Partner
- Pet
- Health
- Interest
- AI
- Project

## 4.3 todos

Task instances users act on.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes | Primary key. |
| user_id | uuid | yes | Owner. |
| category_id | uuid | no | Nullable if category deleted; quick add defaults to Inbox. |
| recurring_template_id | uuid | no | Source template if generated. |
| title | text | yes | Main task text. |
| note | text | no | Lightweight detail. |
| status | text | yes | `pending`, `completed`, `canceled`. |
| priority | text | yes | `high`, `medium`, `low`; default `medium`. |
| planned_date | date | no | User planned day. |
| due_at | timestamptz | no | Deadline. |
| completed_at | timestamptz | no | Completion time. |
| canceled_at | timestamptz | no | Cancellation time. |
| generated_for_date | date | no | For recurring instances. |
| source_client_id | text | no | Client/device id for offline-created records. |
| client_created_id | text | no | Optional local id before sync. |
| version | integer | yes | Server mutation version, starts at 1. |
| created_at | timestamptz | yes | Server timestamp. |
| updated_at | timestamptz | yes | Server timestamp. |
| deleted_at | timestamptz | no | Soft delete. |

Rules:

- Todo status does not store reminder state.
- Completing a Todo should cancel pending reminders for that Todo unless a future recurrence instance exists separately.
- `planned_date`, `due_at`, and Reminder `remind_at` are separate concepts.

Recommended indexes:

- `(user_id, status, planned_date)`
- `(user_id, due_at)`
- `(user_id, category_id)`
- `(user_id, updated_at)`
- `(recurring_template_id, generated_for_date)`

## 4.4 reminders

Reminder schedules for Todo instances.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes | Primary key. |
| user_id | uuid | yes | Owner. |
| todo_id | uuid | yes | Target Todo. |
| level | text | yes | `normal` or `strong`. |
| remind_at | timestamptz | yes | Reminder trigger time. |
| status | text | yes | Current reminder state. |
| fired_at | timestamptz | no | Last time this reminder fired. |
| snoozed_until | timestamptz | no | Current snooze target if snoozed. |
| effective_trigger_at | timestamptz | yes | Current trigger time; equals `snoozed_until` when snoozed, otherwise `remind_at`. |
| ringtone_uri | text | no | Optional selected ringtone. |
| vibrate | boolean | yes | Default true for strong reminders. |
| version | integer | yes | Server mutation version, starts at 1. |
| created_at | timestamptz | yes | Server timestamp. |
| updated_at | timestamptz | yes | Server timestamp. |
| deleted_at | timestamptz | no | Soft delete. |

Rules:

- Android schedules reminders locally from this table.
- PC Web can create/edit reminder records, but does not execute reminders.
- Strong reminders must support complete, snooze, and ignore.
- `effective_trigger_at` is the time Android should schedule against.
- Completing or canceling the Todo cancels all active pending reminders for that Todo.

State transitions:

- `scheduled -> fired` when Android displays the reminder.
- `fired -> snoozed` when user chooses snooze; set `snoozed_until` and update `effective_trigger_at`.
- `snoozed -> fired` when the snoozed reminder triggers again.
- `fired -> ignored` when user ignores the reminder; this occurrence ends.
- `fired -> completed` when user completes the Todo from reminder UI.
- `scheduled/snoozed/fired -> canceled` when Todo is completed, canceled, deleted, or the reminder is deleted.

Invalid transitions should be rejected by the backend unless the operation is an idempotent replay.

Recommended indexes:

- `(user_id, todo_id)`
- `(user_id, remind_at)`
- `(user_id, status, effective_trigger_at)`

## 4.5 reminder_events

Append-only reminder action log.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes | Primary key. |
| user_id | uuid | yes | Owner. |
| reminder_id | uuid | yes | Reminder. |
| todo_id | uuid | yes | Redundant for easier queries. |
| event_type | text | yes | `fired`, `snoozed`, `ignored`, `completed`, `canceled`. |
| event_at | timestamptz | yes | When it happened. |
| payload | jsonb | no | Example: snooze minutes, device id. |
| created_at | timestamptz | yes | Server timestamp. |

Rules:

- Ignoring a strong reminder writes an `ignored` event and ends that reminder occurrence.
- Snoozing writes a `snoozed` event and updates Reminder `snoozed_until`.
- Completing from reminder completes the Todo and writes a `completed` event.

Recommended indexes:

- `(user_id, reminder_id, event_at)`
- `(user_id, todo_id, event_at)`

## 4.6 recurring_todo_templates

Template for recurring tasks.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes | Primary key. |
| user_id | uuid | yes | Owner. |
| category_id | uuid | no | Default category for generated Todos. |
| title | text | yes | Todo title template. |
| note | text | no | Default note. |
| priority | text | yes | Default priority. |
| frequency | text | yes | `daily`, `weekly`, `monthly`, `custom`. |
| interval | integer | yes | Every N units; default 1. |
| days_of_week | integer[] | no | For weekly rules; 1-7 or 0-6 must be standardized in implementation. |
| day_of_month | integer | no | For monthly rules. |
| start_date | date | yes | First active date. |
| end_date | date | no | Optional end date. |
| planned_time | time | no | Optional default planned time. |
| due_time | time | no | Optional generated due time. |
| reminder_time | time | no | Optional generated reminder time. |
| reminder_level | text | no | `normal` or `strong`. |
| is_active | boolean | yes | Whether generation continues. |
| last_generated_until | date | no | Tracks generation window. |
| version | integer | yes | Server mutation version, starts at 1. |
| created_at | timestamptz | yes | Server timestamp. |
| updated_at | timestamptz | yes | Server timestamp. |
| deleted_at | timestamptz | no | Soft delete. |

Rules:

- Generate Todo instances for the next 7 days.
- Do not overwrite completed historical instances.
- Rule changes delete and regenerate future pending instances for that template.
- Rule changes do not alter completed, canceled, or ignored historical instances.
- Instance generation is backend-owned and must be idempotent.
- The backend may run a daily scheduled generation job.
- PC Web or Android may call the generation endpoint on startup or sync as a fallback.

Recommended indexes:

- `(user_id, is_active)`
- `(user_id, last_generated_until)`

Required constraints:

- Active generated Todo instances must be unique by `(user_id, recurring_template_id, generated_for_date)` where `deleted_at is null`.
- This uniqueness is required so repeated generation calls cannot create duplicates.

## 4.7 sync_changes

Lightweight durable change log for pull sync recovery.

SSE is only a live refresh signal. `sync_changes` is the source for reconnect and missed-change recovery.

Synchronization uses:

- `sync_changes` cursor for reliable pull recovery
- `updated_at` and `deleted_at` on source tables for query support
- In-memory SSE for live refresh wake-up

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes | Primary key. |
| user_id | uuid | yes | Target user. |
| cursor | bigint | yes | Monotonic server-side cursor. |
| change_type | text | yes | Example `todo.updated`. |
| entity_type | text | yes | Example `todo`. |
| entity_id | uuid | no | Changed entity. |
| entity_version | integer | no | Source entity version after change. |
| payload | jsonb | no | Lightweight metadata only. |
| created_at | timestamptz | yes | Server timestamp. |

Recommended indexes:

- unique `(cursor)`
- `(user_id, created_at)`
- `(user_id, entity_type, entity_id)`

Rules:

- Write `sync_changes` in the same transaction as the entity change.
- Clients call `GET /api/v1/sync/changes?cursor=...`.
- Response returns ordered changes plus `next_cursor`.
- Clients must not use local time as a cursor.
- Deleted entities must be represented by tombstone changes.
- Tombstones should be retained long enough for inactive devices to recover deletions.

## 5. Android Local Data

Android should keep a local cache for Todo and Reminder.

Use Room as the local database.

Use DataStore for selected identity, settings, and small preferences.

Use WorkManager for background sync and retrying pending operations.

Recommended local tables mirror server tables for Phase 1:

- `local_todos`
- `local_reminders`
- `local_categories`
- `pending_operations`

## 5.1 pending_operations

Stores offline writes before server sync.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | uuid | yes | Local operation id. |
| user_id | uuid | yes | Owner. |
| client_operation_id | uuid | yes | Stable idempotency key sent to server. |
| device_id | text | yes | Stable Android install/device id. |
| operation_type | text | yes | `create`, `update`, `complete`, `delete`. |
| entity_type | text | yes | `todo`, `reminder`, etc. |
| entity_id | uuid | no | Server/client entity id. |
| base_version | integer | no | Server entity version seen before local edit. |
| base_updated_at | datetime | no | Server timestamp seen before local edit. |
| payload | json | yes | Operation payload. |
| created_at | datetime | yes | Local timestamp. |
| synced_at | datetime | no | Filled after success. |
| server_ack_cursor | bigint | no | Sync cursor returned after successful replay. |
| retry_count | integer | yes | Default 0. |
| last_error | text | no | Debug info. |

Rules:

- Android can create and complete Todo offline.
- Android can add quick Note offline later, but Note is not Phase 1 core.
- On reconnect, operations are replayed in creation order.
- Server APIs that mutate data should accept `client_operation_id` for idempotency.
- Replaying the same `client_operation_id` must return the original successful result or a safe no-op.

## 6. API Shape

Phase 1A REST endpoints are defined in `docs/api-phase1a.md`.

The endpoint list below is only a phase overview. Do not implement Phase 1B+ endpoints during Phase 1A.

Phase 1A endpoints:

```text
GET    /api/v1/me
GET    /api/v1/todo-categories
POST   /api/v1/todo-categories
PATCH  /api/v1/todo-categories/{id}
DELETE /api/v1/todo-categories/{id}
GET    /api/v1/todos
GET    /api/v1/todos/today
POST   /api/v1/todos
GET    /api/v1/todos/{id}
PATCH  /api/v1/todos/{id}
POST   /api/v1/todos/{id}/complete
POST   /api/v1/todos/{id}/reopen
DELETE /api/v1/todos/{id}
GET    /api/v1/sync/changes
GET    /api/v1/sync/events
```

Today Todo API rules:

- Uses the user's timezone.
- Includes Todos planned for the date.
- Includes Todos due during the date.
- Includes Todos with Reminder effective trigger time during the date.
- De-duplicates by Todo id.
- Returns enough Reminder summary data for Android to schedule or display the item.

## 7. SSE Contract

SSE endpoint:

```text
GET /api/v1/sync/events
```

Client sends:

- `Authorization: Bearer <identity_token>`
- optional `device_id`

Event format:

```json
{
  "type": "sync.available",
  "latest_cursor": 128,
  "server_time": "2026-07-10T20:00:00+08:00"
}
```

Client behavior:

- Receive event.
- Decide affected query.
- Re-fetch through REST.
- Update local cache.
- On reconnect or app launch, call `GET /api/v1/sync/changes?cursor=...` to recover missed changes.

## 8. Next Implementation Planning

The Phase 1A API decisions are closed enough to continue. Next implementation planning should define concrete code artifacts:

- Backend API request and response DTOs
- Database migration SQL or ORM models
- Android Room entities
- PC Web page structure
