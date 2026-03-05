CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#4F46E5',
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366F1',
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '#4F46E5',
  role TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','blocked','done','cancelled')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
  start_date DATE,
  end_date DATE,
  duration_days INTEGER GENERATED ALWAYS AS (
    CASE WHEN start_date IS NOT NULL AND end_date IS NOT NULL
      THEN CAST(julianday(end_date) - julianday(start_date) AS INTEGER)
      ELSE NULL
    END
  ) STORED,
  percent_complete INTEGER DEFAULT 0 CHECK(percent_complete BETWEEN 0 AND 100),
  assigned_to TEXT DEFAULT '',
  group_id INTEGER REFERENCES task_groups(id) ON DELETE SET NULL,
  milestone BOOLEAN DEFAULT 0,
  color TEXT,
  position INTEGER DEFAULT 0,
  baseline_start DATE,
  baseline_end DATE,
  is_template BOOLEAN DEFAULT 0,
  recurrence TEXT,
  attachments TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  predecessor_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successor_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'FS' CHECK(dependency_type IN ('FS','SS','FF','SF')),
  lag_days INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_deps_pred ON task_dependencies(predecessor_task_id);
CREATE INDEX IF NOT EXISTS idx_deps_succ ON task_dependencies(successor_task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id);
