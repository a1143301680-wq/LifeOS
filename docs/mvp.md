# LifeOS MVP Plan

Version: V1 draft
Date: 2026-07-10

## 1. MVP Principle

Build the smallest useful LifeOS loop first:

> Two users can separately manage Todos and see changes sync between PC Web and Android before advanced reminder behavior is added.

The product should grow from a working daily-use loop, not from a complete module list.

## 2. Confirmed V1 MVP Scope

Must include:

- PC Dashboard
- Android Todo Home
- Projects/Goals
- Resume Progress / Resume Development
- Todo
- Normal reminder
- Strong reminder
- Self-hosted sync
- Android widgets: 2 widgets
- AI Workspace basic structured records
- Lightweight Notes
- Lightweight Calendar aggregation

Keep Calendar and Notes small in V1.

## 3. Phase 1: Todo + Reminder + Sync

Goal:

> Build Todo + identity separation + cross-device sync first, then add reminders in gated steps.

Data model:

- See `docs/data-model-phase1.md`.

Phase 1 is split into smaller delivery gates:

- Phase 1A: Todo CRUD + two-user isolation + PC/Android sync
- Phase 1B: Normal reminder scheduling and notification
- Phase 1C: Strong reminder full-screen prototype and Android permission validation
- Phase 1D: Recurring Todo template and 7-day instance generation
- Phase 1E: Limited Android offline queue and conflict handling

Do not treat strong reminder reliability as a Phase 1A requirement.

### Phase 1A: Todo CRUD + Sync

Goal:

> Me and partner can each select identity, create Todo on PC or Android, complete it on either side, and see the other side refresh through sync.

Backend:

- FastAPI project setup
- PostgreSQL connection
- Database migrations
- User seed: `me`, `partner`
- Per-identity bootstrap token
- Todo category API
- Todo API
- Today Todo aggregation API
- Lightweight sync change log
- SSE endpoint
- Change event fanout after writes

PC Web:

- React + Vite setup
- Identity selection
- Todo list
- Today Todo view
- Category management
- Create/edit/complete Todo
- SSE refresh

Android:

- Kotlin project setup
- Identity selection
- Local cache
- Today Todo home
- Quick add Todo
- Create/edit/complete Todo
- Basic sync pull/push

Acceptance criteria:

- A Todo created on PC appears on Android after sync.
- A Todo completed on Android updates on PC after SSE refresh.
- Today Todo API returns planned, due, and reminder-related items without duplicates.
- `me` and `partner` data do not mix.
- Requests require the selected identity token, not only a visible `user_id`.

### Phase 1B: Normal Reminder

Goal:

> Android can schedule and display normal reminders based on server-synced Reminder records.

- Reminder API
- Android local scheduling
- Normal reminder notification
- Complete from reminder
- A normal reminder appears as a notification.

Acceptance criteria:

- Normal reminder appears at the expected local time.
- Completing a Todo cancels its pending normal reminders.
- Completing from notification syncs back to PC.

### Phase 1C: Strong Reminder Prototype

Goal:

> Validate strong reminder feasibility on the target Android device before treating it as reliable product behavior.

- Strong reminder full-screen UI
- Lock-screen full-screen setting
- Required permission guidance
- Default ringtone
- Optional system ringtone
- Snooze: 5/10/30/60 minutes
- Ignore
- Complete from strong reminder

Acceptance criteria:

- Strong reminder can open full-screen on the target device when permissions are granted.
- Strong reminder actions work: complete, snooze, ignore.
- If device/OS restrictions block full-screen behavior, the limitation is documented before continuing.

### Phase 1D: Recurring Todo

Goal:

> Recurring templates generate Todo instances without duplicates.

- Recurring Todo template API
- Generate recurring instances for next 7 days
- Idempotent generation
- Rule-change behavior for future pending instances

Acceptance criteria:

- Recurring Todo generates upcoming 7-day instances.
- Re-running generation does not create duplicates.
- Changing a rule regenerates future pending instances without changing completed history.

### Phase 1E: Limited Android Offline

Goal:

> Android can queue simple offline operations and sync them safely when online.

- Offline add Todo
- Offline complete Todo
- Pending operation queue
- Idempotent operation replay
- Basic conflict handling

Acceptance criteria:

- Android can add and complete Todo while offline.
- Pending operations sync after reconnect.
- Replaying the same operation does not duplicate server changes.

## 4. Phase 2: Projects/Goals + Resume

Goal:

> Users can create long-running Projects/Goals, track current state, define next steps, and see up to 3 focused items on Dashboard.

### Features

- Project/Goal CRUD
- Type selection
- Status
- Editable stage templates
- Manual progress
- Milestones
- Next step
- Pin focused Projects/Goals
- Dashboard focused section
- Link Todo to Project/Goal
- Unified project timeline foundation

### Acceptance Criteria

- PC Dashboard shows up to 3 focused Projects/Goals.
- User-pinned items override automatic selection.
- Development type uses Continue Development wording.
- Other types use Continue Progress wording.
- Project/Goal can link related Todo.

## 5. Phase 3: AI Workspace Basic

Goal:

> AI development sessions can be recorded so the user knows where to continue next time.

### Features

- AI Session create/edit/list
- Link AI Session to Project/Goal
- Structured fields:
  - Goal
  - Completed work
  - Modified files
  - Verification result
  - Remaining issues
  - Next step
  - Recommended next prompt
  - AI tool
  - Start/end time
  - User note
- Prompt templates
- Copy next prompt
- Show latest AI Session on Project/Goal detail

### Acceptance Criteria

- User can record an AI Session manually.
- User can copy a generated continuation prompt.
- Project/Goal page shows latest AI Session summary.
- AI Session appears in Project/Goal timeline.

## 6. Phase 4: Notes + Calendar Lightweight

Goal:

> Capture quick thoughts and review time-based state without creating a second knowledge base or calendar system.

### Notes

- Quick Note
- Link to Project/Goal
- Link to Todo
- Store external knowledge base link

### Calendar

- Month/week/day basic views may be phased
- Show Todo, reminders, milestones, logs, AI Sessions
- Open source object from Calendar

### Acceptance Criteria

- Notes can be created quickly on Android.
- Notes sync to PC.
- Calendar displays aggregated items from existing modules.
- Calendar does not create separate event data in V1.

## 7. Phase 5: Android Widgets

Goal:

> Android provides fast glance and action surfaces.

### Widgets

- Today Todo widget
- Continue Progress widget

### Acceptance Criteria

- Today Todo widget shows today's tasks.
- User can complete a Todo from widget where Android permits.
- Continue Progress widget shows current Project/Goal and next step.
- Tapping widgets opens the relevant app screen.

## 8. Deferred Features

Deferred beyond MVP:

- Multi-user collaboration
- Full login/account system
- Git auto sync
- Local Git diff scanning
- AI automatic conversation import
- GitHub integration
- MCP integration
- Full statistics dashboard
- AI automatic Todo generation
- Full knowledge base integration
- Extra Android widgets
- Pomodoro
- Pet-specific standalone module
- PC browser notifications
