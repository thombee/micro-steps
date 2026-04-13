# micro-steps

> Break it down until it's easy.

A local-first task app built for ADHD brains. The core idea: any task that feels too big can be broken into sub-tasks, infinitely deep. Tiny tasks are easier to start.

![micro-steps screenshot](https://via.placeholder.com/800x450?text=micro-steps)

## Features

- **Infinite nesting** — break any task into sub-tasks, as deep as you need
- **Day navigation** — plan by day; incomplete tasks carry forward automatically
- **Deep focus mode** — one task, full screen, no distractions
- **Draggable floating timer** — start a countdown on any task, drag it anywhere, minimize to a pill
- **Session counter** — tracks how many tasks you've ticked off (including auto-completed parents)
- **Undo delete** — accidental delete? toast with undo restores the whole subtree
- **Time estimates + tracking** — set estimates per task, see time spent

## ADHD-specific UX

- Completion cascade: checking the last child auto-checks the parent → dopamine from multiple completions at once
- "Looks too big" nudge when a task title is too long or compound
- Deep focus encouragement phrases
- Break reminder after 20+ min sessions
- Session milestone messages (1 task, 3 tasks, 5…)
- Carry-forward: yesterday's unfinished work shows up today automatically

## Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite via `better-sqlite3` (WAL mode, cascade deletes)
- **Tests**: Node built-in test runner (server) + Vitest (client utils)

## Getting started

```bash
# Install dependencies
npm install
npm install --prefix client

# Run (starts both server on :3001 and client on :5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The SQLite database (`tasks.db`) is created automatically on first run.

## Running tests

```bash
# Server API tests (34 tests)
node --test server/test.js

# Client utility tests (49 tests)
npm test --prefix client
```

## Project structure

```
micro-steps/
├── server/
│   ├── index.js      # Express entry point (port 3001)
│   ├── db.js         # SQLite setup + migrations
│   ├── routes.js     # REST API: /api/tasks
│   └── test.js       # Server tests (Node test runner)
├── client/
│   └── src/
│       ├── App.jsx           # Root state + all handlers
│       ├── TaskTree.jsx      # Recursive task list
│       ├── TaskItem.jsx      # Individual task row
│       ├── TimerPanel.jsx    # Floating draggable timer
│       ├── DeepFocus.jsx     # Full-screen focus overlay
│       ├── DayNav.jsx        # ← date → navigation bar
│       ├── CompletionCounter.jsx
│       ├── api.js            # Fetch wrappers
│       ├── utils.js          # Pure utility functions
│       └── utils.test.js     # Client tests (Vitest)
└── package.json
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | All tasks (flat array) |
| POST | `/api/tasks` | Create task `{ title, parent_id?, day? }` |
| PATCH | `/api/tasks/:id` | Update `title`, `completed`, `estimated_minutes`, `time_spent_seconds`, `day` |
| DELETE | `/api/tasks/:id` | Delete task + all descendants |
| POST | `/api/tasks/restore` | Restore a deleted subtree (undo) |
