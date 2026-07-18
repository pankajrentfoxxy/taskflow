# TaskFlow — Internal Task Tracker

Mobile-first task tracker for a 100-person team: 30-minute response SLA, mandatory ETAs, subtasks with done-timestamps, automatic escalation with mandatory explanations, projects, role-based reports, and a Scribble drawing pad so the CEO can hand-write tasks and send them as screenshots.

## Quick start

Requirements: **Node.js 22.13 or newer** (uses Node's built-in SQLite — no database server, no native compilation).

```bash
npm install
npm run dev
```

Open http://localhost:3000. The database is created and seeded automatically on first run (file: `data/taskflow.db`).

### Demo logins (password for all: `password123`)

| Email | Role |
|---|---|
| admin@company.com | Admin |
| ceo@company.com | CEO |
| suresh@ / meena@ / manoj@ / kavita@ / deepak@ company.com | Team Heads (Sales / Accounts / Warehouse / HR / Support) |
| neha@, amit@ (Sales) · ravi@ (Accounts) · sunil@ (Warehouse) · pooja@ (HR) · anjali@ (Support) company.com | Members |

Delete the `data/` folder to reset to fresh seed data. Change all passwords via Admin → Reset pw before real use.

### Production

```bash
npm run build
npm start
```

Set a real `AUTH_SECRET` (copy `.env.example` to `.env`). Optionally point an external scheduler at `GET /api/cron/sla-check` every minute (with `CRON_SECRET`); the app also runs the SLA sweep automatically on activity, at most once per minute.

## How it works

**Roles.** Member sees only their own/created/project tasks. Manager additionally sees their whole team's tasks. CEO and Admin see everything; Admin also manages users, teams and settings.

**Task lifecycle.** Assigned → Acknowledge (ETA is mandatory, one action) → In progress → Done (timestamp captured). Working hours are 10:00–19:00 IST, Mon–Sat: the 30-minute response SLA only ticks inside working hours (a task assigned at 18:50 is due for acknowledgment at 10:20 next working day). Missed SLA → red "NO RESPONSE" flag + notifications to assignee, their manager and the creator, with a 15-minutes-left warning before that.

**Escalation.** A task that passes its due date is escalated automatically. The assignee is locked out of every action until they submit a written explanation (min 20 chars) plus a proposed new ETA. Manager/CEO/Admin then Accept (task is re-planned) or Reject (stays flagged). ETA can be edited by the assignee, their manager, the CEO and Admin — every change is logged with old → new and who did it.

**Subtasks & batches.** "3 tasks in one message" works both ways: the composer has a Multiple-tasks toggle (one task per line, linked as one batch), and any assignee can split a received task into subtasks. Each subtask captures its own done-timestamp; the parent shows "1 of 3 done" with a progress bar and cannot be closed while subtasks are open (creator/Admin can override with a logged reason).

**Scribble.** Full-screen canvas (pen with pressure, highlighter, eraser, shapes, arrows, text, undo/redo, stylus-only mode for palm rejection). Boards save to your account. "Send as Task" exports the canvas as a PNG, attaches it, and opens the composer — assign to anyone or to yourself as a memo.

**Task Types & Aliases.** Each team owns a catalogue of task types with a deliverable unit ("alias"): HR's *Job Role* is counted in *Resumes*, Sales' *Lead Follow-up* in *Calls*, Support's *Ticket Resolution* in *Tickets*. The composer shows only the types of the selected assignee's team (picking a team also lists its members). A type can carry a target ("find 10 Resumes"); the assignee logs delivered units, the creator and Head are notified when the target is met, and the ticket cannot close before the target is reached (creator/Head/Admin can override with a logged reason). Heads manage their own team's catalogue via the Manage link; Admin/CEO manage all.

**Projects.** Any member can create a project and add members. All project tasks, notes, files and activity are visible to every member; a task assigned to a person is always visible to that person and the project owner.

**Reports.** Role-scoped dashboard: overdue, no-response, escalations awaiting explanation / pending review, due this week, on-time %, average response time, plus a per-person table with CSV export.

## Tech notes

- Next.js 15 (App Router) + Tailwind. All data behind `/api/*` JSON routes with server-side RBAC — a future mobile app can reuse the backend as-is.
- SQLite via `node:sqlite` (built into Node ≥ 22.13). To move to PostgreSQL later, replace `src/lib/db.ts` and the SQL calls — the schema is in that file.
- Sessions: HMAC-signed cookies (30 days). Google SSO can be added later with Auth.js; registration is Admin-invite-only by design.
- Attachments are stored in the database (25 MB limit per file) and served via `/api/uploads/:id` (auth required).
- Installable as a PWA (Add to Home Screen) — `public/manifest.json`.

## Folder map

```
src/lib        db.ts (schema+connection) · seed.ts · sla.ts (working-hours engine)
               auth.ts · rbac.ts · notify.ts · cron.ts (SLA sweep) · util.ts
src/app/api    auth, me, users, teams, tasks (+comments/escalation), projects,
               notifications, reports, uploads, boards, cron/sla-check
src/app        login, home, tasks, tasks/[id], scribble, projects, projects/[id],
               reports, admin, notifications
src/components Shell (nav+bell) · TaskCard · Composer · AckModal · Modal
src/middleware.ts  auth redirect
```
