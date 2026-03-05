const { Router } = require('express');
const { db } = require('../lib/db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

router.get('/search', asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  const pattern = `%${q}%`;
  const tasks = db.prepare(`
    SELECT t.*, p.name as project_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.is_template = 0 AND (t.title LIKE ? OR t.description LIKE ?)
    LIMIT 20
  `).all(pattern, pattern);

  // Also search by tags
  const tagTasks = db.prepare(`
    SELECT DISTINCT t.*, p.name as project_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN task_tags tt ON tt.task_id = t.id
    WHERE t.is_template = 0 AND tt.tag LIKE ?
    LIMIT 10
  `).all(pattern);

  const seen = new Set(tasks.map(t => t.id));
  for (const t of tagTasks) {
    if (!seen.has(t.id)) tasks.push(t);
  }

  res.json(tasks);
}));

// Get all tags (for autocomplete)
router.get('/tags', asyncHandler(async (req, res) => {
  const tags = db.prepare('SELECT DISTINCT tag, COUNT(*) as count FROM task_tags GROUP BY tag ORDER BY count DESC').all();
  res.json(tags);
}));

// Task history
router.get('/tasks/:id/history', asyncHandler(async (req, res) => {
  const history = db.prepare('SELECT * FROM task_history WHERE task_id = ? ORDER BY changed_at DESC').all(req.params.id);
  res.json(history);
}));

module.exports = router;
