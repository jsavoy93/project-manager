const { Router } = require('express');
const { db } = require('../lib/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');

const router = Router();

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#4F46E5'),
});

router.get('/', asyncHandler(async (req, res) => {
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND is_template = 0) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done' AND is_template = 0) as done_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND end_date < date('now') AND status NOT IN ('done','cancelled') AND is_template = 0) as overdue_count
    FROM projects p ORDER BY p.updated_at DESC
  `).all();
  res.json(projects);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = projectSchema.parse(req.body);
  const result = db.prepare(
    'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)'
  ).run(data.name, data.description, data.color);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const project = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND is_template = 0) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done' AND is_template = 0) as done_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND end_date < date('now') AND status NOT IN ('done','cancelled') AND is_template = 0) as overdue_count
    FROM projects p WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = projectSchema.parse(req.body);
  db.prepare(
    "UPDATE projects SET name = ?, description = ?, color = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(data.name, data.description, data.color, req.params.id);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
  res.json({ success: true });
}));

module.exports = router;
