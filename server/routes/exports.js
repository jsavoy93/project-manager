const { Router } = require('express');
const { db } = require('../lib/db');
const { asyncHandler } = require('../middleware/errorHandler');
const ExcelJS = require('exceljs');

const router = Router();

router.get('/projects/:id/export/excel', asyncHandler(async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? AND is_template = 0 ORDER BY position').all(req.params.id);
  const groups = db.prepare('SELECT * FROM task_groups WHERE project_id = ? ORDER BY position').all(req.params.id);
  const members = db.prepare('SELECT * FROM team_members').all();
  const allDeps = db.prepare(`
    SELECT d.*, p.title as pred_title, s.title as succ_title
    FROM task_dependencies d
    JOIN tasks p ON p.id = d.predecessor_task_id
    JOIN tasks s ON s.id = d.successor_task_id
    WHERE p.project_id = ? OR s.project_id = ?
  `).all(req.params.id, req.params.id);

  const groupMap = {};
  for (const g of groups) groupMap[g.id] = g.name;
  const memberMap = {};
  for (const m of members) memberMap[m.id] = m.name;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Project Manager';
  workbook.created = new Date();

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (project.color || '#4F46E5').replace('#', '') } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const altFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };

  function styleSheet(sheet) {
    sheet.getRow(1).eachCell(cell => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });
    sheet.autoFilter = { from: 'A1', to: String.fromCharCode(64 + sheet.columnCount) + '1' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    for (let i = 2; i <= sheet.rowCount; i++) {
      if (i % 2 === 0) {
        sheet.getRow(i).eachCell(cell => { cell.fill = altFill; });
      }
    }
    sheet.columns.forEach(col => { col.width = Math.max(col.width || 12, 14); });
  }

  // Sheet 1: Task Summary
  const ws1 = workbook.addWorksheet('Task Summary');
  ws1.columns = [
    { header: 'ID', key: 'id', width: 6 },
    { header: 'Group', key: 'group', width: 20 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Assigned To', key: 'assigned', width: 25 },
    { header: 'Start Date', key: 'start_date', width: 14 },
    { header: 'End Date', key: 'end_date', width: 14 },
    { header: 'Duration', key: 'duration', width: 10 },
    { header: '% Complete', key: 'percent', width: 12 },
    { header: 'Tags', key: 'tags', width: 20 },
    { header: 'Milestone', key: 'milestone', width: 10 },
    { header: 'Predecessors', key: 'predecessors', width: 25 },
  ];

  for (const t of tasks) {
    const tags = db.prepare('SELECT tag FROM task_tags WHERE task_id = ?').all(t.id).map(r => r.tag);
    const deps = db.prepare('SELECT predecessor_task_id, dependency_type FROM task_dependencies WHERE successor_task_id = ?').all(t.id);
    const assigneeNames = t.assigned_to ? t.assigned_to.split(',').filter(Boolean).map(id => memberMap[id] || id).join(', ') : '';
    const row = ws1.addRow({
      id: t.id,
      group: groupMap[t.group_id] || '',
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assigned: assigneeNames,
      start_date: t.start_date || '',
      end_date: t.end_date || '',
      duration: t.duration_days || '',
      percent: t.percent_complete,
      tags: tags.join(', '),
      milestone: t.milestone ? 'Yes' : 'No',
      predecessors: deps.map(d => `${d.predecessor_task_id}(${d.dependency_type})`).join(', '),
    });

    // Color-code status
    const statusCell = row.getCell('status');
    const statusColors = { done: 'FF10B981', blocked: 'FFEF4444', in_progress: 'FFF59E0B', todo: 'FF6B7280', cancelled: 'FF9CA3AF' };
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors[t.status] || 'FF6B7280' } };
    statusCell.font = { color: { argb: 'FFFFFFFF' } };
  }
  styleSheet(ws1);

  // Sheet 2: Completion Report
  const ws2 = workbook.addWorksheet('Completion Report');
  ws2.columns = [
    { header: 'ID', key: 'id', width: 6 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Completed Date', key: 'completed', width: 16 },
    { header: 'Assigned To', key: 'assigned', width: 25 },
    { header: 'Group', key: 'group', width: 20 },
    { header: 'Tags', key: 'tags', width: 20 },
  ];

  const doneTasks = tasks.filter(t => t.status === 'done');
  for (const t of doneTasks) {
    const tags = db.prepare('SELECT tag FROM task_tags WHERE task_id = ?').all(t.id).map(r => r.tag);
    const assigneeNames = t.assigned_to ? t.assigned_to.split(',').filter(Boolean).map(id => memberMap[id] || id).join(', ') : '';
    ws2.addRow({
      id: t.id, title: t.title, completed: t.end_date || '', assigned: assigneeNames,
      group: groupMap[t.group_id] || '', tags: tags.join(', '),
    });
  }
  // Summary row
  ws2.addRow({});
  ws2.addRow({ id: 'Total', title: `${tasks.length} tasks`, completed: `${doneTasks.length} done`, assigned: `${tasks.length > 0 ? Math.round(doneTasks.length / tasks.length * 100) : 0}% complete` });
  styleSheet(ws2);

  // Sheet 3: Team Workload
  const ws3 = workbook.addWorksheet('Team Workload');
  ws3.columns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Role', key: 'role', width: 20 },
    { header: 'Total Tasks', key: 'total', width: 12 },
    { header: 'Done', key: 'done', width: 10 },
    { header: 'In Progress', key: 'in_progress', width: 14 },
    { header: 'Blocked', key: 'blocked', width: 10 },
    { header: 'Overdue', key: 'overdue', width: 10 },
  ];

  for (const m of members) {
    const stats = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN end_date < date('now') AND status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) as overdue
      FROM tasks WHERE (',' || assigned_to || ',') LIKE ? AND project_id = ? AND is_template = 0
    `).get(`%,${m.id},%`, req.params.id);
    ws3.addRow({ name: m.name, role: m.role, ...stats });
  }
  styleSheet(ws3);

  // Sheet 4: Dependencies
  const ws4 = workbook.addWorksheet('Dependencies');
  ws4.columns = [
    { header: 'Predecessor ID', key: 'pred_id', width: 14 },
    { header: 'Predecessor Title', key: 'pred_title', width: 35 },
    { header: 'Type', key: 'type', width: 8 },
    { header: 'Lag Days', key: 'lag', width: 10 },
    { header: 'Successor ID', key: 'succ_id', width: 14 },
    { header: 'Successor Title', key: 'succ_title', width: 35 },
  ];
  for (const d of allDeps) {
    ws4.addRow({
      pred_id: d.predecessor_task_id, pred_title: d.pred_title, type: d.dependency_type,
      lag: d.lag_days, succ_id: d.successor_task_id, succ_title: d.succ_title,
    });
  }
  styleSheet(ws4);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

// CSV export (full-fidelity, importable format)
router.get('/projects/:id/export/tasks', asyncHandler(async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? AND is_template = 0 ORDER BY position').all(req.params.id);
  const groups = db.prepare('SELECT * FROM task_groups WHERE project_id = ? ORDER BY position').all(req.params.id);
  const members = db.prepare('SELECT * FROM team_members').all();
  const memberMap = {};
  for (const m of members) memberMap[m.id] = m.name;
  const groupMap = {};
  for (const g of groups) groupMap[g.id] = g.name;

  function esc(val) {
    const s = String(val ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  const headers = [
    'title', 'description', 'status', 'priority',
    'start_date', 'end_date', 'percent_complete',
    'group', 'tags', 'milestone', 'assigned_to',
    'predecessors', 'successors',
    'color', 'baseline_start', 'baseline_end', 'recurrence',
  ];

  // Build a title→id map for dependency labels
  const taskTitleMap = {};
  for (const t of tasks) taskTitleMap[t.id] = t.title;

  const rows = tasks.map(t => {
    const tags = db.prepare('SELECT tag FROM task_tags WHERE task_id = ?').all(t.id).map(r => r.tag).join(';');
    const preds = db.prepare('SELECT predecessor_task_id, dependency_type, lag_days FROM task_dependencies WHERE successor_task_id = ?').all(t.id);
    const succs = db.prepare('SELECT successor_task_id, dependency_type, lag_days FROM task_dependencies WHERE predecessor_task_id = ?').all(t.id);
    const assigneeNames = t.assigned_to ? t.assigned_to.split(',').filter(Boolean).map(id => memberMap[id] || '').filter(Boolean).join(';') : '';
    const predStr = preds.map(d => {
      const title = taskTitleMap[d.predecessor_task_id] || String(d.predecessor_task_id);
      return `${title}(${d.dependency_type}${d.lag_days ? ':' + d.lag_days : ''})`;
    }).join(';');
    const succStr = succs.map(d => {
      const title = taskTitleMap[d.successor_task_id] || String(d.successor_task_id);
      return `${title}(${d.dependency_type}${d.lag_days ? ':' + d.lag_days : ''})`;
    }).join(';');

    return [
      esc(t.title), esc(t.description), t.status, t.priority,
      t.start_date || '', t.end_date || '', t.percent_complete,
      esc(groupMap[t.group_id] || ''), esc(tags), t.milestone ? 'yes' : 'no', esc(assigneeNames),
      esc(predStr), esc(succStr),
      t.color || '', t.baseline_start || '', t.baseline_end || '', t.recurrence || '',
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_tasks.csv"`);
  res.send(csv);
}));

module.exports = router;
