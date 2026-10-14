# LifeOS Project Stages Contract

Decision date: 2026-10-12
Delivery task: TASK-034
Status: implemented; TASK-034 Code Review PASS and terminal Closure Commit 9030c7d published

## Ownership And Storage

- Add a `project_stages` table, following the existing architecture's entity boundary. Each row has UUID `id`, owner `user_id`, parent `project_id`, `name`, integer `sort_order`, boolean `is_current`, and server `created_at` / `updated_at` timestamps.
- User and project foreign keys cascade on parent deletion. Derive owner from the authenticated parent project; never accept an owner or parent in a stage payload.
- Stage IDs are globally unique. A replacement may keep this project's existing IDs or introduce unused UUIDs. Reject IDs already belonging to another project with generic `400 validation_error`; disclose no foreign record.
- Names are trimmed, 1-100 characters; duplicate names are allowed because IDs identify stages. Order is contiguous from 0, at most 20 rows. Store at most one current row per project, enforced by a partial unique index on `project_id WHERE is_current`.
- Stage rows are a child collection, not independently versioned or synchronized in this PC slice. The parent Project version represents effective collection changes. Removal physically deletes the stage row; it does not create a history/completion event.
- No project sync snapshots, SSE events, Android cache contract, or separate stage status/progress is added.

## Default Templates

Use these exact ordered names. They are editable defaults, not a completion history.

| Project type | Default names in order |
| --- | --- |
| development | Requirements; UI design; Development; Testing; Release |
| learning | Planning; Study; Practice; Review |
| life | Planning; Preparation; Action; Review |
| health | Baseline; Plan; Action; Review |
| pet | Assessment; Care plan; Care; Review |
| other | Planning; Action; Review |

- Existing `POST /api/v1/projects` creates these rows with fresh UUIDs in the same transaction as the Project and its idempotency record. Its existing request and response fields remain unchanged.
- New projects start with no current stage. Template generation does not set Project status, progress, or next step.
- Migration backfills each existing project's type-specific defaults with no current stage. Preserve all existing Project fields, versions, timestamps, users, and AI Sessions. Do not infer progress.
- Downgrade removes stage rows and their edits but preserves existing Project/user/AI Session data. A subsequent upgrade seeds defaults again; repeated upgrade at head preserves edits.
- Freeze the mapping inside the migration rather than importing changeable application code.
- Changing Project type later preserves all stage IDs, names, order, and current selection, even when they still match the old defaults.
- A deliberately empty list stays empty. Reads, application restart, and repeated `alembic upgrade head` must not reseed or overwrite user edits. Template reset and global template editing are deferred.

## API

Add only these nested endpoints; keep existing Project/AI Session routes and DTOs compatible.

### GET /api/v1/projects/{project_id}/stages

Return `200` with the existing data envelope:

```json
{
  "data": {
    "stages": [
      {"id": "b6609e5d-d948-4890-8d76-7fc4e0198224", "name": "Requirements", "sort_order": 0}
    ],
    "current_stage_id": null,
    "project_version": 1
  },
  "server_time": "2026-10-12T10:00:00+08:00"
}
```

- Return stages in `sort_order ASC, id ASC` order. Current ID is the single current row or null.
- Empty collections return `stages: []` and a null current ID; GET never writes or seeds.
- Missing/cross-owner parent returns `404 not_found`, including when the collection is empty. Missing/invalid bearer returns `401 unauthorized`.

### PUT /api/v1/projects/{project_id}/stages

Replace the entire ordered collection and current selection atomically:

```json
{
  "stages": [
    {"id": "b6609e5d-d948-4890-8d76-7fc4e0198224", "name": "Requirements"},
    {"id": "c7cc6541-ae8b-4101-a225-5f9a7b99ab75", "name": "Implementation"}
  ],
  "current_stage_id": "c7cc6541-ae8b-4101-a225-5f9a7b99ab75"
}
```

- Both fields are required. `stages` is a non-null array of 0-20 objects containing only required UUID `id` and name. Array position sets `sort_order`; clients cannot write it.
- `current_stage_id` is UUID or null and must refer to a stage in the submitted list when non-null. To remove the current stage, select a retained/new stage or explicitly clear the current selection in this same request. An empty list requires null.
- Reject duplicate IDs, blank/overlong names, malformed UUIDs, unknown fields at either level, omitted fields, null arrays/names/IDs, invalid selection, or foreign-ID collisions with `400 validation_error`. Invalid requests leave rows, current selection, Project version/timestamp, and idempotency storage unchanged.
- Retained IDs survive rename/reorder/current changes; added IDs are client-generated UUIDs; omitted rows are removed. Read timestamps are server-owned.
- Use existing `Idempotency-Key` handling: missing key is `400 idempotency_key_required`; identical replay returns the original `200` envelope without applying again; changed payload under the same key is `409 idempotency_key_conflict`. Existing retention and authenticated replay semantics remain unchanged.
- Successful PUT returns `200` with the GET-shaped data envelope. An identical normalized collection/current choice is a no-op: retain Project version/timestamp. An effective change increments parent version exactly once and updates its timestamp; leave all other Project fields unchanged.
- Serialize collection replacements through the parent Project row, and serialize existing Project PATCH writes where needed so concurrent metadata/stage writes preserve the version counter. This slice retains existing last-write-wins behavior; it adds no `expected_version` field or optimistic conflict contract.
- Apply row changes, single-current selection, parent version/timestamp, and successful idempotency response in one transaction. Roll back on failure. Switching current stages must not transiently violate the partial unique index.
- Missing/cross-owner parent returns `404 not_found`. No independent stage CRUD endpoints or per-stage writes are introduced.

## PC Behavior

- On existing Project detail, fetch the collection for that identity/project. Show ordered names and the current choice; show `No current stage` when unset and `No stages` for an empty list.
- Provide an explicit stage editor for add, rename, remove, move up/down, and current selection (including None). Save submits one PUT; Cancel discards the local draft. New rows get one stable UUID when added, reused on failed-save retry.
- Removing the current row in the draft clears the draft selection; the user may choose another before Save. Do not auto-select the first row.
- Disable duplicate submits; preserve edits on recoverable errors; retry an unchanged ambiguous write with the same key/payload and use a new key for a changed payload, following existing Project editor behavior.
- Fetch/refetch the collection when opening a newly created/reopened project or returning after type edits. Suppress responses after project/identity changes; handle 401 through existing expiration handling. Do not render another project's draft or old response.
- Show independent stage loading/error/retry state without hiding the Project or AI Sessions. Successful save refreshes the displayed collection and parent metadata; returning to Dashboard uses its existing current Project data refresh.
- Keep Dashboard selection, existing AI Session prompt composition, Today/Todo, and Project create/edit contracts unchanged. No stage field is fabricated into their history or prompts.
