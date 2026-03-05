# Project Manager

A full-featured project management web application with Gantt chart, Kanban board, list view, Excel export, and team management.

## Features

- **Gantt Chart View**: SVG-based timeline with drag-to-reschedule, drag-to-resize, dependency arrows (bezier curves), baseline bars, critical path highlighting, milestone diamonds, weekend shading, and group expand/collapse
- **Kanban Board**: Drag-and-drop cards between columns, group by status/priority/group/assignee
- **List/Table View**: Sortable columns, inline editing, multi-select bulk actions
- **Task Management**: Full CRUD with status, priority, dates, assignees, tags, groups, milestones, recurrence, and attachments metadata
- **Dependencies**: FS/SS/FF/SF dependency types with lag/lead days
- **Excel Export**: Multi-sheet .xlsx with task summary, completion report, team workload, and dependencies
- **Team Management**: Member profiles with workload visualization
- **Dark Mode**: Full dark/light theme toggle (stored in localStorage)
- **Keyboard Shortcuts**: N (new task), G/K/L (view switch), E (export), Escape (close), Ctrl+K (search), Ctrl+Z/Ctrl+Shift+Z (undo/redo)
- **Global Search**: Ctrl+K to search tasks across all projects
- **Undo/Redo**: In-memory undo stack for task edits (up to 20 operations)
- **Due Date Alerts**: Toast notifications for tasks due within 3 days and overdue tasks
- **Critical Path**: Automatic calculation and highlighting of tasks on the critical path
- **Baseline Dates**: Ghost bars showing original planned dates
- **Task Templates**: Save any task as a reusable template
- **Recurring Tasks**: Auto-generate next task instance when current is marked done

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: React (Vite) + Tailwind CSS
- **Database**: SQLite (better-sqlite3)
- **Excel Export**: exceljs

## Local Development

```bash
# Install dependencies
npm install

# Seed demo data
npm run seed

# Start dev server (backend + frontend concurrently)
npm run dev
```

The app will be available at `http://localhost:5173` (Vite dev server with API proxy to port 3000).

## Production Build

```bash
npm run build
npm start
```

The app will be available at `http://localhost:3000`.

## Docker

```bash
# Build and run
docker build -t project-manager .
docker run -p 3000:3000 -v pm_data:/data project-manager

# Or with docker-compose
docker-compose up
```

## Deploy to Railway

1. Push to a GitHub repository
2. Connect the repository to Railway
3. Railway will automatically detect the Dockerfile and deploy
4. A persistent volume is mounted at `/data` for the SQLite database

The `railway.toml` is pre-configured with health check and restart policy.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `/data/pm.db` | SQLite database file path |
| `NODE_ENV` | `production` | Environment mode |
| `CORS_ORIGIN` | `*` | CORS allowed origins |

## API Endpoints

All endpoints are prefixed with `/api/v1`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List all projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project details |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project |
| GET | `/projects/:id/tasks` | List project tasks (with filters) |
| POST | `/projects/:id/tasks` | Create task |
| GET | `/tasks/:id` | Get task details |
| PUT | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |
| PATCH | `/tasks/:id/complete` | Toggle task completion |
| GET | `/projects/:id/groups` | List groups |
| POST | `/projects/:id/groups` | Create group |
| PUT | `/groups/:id` | Update group |
| DELETE | `/groups/:id` | Delete group |
| POST | `/tasks/:id/dependencies` | Add dependency |
| DELETE | `/dependencies/:id` | Remove dependency |
| GET | `/tasks/:id/comments` | List comments |
| POST | `/tasks/:id/comments` | Add comment |
| DELETE | `/comments/:id` | Delete comment |
| GET | `/team` | List team members |
| POST | `/team` | Add member |
| PUT | `/team/:id` | Update member |
| DELETE | `/team/:id` | Delete member |
| GET | `/projects/:id/export/excel` | Download Excel export |
| GET | `/projects/:id/export/tasks` | Download CSV export |
| GET | `/search?q=` | Search tasks |
| GET | `/tags` | List all tags |
| GET | `/tasks/:id/history` | Task change history |

## Project Structure

```
/project-root
  /client              ← React + Vite frontend
    /src
      /components      ← GanttChart, KanbanBoard, ListView, TaskDrawer, etc.
      /hooks           ← useFetch, useTheme, useUndoRedo
      /lib             ← api.js, utils.js
      /pages           ← Dashboard, ProjectView, TeamPage
      /styles          ← Tailwind CSS
  /server              ← Express backend
    /lib               ← db.js (SQLite connection + migrations)
    /middleware         ← errorHandler.js
    /migrations        ← SQL migration files
    /routes            ← projects, tasks, groups, dependencies, comments, team, exports, search
    index.js           ← Entry point
    seed.js            ← Demo data seeder
  Dockerfile
  docker-compose.yml
  railway.toml
```
