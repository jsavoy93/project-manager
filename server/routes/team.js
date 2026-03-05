const { Router } = require('express');
const { db } = require('../lib/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { z } = require('zod');

const router = Router();

const memberSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().optional().default(''),
  avatar_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#4F46E5'),
  role: z.string().optional().default(''),
});

router.get('/', asyncHandler(async (req, res) => {
  const members = db.prepare('SELECT * FROM team_members ORDER BY name ASC').all();
  // Enrich with workload
  for (const m of members) {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN end_date < date('now') AND status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) as overdue
      FROM tasks
      WHERE (',' || assigned_to || ',') LIKE ? AND is_template = 0
    `).get(`%,${m.id},%`);
    m.workload = stats;
  }
  res.json(members);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = memberSchema.parse(req.body);
  const result = db.prepare(
    'INSERT INTO team_members (name, email, avatar_color, role) VALUES (?, ?, ?, ?)'
  ).run(data.name, data.email, data.avatar_color, data.role);
  const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(member);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = memberSchema.partial().parse(req.body);
  const existing = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Member not found' });

  db.prepare('UPDATE team_members SET name = ?, email = ?, avatar_color = ?, role = ? WHERE id = ?').run(
    data.name ?? existing.name, data.email ?? existing.email,
    data.avatar_color ?? existing.avatar_color, data.role ?? existing.role, req.params.id
  );
  const member = db.prepare('SELECT * FROM team_members WHERE id = ?').get(req.params.id);
  res.json(member);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = db.prepare('DELETE FROM team_members WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Member not found' });
  res.json({ success: true });
}));

module.exports = router;
