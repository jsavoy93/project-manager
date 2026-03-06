const { Router } = require('express');
const { db } = require('../lib/db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

// Parse a CSV string into an array of row objects keyed by header
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCSVLine(line);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? '').trim();
    }
    rows.push(row);
  }
  return rows;
}

// Split a single CSV line respecting quoted fields
function splitCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// Parse predecessor/successor cell: "Task Title(FS):3" or "Task Title" or "3(SS)"
// Returns array of { ref, type, lag } where ref is title or row-number string
function parseDependencyCell(cell) {
  if (!cell) return [];
  return cell.split(';').map(s => s.trim()).filter(Boolean).map(part => {
    // Match optional type and lag: "Some Title(FS:2)" or "Some Title(FS)" or "Some Title"
    const match = part.match(/^(.*?)(?:\((\w{2})(?::(-?\d+))?\))?$/);
    if (!match) return { ref: part.trim(), type: 'FS', lag: 0 };
    return {
      ref: match[1].trim(),
      type: (match[2] || 'FS').toUpperCase(),
      lag: parseInt(match[3] || '0', 10),
    };
  });
}

function toBool(val) {
  if (!val) return 0;
  return ['yes', 'true', '1', 'y'].includes(val.toLowerCase()) ? 1 : 0;
}

function toInt(val, def = 0) {
  const n = parseInt(val, 10);
  return isNaN(n) ? def : n;
}

function normalizeStatus(val) {
  const map = { todo: 'todo', in_progress: 'in_progress', 'in progress': 'in_progress', blocked: 'blocked', done: 'done', cancelled: 'cancelled', canceled: 'cancelled' };
  return map[(val || '').toLowerCase()] || 'todo';
}

function normalizePriority(val) {
  const map = { low: 'low', medium: 'medium', high: 'high', critical: 'critical' };
  return map[(val || '').toLowerCase()] || 'medium';
}

function normalizeDependencyType(val) {
  const v = (val || 'FS').toUpperCase();
  return ['FS', 'SS', 'FF', 'SF'].includes(v) ? v : 'FS';
}

// POST /api/v1/projects/:id/import/tasks
// Body: { csv: "<csv text>", mode: "append"|"replace" }
router.post('/projects/:id/import/tasks', asyncHandler(async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { csv, mode = 'append' } = req.body;
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'Request body must contain a "csv" string field' });
  }

  const rows = parseCSV(csv);
  if (rows.length === 0) {
    return res.status(400).json({ error: 'CSV has no data rows' });
  }

  // Load supporting data
  const members = db.prepare('SELECT * FROM team_members').all();
  const memberByName = {};
  for (const m of members) memberByName[m.name.toLowerCase()] = m;

  const existingGroups = db.prepare('SELECT * FROM task_groups WHERE project_id = ? ORDER BY position').all(req.params.id);
  const groupByName = {};
  for (const g of existingGroups) groupByName[g.name.toLowerCase()] = g;

  const errors = [];
  // Map from CSV row index (0-based) and title → newly created task id, for dependency resolution
  const rowIndexToTaskId = {};   // index in `rows` → taskId
  const titleToTaskId = {};      // lower-cased title → taskId (last created wins on dupe titles)

  // Optional: replace mode clears existing tasks first
  if (mode === 'replace') {
    db.prepare('DELETE FROM tasks WHERE project_id = ? AND is_template = 0').run(req.params.id);
  }

  // --- Pass 1: create tasks ---
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, start_date, end_date,
      percent_complete, assigned_to, group_id, milestone, color, position,
      baseline_start, baseline_end, recurrence, attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
  `);
  const insertTag = db.prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)');
  const insertHistory = db.prepare(
    "INSERT INTO task_history (task_id, field_changed, old_value, new_value, changed_by) VALUES (?, 'created', NULL, ?, 'csv-import')"
  );

  const maxPosRow = db.prepare('SELECT MAX(position) as m FROM tasks WHERE project_id = ?').get(req.params.id);
  let nextPos = (maxPosRow?.m || 0) + 1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-based, accounting for header row

    const title = row['title'] || row['task'] || row['name'] || '';
    if (!title) {
      errors.push({ row: rowNum, message: 'Missing required field: title' });
      continue;
    }

    // Resolve group by name (create if not exists)
    let groupId = null;
    const groupName = row['group'] || row['group_name'] || row['phase'] || '';
    if (groupName) {
      const key = groupName.toLowerCase();
      if (groupByName[key]) {
        groupId = groupByName[key].id;
      } else {
        const maxGroupPos = db.prepare('SELECT MAX(position) as m FROM task_groups WHERE project_id = ?').get(req.params.id);
        const gPos = (maxGroupPos?.m || 0) + 1;
        const gResult = db.prepare(
          'INSERT INTO task_groups (project_id, name, color, position) VALUES (?, ?, ?, ?)'
        ).run(req.params.id, groupName, '#6B7280', gPos);
        const newGroup = { id: gResult.lastInsertRowid, name: groupName, position: gPos };
        groupByName[key] = newGroup;
        groupId = newGroup.id;
      }
    }

    // Resolve assignees by name
    const assignedToCell = row['assigned_to'] || row['assigned'] || row['assignee'] || row['assignees'] || '';
    const assignedIds = [];
    if (assignedToCell) {
      for (const name of assignedToCell.split(/[,;]/).map(s => s.trim()).filter(Boolean)) {
        const member = memberByName[name.toLowerCase()];
        if (member) {
          assignedIds.push(member.id);
        }
        // silently skip unknown names
      }
    }

    const startDate = row['start_date'] || row['start'] || null;
    const endDate = row['end_date'] || row['end'] || row['due_date'] || row['due'] || null;
    const color = row['color'] || null;
    const baselineStart = row['baseline_start'] || null;
    const baselineEnd = row['baseline_end'] || null;
    const recurrence = row['recurrence'] || null;

    let taskId;
    try {
      const result = insertTask.run(
        req.params.id,
        title,
        row['description'] || row['desc'] || '',
        normalizeStatus(row['status']),
        normalizePriority(row['priority']),
        startDate || null,
        endDate || null,
        toInt(row['percent_complete'] || row['%_complete'] || row['percent'] || row['completion'] || '0', 0),
        assignedIds.join(','),
        groupId,
        toBool(row['milestone']),
        color || null,
        nextPos++,
        baselineStart || null,
        baselineEnd || null,
        recurrence || null,
      );
      taskId = result.lastInsertRowid;
    } catch (err) {
      errors.push({ row: rowNum, message: `DB insert failed: ${err.message}` });
      continue;
    }

    // Tags
    const tagsCell = row['tags'] || row['tag'] || '';
    if (tagsCell) {
      for (const tag of tagsCell.split(/[,;]/).map(s => s.trim()).filter(Boolean)) {
        try { insertTag.run(taskId, tag); } catch (_) { /* ignore dup */ }
      }
    }

    insertHistory.run(taskId, title);

    rowIndexToTaskId[i] = taskId;
    titleToTaskId[title.toLowerCase()] = taskId;
  }

  // --- Pass 2: create dependencies ---
  const insertDep = db.prepare(`
    INSERT OR IGNORE INTO task_dependencies (predecessor_task_id, successor_task_id, dependency_type, lag_days)
    VALUES (?, ?, ?, ?)
  `);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const successorTaskId = rowIndexToTaskId[i];
    if (!successorTaskId) continue;

    // Predecessors column
    const predCell = row['predecessors'] || row['predecessor'] || row['depends_on'] || row['depends on'] || '';
    for (const dep of parseDependencyCell(predCell)) {
      const predTaskId = resolveTaskRef(dep.ref, i, rows, rowIndexToTaskId, titleToTaskId);
      if (!predTaskId) continue;
      try {
        insertDep.run(predTaskId, successorTaskId, normalizeDependencyType(dep.type), dep.lag);
      } catch (_) { /* ignore constraint errors */ }
    }

    // Successors column
    const succCell = row['successors'] || row['successor'] || '';
    for (const dep of parseDependencyCell(succCell)) {
      const succTaskId = resolveTaskRef(dep.ref, i, rows, rowIndexToTaskId, titleToTaskId);
      if (!succTaskId) continue;
      try {
        insertDep.run(successorTaskId, succTaskId, normalizeDependencyType(dep.type), dep.lag);
      } catch (_) { /* ignore constraint errors */ }
    }
  }

  const imported = Object.keys(rowIndexToTaskId).length;
  res.status(201).json({
    imported,
    errors,
    skipped: rows.length - imported - errors.length,
    total: rows.length,
  });
}));

// Resolve a dependency reference (title or 1-based row number) to a task ID
function resolveTaskRef(ref, currentRowIndex, rows, rowIndexToTaskId, titleToTaskId) {
  if (!ref) return null;
  // Try as a 1-based row number first
  const rowNum = parseInt(ref, 10);
  if (!isNaN(rowNum) && rowNum >= 1 && rowNum <= rows.length) {
    return rowIndexToTaskId[rowNum - 1] || null;
  }
  // Try as title lookup
  return titleToTaskId[ref.toLowerCase()] || null;
}

// GET /api/v1/projects/:id/import/template
// Returns a CSV template with headers and one example row
router.get('/projects/:id/import/template', asyncHandler(async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const headers = [
    'title', 'description', 'status', 'priority',
    'start_date', 'end_date', 'percent_complete',
    'group', 'tags', 'milestone', 'assigned_to',
    'predecessors', 'successors',
    'color', 'baseline_start', 'baseline_end', 'recurrence',
  ];

  const example = [
    'Design mockups',
    'Create initial UI mockups for review',
    'in_progress',
    'high',
    '2025-01-06',
    '2025-01-10',
    '50',
    'Design Phase',
    'ui,design',
    'no',
    '',
    '',
    '2(FS)',
    '',
    '',
    '',
    '',
  ];

  const example2 = [
    'Development sprint 1',
    'Implement designs from sprint 1',
    'todo',
    'medium',
    '2025-01-13',
    '2025-01-24',
    '0',
    'Development',
    'dev,backend',
    'no',
    '',
    '1(FS)',
    '',
    '',
    '',
    '',
    '',
  ];

  function csvRow(fields) {
    return fields.map(f => {
      if (f.includes(',') || f.includes('"') || f.includes('\n')) {
        return `"${f.replace(/"/g, '""')}"`;
      }
      return f;
    }).join(',');
  }

  const csv = [csvRow(headers), csvRow(example), csvRow(example2)].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_import_template.csv"`);
  res.send(csv);
}));

module.exports = router;
