const { Router } = require('express');
const { db } = require('../lib/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');

const router = Router();

const commentSchema = z.object({
  body: z.string().min(1),
  author_id: z.number().int().optional().default(1),
});

router.get('/tasks/:id/comments', asyncHandler(async (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, tm.name as author_name, tm.avatar_color as author_color
    FROM comments c
    LEFT JOIN team_members tm ON tm.id = c.author_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
}));

router.post('/tasks/:id/comments', asyncHandler(async (req, res) => {
  const data = commentSchema.parse(req.body);
  const result = db.prepare(
    'INSERT INTO comments (task_id, author_id, body) VALUES (?, ?, ?)'
  ).run(req.params.id, data.author_id, data.body);
  const comment = db.prepare(`
    SELECT c.*, tm.name as author_name, tm.avatar_color as author_color
    FROM comments c
    LEFT JOIN team_members tm ON tm.id = c.author_id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(comment);
}));

router.delete('/comments/:id', asyncHandler(async (req, res) => {
  const result = db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Comment not found' });
  res.json({ success: true });
}));

module.exports = router;
