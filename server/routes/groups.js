const { Router } = require('express');
const { db } = require('../lib/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');

const router = Router();

const groupSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366F1'),
  position: z.number().int().optional(),
});

router.get('/projects/:id/groups', asyncHandler(async (req, res) => {
  const groups = db.prepare(
    'SELECT * FROM task_groups WHERE project_id = ? ORDER BY position ASC'
  ).all(req.params.id);
  res.json(groups);
}));

router.post('/projects/:id/groups', asyncHandler(async (req, res) => {
  const data = groupSchema.parse(req.body);
  const maxPos = db.prepare('SELECT MAX(position) as m FROM task_groups WHERE project_id = ?').get(req.params.id);
  const position = data.position ?? ((maxPos?.m || 0) + 1);
  const result = db.prepare(
    'INSERT INTO task_groups (project_id, name, color, position) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, data.name, data.color, position);
  const group = db.prepare('SELECT * FROM task_groups WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(group);
}));

router.put('/groups/:id', asyncHandler(async (req, res) => {
  const data = groupSchema.partial().parse(req.body);
  const existing = db.prepare('SELECT * FROM task_groups WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Group not found' });

  db.prepare('UPDATE task_groups SET name = ?, color = ?, position = ? WHERE id = ?').run(
    data.name ?? existing.name, data.color ?? existing.color, data.position ?? existing.position, req.params.id
  );
  const group = db.prepare('SELECT * FROM task_groups WHERE id = ?').get(req.params.id);
  res.json(group);
}));

router.delete('/groups/:id', asyncHandler(async (req, res) => {
  const result = db.prepare('DELETE FROM task_groups WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Group not found' });
  res.json({ success: true });
}));

module.exports = router;
