# LifeOS Requirements

Version: V1 draft
Date: 2026-07-10

## 1. Product Positioning

LifeOS is a personal life and project operating system for the AI era.

It is not only a Todo app, and it is not a team project management system. Its core purpose is to manage personal life state, long-running goals, project progress, and AI collaboration context.

Core idea:

> Help each user quickly know what matters today, what is in progress, and where to continue next.

## 2. Target Users

V1 is for two users:

- Me
- Partner

The two users share the same application features, but their data is separated.

V1 does not implement registration, password login, role permissions, or collaboration workflows.

## 3. Identity Model

On first launch, the app asks the user to select an identity:

- `me`
- `partner`

The selected identity is saved locally. All user data includes a `user_id` field, and the backend separates data by `user_id`.

## 4. Platform Scope

### PC Web

PC is optimized for:

- Dashboard
- Projects/Goals
- Resume Progress / Resume Development
- AI Workspace
- Project logs
- Calendar review
- Notes management

PC Web does not execute reminders in V1.

### Android App

Android is optimized for:

- Todo
- Strong reminders
- Fast capture
- Quick completion
- Widgets
- Viewing Project/Goal status

Android is the only reminder execution platform in V1.

## 5. Main Modules

V1 contains:

- Dashboard
- Projects/Goals
- Resume Progress
- AI Workspace
- Todo
- Reminder
- Calendar
- Notes
- Settings

Statistics is deferred.

## 6. Dashboard

Dashboard priority differs by platform.

### PC Dashboard

PC Dashboard focuses on Project/Goal recovery:

- Current Project/Goal
- Current stage
- Progress
- Next step
- Latest AI Session summary
- Recommended next prompt
- Today Todo summary

The Dashboard shows at most 3 focused Projects/Goals.

Focused Projects/Goals are selected by:

- User-pinned items first
- Then automatically filled by active and recently updated items

### Android Home

Android Home focuses on execution:

- Today Todo
- Strong reminders
- Next thing to do
- Quick add
- Quick note

## 7. Projects/Goals

Project is generalized as Project/Goal.

A Project/Goal means:

> A long-running thing that has status, progress, stages, logs, milestones, and a next step.

It can be a software project, learning goal, health goal, pet care goal, life plan, or other long-running effort.

### Types

V1 supports simple types:

- Development
- Learning
- Life
- Health
- Pet
- Other

Types affect labels, default stages, and display emphasis. They do not create complex business branches in V1.

### Status

Project/Goal status:

- Planning
- In progress
- Paused
- Completed
- Abandoned

### Progress

Progress supports mixed modes:

- Manual percentage by default
- Optional calculation by Milestone completion
- Optional calculation by linked Todo completion
- Optional AI suggested progress, confirmed by the user before saving

### Stages

Stages are generated from templates based on Project/Goal type and can be edited by the user.

Example development stages:

- Requirements
- UI design
- Development
- Testing
- Release

### Milestones

V1 Milestone is lightweight:

- Title
- Target date
- Status
- Project/Goal
- Sort order

Milestones do not replace Todo.

### Timeline

Project/Goal has a unified timeline. Timeline events may include:

- Manual logs
- Milestone changes
- Completed Todo
- AI Sessions

AI Session is a specialized Project Log type.

## 8. Resume Progress

Resume is a core LifeOS capability.

Default product label:

- Continue Progress

For development-type Projects/Goals:

- Continue Development

Resume should answer:

- What was last completed?
- What changed?
- What is the current state?
- What is the next step?
- What prompt should be given to AI next?

## 9. AI Workspace

AI Workspace is not a chat app. It is a structured AI collaboration context store.

V1 does not automatically fetch conversations from Codex, ChatGPT, Claude, Gemini, or other AI tools.

V1 provides:

- Structured AI Session form
- Start collaboration prompt template
- End-of-session summary prompt template
- Continue progress prompt template
- Copy prompt button

### AI Session Fields

Each AI Session records:

- Goal of this session
- Completed work
- Modified files
- Verification result
- Remaining issues
- Next step
- Recommended next prompt
- Linked Project/Goal
- AI tool
- Start time
- End time
- User note

Modified files are manually entered or pasted in V1.

Future versions may read Git diff or local project changes automatically.

## 10. Todo

Todo is optimized for fast execution and reminder reliability.

### Categories

Categories are user data.

On first initialization, default categories are created for each user:

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

Users can add, rename, and delete categories, except Inbox cannot be deleted.

### Tags

Tags are reserved in the data model, but V1 does not expose tag UI.

### Priority

Priority values:

- High
- Medium
- Low

### Status

Todo status represents task state only:

- Pending
- Completed
- Canceled

Reminder state is stored separately.

### Due Time, Planned Date, Reminder Time

Todo separates:

- `due_at`: when the task should be completed
- `planned_date`: the day the user plans to do it
- `remind_at`: stored in Reminder, when the system should remind the user

Today Todo includes:

- Todos planned for today
- Todos due today
- Todos with reminders today

### Quick Add

Android Home provides one-line quick add.

Default quick-added Todos go to Inbox.

Advanced fields can be expanded:

- Category
- Priority
- Due time
- Reminder
- Strong reminder
- Repeat rule

Natural language input is deferred.

### Subtasks

V1 does not support Todo subtasks.

Complex work should be represented as a Project/Goal with multiple Todos or Milestones.

## 11. Reminder

Todo and Reminder are separate models.

One Todo can have multiple Reminders.

Reminder state includes:

- Scheduled
- Fired
- Snoozed
- Ignored

### Reminder Levels

V1 supports:

- Normal reminder
- Strong reminder

Normal reminder:

- High-priority notification
- Sound/vibration
- Notification actions

Strong reminder:

- Full-screen alert
- Continuous ringtone/vibration
- Lock-screen display if enabled
- Actions: complete, snooze, ignore

### Ignore

Ignoring a strong reminder stops the current reminder. It does not repeat again for that occurrence.

The system records the ignored state for later statistics.

### Snooze

Strong reminder snooze options:

- 5 minutes
- 10 minutes
- 30 minutes
- 60 minutes

V1 can use 10 minutes as the default, with a setting reserved for default snooze duration.

### Lock Screen

Strong reminders should support lock-screen full-screen display.

This is user-configurable in Settings.

The Android app should guide the user to grant necessary permissions.

### Ringtone

Strong reminders use:

- App default ringtone
- Optional system ringtone selection

### Do Not Disturb

Settings may define global quiet hours.

Normal reminders respect quiet hours.

Strong reminders are not suppressed by quiet hours unless the user disables strong reminders.

## 12. Recurring Todo

Recurring Todo uses template plus instance.

The template stores:

- Title
- Category
- Priority
- Repeat rule
- Reminder rules
- Linked Project/Goal if any

Instances are generated from templates.

Users complete instances, and historical instances are kept for statistics and review.

The system generates future instances for the next 7 days.

If a repeat rule changes, completed historical instances remain unchanged. Future uncompleted instances can be regenerated or updated.

## 13. Calendar

Calendar is an aggregation view, not a separate calendar system.

It displays:

- Todo
- Reminders
- Project/Goal Milestones
- Deadlines
- Development logs
- AI Sessions

Users can open and edit the source object from Calendar, but Calendar does not own separate business data.

## 14. Notes

Notes are lightweight quick records, not a knowledge base.

V1 supports:

- Title
- Content
- Linked Project/Goal
- Linked Todo
- External knowledge base link

V1 does not implement folders, backlinks, heavy Markdown editing, or unified knowledge base search.

## 15. External Knowledge Base

LifeOS can store links to the user's existing knowledge base.

V1 does not sync knowledge base content through API and does not search inside the knowledge base.

## 16. Pet Care

Pet care is represented as a Project/Goal type.

Each pet or pet care plan can be a Goal linked with:

- Recurring Todos
- Strong reminders
- Care logs
- Widgets

V1 does not implement a full pet management module.

## 17. Android Widgets

V1 implements 2 widgets:

- Today Todo widget
- Continue Progress widget

Deferred widgets:

- Pet care widget
- Project countdown widget
- Pomodoro widget
- Daily quote widget
- Dashboard widget
