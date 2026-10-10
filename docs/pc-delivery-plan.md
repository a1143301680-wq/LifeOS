# LifeOS PC Delivery Plan

Updated: 2026-10-10

## Direction

Finish the PC Web portion of the V1 MVP before resuming Android delivery. Phase 1A PC Todo and Today are already complete; this plan covers the remaining PC product capabilities. The Android Phase 1A gap remains open and is not counted as complete.

Near-term demonstration path: create a Project/Goal, record an AI Session, and resume the project from a focused Dashboard. Keep every slice independently usable and reviewable.

## Task Order

| Order | Task | Deliverable | Demonstration checkpoint |
| --- | --- | --- | --- |
| 1 | TASK-031 Project/Goal core | Identity-scoped project create/list/detail/edit and PC management views; manual progress, status, next step, and pin state | A real project can be created, updated, and reopened |
| 2 | TASK-032 AI Session records | Structured AI Session create/edit/list on a project, plus a copyable continuation prompt | An AI work session can be saved and resumed |
| 3 | TASK-033 PC Dashboard and Resume | Up to three focused projects, pinned-first selection, latest AI Session, next step, and Today summary | One screen answers what to continue next |
| 4 | TASK-034 Project depth | Editable stages, milestones, Todo links, project logs, unified timeline, and controlled project archive/delete | Project progress has durable history and linked actions |
| 5 | TASK-035 PC Notes | Lightweight notes linked to projects or Todos, with external knowledge links | A note can be captured and found in context |
| 6 | TASK-036 PC Calendar | Month/day aggregation of existing Todos, milestones, logs, and AI Sessions with source navigation | Calendar opens the underlying record |
| 7 | TASK-037 PC acceptance and demo | Cross-module PC regression, two-identity isolation, real local backend flow, responsive/browser checks, demo data and runbook without secrets | The PC MVP can be shown end to end |
| 8 | TASK-038 Android REST bootstrap and reads | Resume authoritative category/Todo reconciliation and Today/Todo reads | Android Phase 1A delivery resumes |

Task IDs after TASK-031 are reserved for sequencing only. Decision publishes each full task after the prior task is terminally closed and may split a row further if Task Review finds it too large. No future task is READY or authorized for Coding by this plan.

## Boundaries

- PC completion means the PC parts of `docs/mvp.md`: Todo/Today, Project/Goal management, Resume Dashboard, basic AI Workspace, lightweight Notes, and Calendar. Android reminders, widgets, offline writes, and cross-client acceptance remain separate unfinished work.
- TASK-030 AI Today planning stays as an optional PC capability. AI Session records are structured context, not automatic import from external chat tools.
- Keep AI suggestions user-confirmed. Do not add autonomous project/Todo writes, Git scanning, full login, or a second calendar event store.
- All user-owned records are resolved from the existing bearer identity. The browser never chooses `user_id`.
- Prioritize TASK-031 through TASK-033 before the next demonstration. TASK-034 through TASK-037 complete the remaining PC MVP depth.

## Exit Evidence

For each task: Task Review PASS, Git Snapshot, Coding, Code Review PASS, Git Commit with remote parity, Decision Closure Check, and terminal Closure Commit. TASK-037 additionally checks a real local PC path across projects, AI Sessions, Dashboard, Notes, and Calendar, and records any external-service limitation honestly.

TASK-031 result commit `79be962` is published and Decision Closure Check passed on 2026-10-10. Its terminal Closure Commit is pending; TASK-032 has not been published. The configured local PostgreSQL database remains at migration `20260713_0004` and must reach `20261009_0005` through the normal startup/deployment migration before Project endpoints are demonstrated there.
