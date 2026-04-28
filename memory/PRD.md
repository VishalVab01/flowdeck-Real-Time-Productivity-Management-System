# Real-Time Productivity Management System (Mini SaaS)

## Original Problem Statement
Full Stack Developer (MERN + Redux) Assessment Task — 4-module real-time task/productivity management mini SaaS.

- **Frontend:** React.js + Redux Toolkit
- **Backend:** Node.js + Express
- **Database:** MongoDB (Mongoose)
- **Realtime:** Socket.io
- **Auth:** JWT (bcryptjs)
- **Design:** Minimal dark mode (Sora + JetBrains Mono, lime accent)

## Architecture
```
React (Redux Toolkit, react-router-dom, socket.io-client, recharts)
   │
   ├─ axios (Bearer JWT) ─► Express @ :8001 ─► MongoDB (productivity_db)
   └─ socket.io-client    ─► Socket.io server (path /api/socket.io/)
```
- Socket lifecycle is **App-level** (`App.js` useEffect on token), so it stays connected across all authenticated routes (Dashboard, Insights). Disconnects only on logout.
- Socket.io path is `/api/socket.io/` so the Kubernetes ingress (which only forwards `/api/*` to port 8001) routes WebSocket traffic correctly.

## What's been implemented (2026-04-28)

### Module 1 — COMPLETE ✅ Auth & Core Task System
- JWT register/login/me, bcryptjs hashing
- Task model: id, title, description, category, status, createdAt, deadline
- Owner-scoped CRUD endpoints
- React + Redux Toolkit slices (`authSlice`, `tasksSlice`)
- Login / Register / Dashboard pages, ProtectedRoute, Navbar
- Stats cards, filter chips, dark-mode UI
- localStorage token + `/me` rehydration on app boot

### Module 2 — COMPLETE ✅ Smart Task Prioritization Engine
- Dynamic `priorityScore` + `priorityLevel` computed every request — never stored
- Overdue = `1000 + minutesOverdue` (always wins) · Approaching = `round(999 * (1 − min(diff/7d, 1)))` (capped <1000) · No deadline = 0 · Completed = −1
- Levels: Overdue / High (<24h) / Medium (<72h) / Low / Done
- Tiebreaker: earlier `createdAt` first
- Backend `GET /api/tasks` returns pre-sorted; frontend mirrors the formula and re-sorts every 30s via Redux `tick` (no manual refresh)
- Visuals: red border + pulse for Overdue, lime border for High, dimmed for Done; priority pill on every task ("Level · Score")

### Module 3 — COMPLETE ✅ Real-Time Task Updates
- Socket.io server on same Express HTTP server (path `/api/socket.io/`)
- JWT auth on socket handshake; user joins room `user:<userId>`
- Backend emits `task:created` / `task:updated` / `task:deleted` after every mutation
- Frontend dispatches Redux actions on events
- Live indicator pill (`socket-status`) — green pulse when connected, red when offline
- Verified per-user isolation; updates reflect within 1s

### Module 4 — COMPLETE ✅ Productivity Insights & Activity Tracking
- `GET /api/insights` — dynamically computed per-user MongoDB aggregations:
  - `totals`: total/pending/inProgress/completed/overdue
  - `completedToday`, `completedThisWeek`, `completionRate`
  - `mostActiveCategory`, `categoryDistribution[]`
  - `dailyActivity[14]` — last 14 days, contiguous, oldest → newest
  - `insights[]` — human-friendly strings ("You completed N tasks today", "Most active category: X", "N overdue tasks", "Completion rate N% across M tasks")
- Frontend `/insights` page (Navbar tab "Insights"):
  - Insight strip (one-liners), 5 stat cards, "This week" + "Most active category" highlights
  - Recharts BarChart (daily activity 14-day) + PieChart donut (category distribution)
  - Real-time auto-refresh: subscribes to Redux task changes; whenever a socket event mutates `tasks.items`, the insights page re-fetches
  - Live indicator reads real `socketConnected` state

### Test Coverage
- Backend: **35/35 pytest tests pass** (Modules 1-4)
- Frontend: 100% of critical flows verified across **4 testing-agent iterations**, including the cross-page real-time refresh scenario

## Backlog (P2 polish)
- Replace `<input type="date">` with datetime-local picker (priority engine already supports minute granularity)
- Brute-force lockout on login
- Refresh-token rotation
- Password reset flow
- Optional team/shared workspace mode (currently strictly per-user)
- Snowflake/confetti on completion 🎉
