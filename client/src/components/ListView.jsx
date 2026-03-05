import { useState } from 'react';
import { STATUS_CONFIG, PRIORITY_CONFIG, isOverdue, formatDate } from '../lib/utils';

export default function ListView({ tasks, groups, team, onSelectTask, onUpdateTask, onDeleteTask }) {
  const [sortField, setSortField] = useState('position');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sorted = [...tasks].sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (va == null) va = '';
    if (vb == null) vb = '';
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleAll = () => {
    if (selected.size === tasks.length) setSelected(new Set());
    else setSelected(new Set(tasks.map(t => t.id)));
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkAction = async (action) => {
    const ids = Array.from(selected);
    for (const id of ids) {
      if (action === 'delete') await onDeleteTask(id);
      else await onUpdateTask(id, { status: action });
    }
    setSelected(new Set());
  };

  const handleInlineEdit = async (taskId, field, value) => {
    setEditingCell(null);
    await onUpdateTask(taskId, { [field]: value });
  };

  const columns = [
    { key: 'id', label: '#', width: 'w-12' },
    { key: 'title', label: 'Title', width: 'flex-1', editable: true },
    { key: 'status', label: 'Status', width: 'w-28', editable: true },
    { key: 'priority', label: 'Priority', width: 'w-24', editable: true },
    { key: 'assigned_to', label: 'Assignee', width: 'w-32', editable: true },
    { key: 'start_date', label: 'Start', width: 'w-28', editable: true },
    { key: 'end_date', label: 'End', width: 'w-28', editable: true },
    { key: 'percent_complete', label: '%', width: 'w-16' },
  ];

  return (
    <div className="h-full overflow-auto">
      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-accent/10 border-b border-accent/20 px-4 py-2 flex items-center gap-3">
          <span className="text-xs font-medium">{selected.size} selected</span>
          <button onClick={() => bulkAction('done')} className="btn-ghost text-xs">Mark Done</button>
          <button onClick={() => bulkAction('in_progress')} className="btn-ghost text-xs">In Progress</button>
          <button onClick={() => bulkAction('todo')} className="btn-ghost text-xs">To Do</button>
          <button onClick={() => bulkAction('delete')} className="btn-ghost text-xs text-red-500">Delete</button>
          <button onClick={() => setSelected(new Set())} className="btn-ghost text-xs ml-auto">Cancel</button>
        </div>
      )}

      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th className="w-8 px-2 py-2.5">
              <input type="checkbox" checked={selected.size === tasks.length && tasks.length > 0}
                onChange={toggleAll} className="rounded" />
            </th>
            {columns.map(col => (
              <th key={col.key}
                className={`${col.width} px-2 py-2.5 text-left font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300`}
                onClick={() => toggleSort(col.key)}>
                {col.label}
                {sortField === col.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(task => (
            <tr key={task.id}
              className={`border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${
                isOverdue(task) ? 'bg-red-50/50 dark:bg-red-950/20' : ''
              }`}>
              <td className="w-8 px-2 py-2">
                <input type="checkbox" checked={selected.has(task.id)}
                  onChange={() => toggleOne(task.id)} className="rounded" />
              </td>
              <td className="w-12 px-2 py-2 font-mono text-zinc-400">{task.id}</td>
              <td className="px-2 py-2 cursor-pointer" onClick={() => {
                if (editingCell?.id === task.id && editingCell?.field === 'title') return;
                onSelectTask(task.id);
              }}>
                {editingCell?.id === task.id && editingCell?.field === 'title' ? (
                  <input autoFocus defaultValue={task.title} className="input py-0 text-xs"
                    onBlur={e => handleInlineEdit(task.id, 'title', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleInlineEdit(task.id, 'title', e.target.value); if (e.key === 'Escape') setEditingCell(null); }}
                  />
                ) : (
                  <span className="font-medium" onDoubleClick={() => setEditingCell({ id: task.id, field: 'title' })}>
                    {task.milestone && <span className="text-amber-500 mr-1">◆</span>}
                    {task.title}
                  </span>
                )}
              </td>
              <td className="w-28 px-2 py-2">
                {editingCell?.id === task.id && editingCell?.field === 'status' ? (
                  <select autoFocus defaultValue={task.status} className="input py-0 text-xs"
                    onChange={e => handleInlineEdit(task.id, 'status', e.target.value)}
                    onBlur={() => setEditingCell(null)}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                ) : (
                  <span className={`badge ${STATUS_CONFIG[task.status]?.bg} ${STATUS_CONFIG[task.status]?.text}`}
                    onDoubleClick={() => setEditingCell({ id: task.id, field: 'status' })}>
                    {STATUS_CONFIG[task.status]?.label}
                  </span>
                )}
              </td>
              <td className="w-24 px-2 py-2">
                {editingCell?.id === task.id && editingCell?.field === 'priority' ? (
                  <select autoFocus defaultValue={task.priority} className="input py-0 text-xs"
                    onChange={e => handleInlineEdit(task.id, 'priority', e.target.value)}
                    onBlur={() => setEditingCell(null)}>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                ) : (
                  <span onDoubleClick={() => setEditingCell({ id: task.id, field: 'priority' })} className="cursor-default">
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: PRIORITY_CONFIG[task.priority]?.color }} />
                    {PRIORITY_CONFIG[task.priority]?.label}
                  </span>
                )}
              </td>
              <td className="w-32 px-2 py-2">
                <div className="flex -space-x-1">
                  {task.assignees?.slice(0, 3).map(a => (
                    <div key={a.id} className="w-5 h-5 rounded-full text-[9px] font-medium flex items-center justify-center text-white border border-white dark:border-zinc-900"
                      style={{ backgroundColor: a.avatar_color }} title={a.name}>
                      {a.name.charAt(0)}
                    </div>
                  ))}
                </div>
              </td>
              <td className="w-28 px-2 py-2">
                {editingCell?.id === task.id && editingCell?.field === 'start_date' ? (
                  <input type="date" autoFocus defaultValue={task.start_date} className="input py-0 text-xs"
                    onBlur={e => handleInlineEdit(task.id, 'start_date', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setEditingCell(null); }} />
                ) : (
                  <span className="font-mono text-zinc-400" onDoubleClick={() => setEditingCell({ id: task.id, field: 'start_date' })}>
                    {formatDate(task.start_date)}
                  </span>
                )}
              </td>
              <td className="w-28 px-2 py-2">
                {editingCell?.id === task.id && editingCell?.field === 'end_date' ? (
                  <input type="date" autoFocus defaultValue={task.end_date} className="input py-0 text-xs"
                    onBlur={e => handleInlineEdit(task.id, 'end_date', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setEditingCell(null); }} />
                ) : (
                  <span className={`font-mono ${isOverdue(task) ? 'text-red-500' : 'text-zinc-400'}`}
                    onDoubleClick={() => setEditingCell({ id: task.id, field: 'end_date' })}>
                    {formatDate(task.end_date)}
                  </span>
                )}
              </td>
              <td className="w-16 px-2 py-2">
                <div className="flex items-center gap-1">
                  <div className="w-8 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${task.percent_complete}%` }} />
                  </div>
                  <span className="font-mono text-zinc-400">{task.percent_complete}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <div className="text-center py-12 text-sm text-zinc-500">No tasks found</div>
      )}
    </div>
  );
}
