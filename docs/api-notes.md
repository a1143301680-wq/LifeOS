# LifeOS PC Notes Contract

Decision date: 2026-11-20
Delivery task: TASK-039
Status: implemented in TASK-039 and awaiting Code Review

## Data

- Add owner-scoped notes with UUID id, user_id, title, nullable content, nullable project_id, nullable todo_id, nullable external_url, positive version, server created_at/updated_at and nullable deleted_at. A note can have neither, either, or both associations. The Project and Todo need only share the note's owner. They need no existing Project-Todo link.
- Trim text before validation. Title is required, 1-200 Unicode code points. Content is plain text, at most 10,000 code points; null or all whitespace becomes null. External URL is optional, trimmed, at most 2048 characters, and must be an absolute HTTP(S) URL with a host and without embedded credentials. Blank becomes null. Validate URLs locally and open them only on explicit user interaction, using safe external-link attributes.
- Validate each new or changed non-null association against a current same-owner record. Archived Projects are eligible. Missing, foreign, and soft-deleted targets all return 404 not_found when assigning an association. Existing associations remain stored if targets are subsequently soft-deleted. An unchanged association can be retained during edits, or explicitly cleared or replaced.
- Resolve every displayed association against the current owner and target state. Return a reference object with id, label, and available for each stored association. Available labels are the current Project name or Todo title. Unavailable references have available=false and label=null. Unset associations return null. No target content is copied into Notes.
- Use Project/Todo foreign keys with ON DELETE SET NULL for physical deletion and owner FK with ON DELETE CASCADE. Soft deletion of a target preserves the note and its reference. Note writes leave source rows, versions, timestamps and sync cursors untouched.
- Migration 20261120_0012 follows 20261109_0011. Upgrade creates empty Notes storage and indexes. Downgrade removes Notes data and schema; use disposable PostgreSQL to verify the round trip and preservation of existing records.

## API

Base route: /api/v1/notes. Resolve identity from the bearer token. Missing/invalid bearer is 401; missing or foreign Notes and fresh requests for deleted Notes are 404 not_found.

| Method | Request | Success |
| --- | --- | --- |
| GET /notes | Optional project_id, todo_id, limit (default 20, range 1-100), cursor | 200 list envelope |
| POST /notes | Required title; optional content, project_id, todo_id, external_url, each defaulting to null | 201 data envelope with Note |
| GET /notes/{note_id} | Owned active note | 200 data envelope with Note |
| PATCH /notes/{note_id} | At least one of title, content, project_id, todo_id, external_url | 200 data envelope with Note |
| DELETE /notes/{note_id} | Empty body | 200 data envelope with id, deleted=true, deleted_at, version |

- Note responses contain id, title, content, project, todo, external_url, version, created_at and updated_at. The project and todo fields use the reference shape defined above.
- Reject malformed UUIDs, unknown write fields, invalid lengths/URLs, explicit null title, empty PATCH, and DELETE with nonempty body as 400 validation_error. Omitted PATCH fields preserve their values. Explicit null clears optional fields. Use existing error and response envelopes.
- Every write requires Idempotency-Key and uses the existing replay/conflict behavior. Exact replay returns the recorded status/body, including DELETE. A fresh write against a deleted note returns 404. Store the successful response atomically with the write. Lock the owned note for PATCH/DELETE. New notes start at version 1; effective updates and soft deletes bump once and set updated_at; normalized no-ops preserve version and timestamps.
- List only active notes for the caller. Supplied project_id and todo_id filter on stored associations and combine with AND. A well-formed filter with no owned matches returns an empty list, including a foreign ID. Filtering by a retained unavailable association can still return the caller's note with its unavailable reference.
- Order by updated_at DESC, id ASC. Use bounded keyset pagination with an opaque versioned cursor bound to the authenticated owner and both filters. Use the last returned row as the anchor and return next_cursor only if another row exists. Invalid or mismatched cursors return 400. This is a live list; Refresh starts over.

## PC Workflow

- Add Notes navigation with a paginated list, detail, and forms for create/edit/delete. Require explicit confirmation for delete. Keep unsaved inputs and reuse the key for an unchanged ambiguous retry; guard double submission and stale identity/filter results. After success, refresh canonical data.
- Provide paginated Notes filters and association pickers using existing owned Project and Todo APIs. Include active and archived Projects and all non-deleted Todo statuses. Preserve linked choices outside currently loaded pages and support clearing either independently.
- Project detail and the existing PC Todo detail/editor entry points provide a Notes action that opens the list prefiltered to that specific source. Notes opened from context can create a draft with that association preselected. Provide a way back to the original view and allow clearing the list filter. Preserve the source's existing edit/save behavior.
- Show unavailable references without a source action. Use the existing identity-expiry flow, separate empty/error/loading states, and verify desktop and narrow layouts.
- Scope is plain-text PC Notes with one optional external URL per note. Folders, backlinks, Markdown editor, external content fetching/search, Android Notes/sync, Calendar and AI changes are deferred.
