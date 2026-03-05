const { Router } = require('express');
const { db } = require('../lib/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');

const router = Router();

const taskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional().default(''),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  start_date: z.string().nullable().optional().default(null),
  end_date: z.string().nullable().optional().default(null),
  percent_complete: z.number().int().min(0).max(100).optional().default(0),
  assigned_to: z.string().optional().default(''),
  group_id: z.number().int().nullable().optional().default(null),
  milestone: z.union([z.boolean(), z.number()]).optional().default(false),
  color: z.string().nullable().optional().default(null),
  position: z.number().int().optional().default(0),
  baseline_start: z.string().nullable().optional().default(null),
  baseline_end: z.string().nullable().optional().default(null),
  is_template: z.union([z.boolean(), z.number()]).optional().default(false),
  recurrence: z.string().nullable().optional().default(null),
  attachments: z.string().optional().default('[]'),
  tags: z.array(z.string()).optional().default([]),
});

function enrichTask(task) {
  if (!task) return null;
  task.tags = db.prepare('SELECT id, tag FROM task_tags WHERE task_id = ?').all(task.id);
  task.dependencies = db.prepare(`
    SELECT d.*, t.title as predecessor_title
    FROM task_dependencies d
    JOIN tasks t ON t.id = d.predecessor_task_id
    WHERE d.successor_task_id = ?
  `).all(task.id);
  task.successors = db.prepare(`
    SELECT d.*, t.title as successor_title
    FROM task_dependencies d
    JOIN tasks t ON t.id = d.successor_task_id
    WHERE d.predecessor_task_id = ?
  `).all(task.id);
  // Parse assignees into member objects
  if (task.assigned_to) {
    const ids = task.assigned_to.split(',').filter(Boolean).map(Number);
    if (ids.length > 0) {
      task.assignees = ids.map(id =>
        db.prepare('SELECT * FROM team_members WHERE id = ?').get(id)
      ).filter(Boolean);
    } else {
      task.assignees = [];
    }
  } else {
    task.assignees = [];
  }
  return task;
}

// Get tasks for a project
router.get('/projects/:id/tasks', asyncHandler(async (req, res) => {
  const { status, assignee, group_id, tag, priority, search } = req.query;
  let sql = 'SELECT * FROM tasks WHERE project_id = ? AND is_template = 0';
  const params = [req.params.id];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (priority) { sql += ' AND priority = ?'; params.push(priority); }
  if (group_id) { sql += ' AND group_id = ?'; params.push(group_id); }
  if (assignee) { sql += " AND (',' || assigned_to || ',') LIKE ?"; params.push(`%,${assignee},%`); }
  if (search) { sql += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ' ORDER BY position ASC, id ASC';
  let tasks = db.prepare(sql).all(...params);

  if (tag) {
    const taskIds = db.prepare('SELECT DISTINCT task_id FROM task_tags WHERE tag = ?').all(tag).map(r => r.task_id);
    tasks = tasks.filter(t => taskIds.includes(t.id));
  }

  tasks = tasks.map(enrichTask);
  res.json(tasks);
}));

// Get task templates for a project
router.get('/projects/:id/templates', asyncHandler(async (req, res) => {
  const templates = db.prepare('SELECT * FROM tasks WHERE project_id = ? AND is_template = 1').all(req.params.id);
  res.json(templates.map(enrichTask));
}));

// Create task
router.post('/projects/:id/tasks', asyncHandler(async (req, res) => {
  const data = taskSchema.parse(req.body);
  const { tags, ...taskData } = data;

  const maxPos = db.prepare('SELECT MAX(position) as m FROM tasks WHERE project_id = ?').get(req.params.id);
  const position = taskData.position || ((maxPos?.m || 0) + 1);

  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, start_date, end_date,
      percent_complete, assigned_to, group_id, milestone, color, position, baseline_start, baseline_end,
      is_template, recurrence, attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, taskData.title, taskData.description, taskData.status, taskData.priority,
    taskData.start_date, taskData.end_date, taskData.percent_complete, taskData.assigned_to,
    taskData.group_id, taskData.milestone ? 1 : 0, taskData.color, position,
    taskData.baseline_start, taskData.baseline_end, taskData.is_template ? 1 : 0,
    taskData.recurrence, taskData.attachments
  );

  const taskId = result.lastInsertRowid;

  if (tags.length > 0) {
    const insertTag = db.prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)');
    for (const tag of tags) insertTag.run(taskId, tag);
  }

  // Record creation in history
  db.prepare(
    "INSERT INTO task_history (task_id, field_changed, old_value, new_value, changed_by) VALUES (?, 'created', NULL, ?, 'system')"
  ).run(taskId, taskData.title);

  const task = enrichTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId));
  res.status(201).json(task);
}));

// Get single task
router.get('/tasks/:id', asyncHandler(async (req, res) => {
  const task = enrichTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
}));

// Update task
router.put('/tasks/:id', asyncHandler(async (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const data = taskSchema.partial().parse(req.body);
  const { tags, ...updates } = data;

  // Record changes in history
  const recordChange = db.prepare(
    "INSERT INTO task_history (task_id, field_changed, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, 'user')"
  );

  const fields = ['title', 'description', 'status', 'priority', 'start_date', 'end_date',
    'percent_complete', 'assigned_to', 'group_id', 'milestone', 'color', 'position',
    'baseline_start', 'baseline_end', 'is_template', 'recurrence', 'attachments'];

  for (const field of fields) {
    if (updates[field] !== undefined && String(updates[field]) !== String(existing[field])) {
      recordChange.run(req.params.id, field, String(existing[field] ?? ''), String(updates[field] ?? ''));
    }
  }

  // Build dynamic update
  const setClauses = [];
  const params = [];
  for (const field of fields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      let val = updates[field];
      if (field === 'milestone' || field === 'is_template') val = val ? 1 : 0;
      params.push(val);
    }
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
  }

  // Handle recurrence: if status changed to 'done' and recurrence is set, create next task
  if (updates.status === 'done' && existing.recurrence && existing.status !== 'done') {
    const recurrence = existing.recurrence; // daily, weekly, monthly
    let newStart = existing.start_date;
    let newEnd = existing.end_date;
    const addDays = recurrence === 'daily' ? 1 : recurrence === 'weekly' ? 7 : 30;
    if (newStart) {
      const d = new Date(newStart);
      d.setDate(d.getDate() + addDays);
      newStart = d.toISOString().split('T')[0];
    }
    if (newEnd) {
      const d = new Date(newEnd);
      d.setDate(d.getDate() + addDays);
      newEnd = d.toISOString().split('T')[0];
    }
    db.prepare(`
      INSERT INTO tasks (project_id, title, description, status, priority, start_date, end_date,
        percent_complete, assigned_to, group_id, milestone, color, position, recurrence, attachments)
      VALUES (?, ?, ?, 'todo', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
    `).run(existing.project_id, existing.title, existing.description, existing.priority,
      newStart, newEnd, existing.assigned_to, existing.group_id, existing.milestone,
      existing.color, existing.position + 1, existing.recurrence, existing.attachments || '[]');
  }

  // Update tags if provided
  if (tags !== undefined) {
    db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(req.params.id);
    const insertTag = db.prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)');
    for (const tag of tags) insertTag.run(req.params.id, tag);
  }

  const task = enrichTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
  res.json(task);
}));

// Delete task
router.delete('/tasks/:id', asyncHandler(async (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ success: true });
}));

// Toggle complete
router.patch('/tasks/:id/complete', asyncHandler(async (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const newStatus = task.status === 'done' ? 'todo' : 'done';
  const newPercent = newStatus === 'done' ? 100 : 0;

  db.prepare(
    "INSERT INTO task_history (task_id, field_changed, old_value, new_value, changed_by) VALUES (?, 'status', ?, ?, 'user')"
  ).run(task.id, task.status, newStatus);

  db.prepare(
    "UPDATE tasks SET status = ?, percent_complete = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(newStatus, newPercent, task.id);

  // Handle recurrence
  if (newStatus === 'done' && task.recurrence) {
    const addDays = task.recurrence === 'daily' ? 1 : task.recurrence === 'weekly' ? 7 : 30;
    let newStart = task.start_date;
    let newEnd = task.end_date;
    if (newStart) {
      const d = new Date(newStart);
      d.setDate(d.getDate() + addDays);
      newStart = d.toISOString().split('T')[0];
    }
    if (newEnd) {
      const d = new Date(newEnd);
      d.setDate(d.getDate() + addDays);
      newEnd = d.toISOString().split('T')[0];
    }
    db.prepare(`
      INSERT INTO tasks (project_id, title, description, status, priority, start_date, end_date,
        percent_complete, assigned_to, group_id, milestone, color, position, recurrence, attachments)
      VALUES (?, ?, ?, 'todo', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
    `).run(task.project_id, task.title, task.description, task.priority,
      newStart, newEnd, task.assigned_to, task.group_id, task.milestone,
      task.color, task.position + 1, task.recurrence, task.attachments || '[]');
  }

  const updated = enrichTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id));
  res.json(updated);
}));

// Save task as template
router.post('/tasks/:id/template', asyncHandler(async (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority,
      percent_complete, assigned_to, group_id, milestone, color, position, is_template, attachments)
    VALUES (?, ?, ?, 'todo', ?, 0, ?, ?, ?, ?, 0, 1, ?)
  `).run(task.project_id, task.title + ' (Template)', task.description, task.priority,
    task.assigned_to, task.group_id, task.milestone, task.color, task.attachments || '[]');

  // Copy tags
  const tags = db.prepare('SELECT tag FROM task_tags WHERE task_id = ?').all(task.id);
  const insertTag = db.prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)');
  for (const { tag } of tags) insertTag.run(result.lastInsertRowid, tag);

  const template = enrichTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
  res.status(201).json(template);
}));

module.exports = router;
