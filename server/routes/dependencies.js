const { Router } = require('express');
const { db } = require('../lib/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');

const router = Router();

const depSchema = z.object({
  predecessor_task_id: z.number().int(),
  dependency_type: z.enum(['FS', 'SS', 'FF', 'SF']).optional().default('FS'),
  lag_days: z.number().int().optional().default(0),
});

router.post('/tasks/:id/dependencies', asyncHandler(async (req, res) => {
  const data = depSchema.parse(req.body);
  const result = db.prepare(
    'INSERT INTO task_dependencies (predecessor_task_id, successor_task_id, dependency_type, lag_days) VALUES (?, ?, ?, ?)'
  ).run(data.predecessor_task_id, req.params.id, data.dependency_type, data.lag_days);
  const dep = db.prepare('SELECT * FROM task_dependencies WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(dep);
}));

router.delete('/dependencies/:id', asyncHandler(async (req, res) => {
  const result = db.prepare('DELETE FROM task_dependencies WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Dependency not found' });
  res.json({ success: true });
}));

module.exports = router;
