import { useState, useRef } from 'react';
import { STATUS_ORDER, STATUS_CONFIG, PRIORITY_CONFIG, isOverdue, hashColor } from '../lib/utils';

export default function KanbanBoard({ tasks, groups, team, onSelectTask, onUpdateTask }) {
  const [groupBy, setGroupBy] = useState('status');
  const [draggedTask, setDraggedTask] = useState(null);
  const dragOverCol = useRef(null);

  const columns = groupBy === 'status'
    ? STATUS_ORDER.map(s => ({ key: s, label: STATUS_CONFIG[s].label, tasks: tasks.filter(t => t.status === s) }))
    : groupBy === 'priority'
    ? ['critical', 'high', 'medium', 'low'].map(p => ({ key: p, label: PRIORITY_CONFIG[p].label, tasks: tasks.filter(t => t.priority === p) }))
    : groupBy === 'group'
    ? [...groups.map(g => ({ key: g.id, label: g.name, color: g.color, tasks: tasks.filter(t => t.group_id === g.id) })),
       { key: 0, label: 'Ungrouped', tasks: tasks.filter(t => !t.group_id) }]
    : team.map(m => ({ key: m.id, label: m.name, tasks: tasks.filter(t => t.assigned_to?.split(',').includes(String(m.id))) }));

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    dragOverCol.current = colKey;
  };

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    if (!draggedTask) return;

    if (groupBy === 'status') {
      onUpdateTask(draggedTask.id, { status: colKey });
    } else if (groupBy === 'priority') {
      onUpdateTask(draggedTask.id, { priority: colKey });
    } else if (groupBy === 'group') {
      onUpdateTask(draggedTask.id, { group_id: colKey || null });
    }

    setDraggedTask(null);
    dragOverCol.current = null;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Group by selector */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Group by:</span>
          {['status', 'group', 'assignee', 'priority'].map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-2 py-1 rounded capitalize ${groupBy === g ? 'bg-accent/10 text-accent font-medium' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full min-w-max">
          {columns.map(col => (
            <div
              key={col.key}
              className={`w-72 flex-shrink-0 flex flex-col bg-zinc-50 dark:bg-zinc-900/50 rounded border border-zinc-200 dark:border-zinc-800 ${
                dragOverCol.current === col.key ? 'ring-2 ring-accent/50' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  {col.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />}
                  {groupBy === 'status' && <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[col.key]?.color}`} />}
                  <span className="text-xs font-semibold">{col.label}</span>
                </div>
                <span className="text-xs text-zinc-400 font-mono">{col.tasks.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {col.tasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onClick={() => onSelectTask(task.id)}
                    className={`card p-3 cursor-pointer hover:border-accent/40 transition-colors border-l-2 ${
                      PRIORITY_CONFIG[task.priority]?.border || 'border-l-zinc-300'
                    } ${isOverdue(task) ? 'ring-1 ring-red-300 dark:ring-red-800' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-medium leading-snug">{task.title}</h4>
                      <span className="text-[10px] font-mono text-zinc-400 flex-shrink-0">#{task.id}</span>
                    </div>

                    {/* Tags */}
                    {task.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {task.tags.map(t => (
                          <span key={t.id} className="badge text-[10px]" style={{ backgroundColor: hashColor(t.tag) + '20', color: hashColor(t.tag) }}>
                            {t.tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        {/* Assignee avatars */}
                        {task.assignees?.slice(0, 3).map(a => (
                          <div key={a.id} className="w-5 h-5 rounded-full text-[9px] font-medium flex items-center justify-center text-white"
                            style={{ backgroundColor: a.avatar_color }} title={a.name}>
                            {a.name.charAt(0)}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {task.end_date && (
                          <span className={`text-[10px] font-mono ${isOverdue(task) ? 'text-red-500' : 'text-zinc-400'}`}>
                            {task.end_date.slice(5)}
                          </span>
                        )}
                        {groupBy !== 'status' && (
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[task.status]?.color}`} />
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {task.percent_complete > 0 && (
                      <div className="mt-2 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${task.percent_complete}%` }} />
                      </div>
                    )}

                    {/* Group label */}
                    {task.group_id && groupBy !== 'group' && (
                      <div className="mt-1.5">
                        <span className="text-[10px] text-zinc-400">
                          {task.group_id ? (task.tags?.length ? '' : '') : ''}
                          {(() => {
                            const g = groups?.find(g => g.id === task.group_id);
                            return g?.name || '';
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {col.tasks.length === 0 && (
                  <div className="text-xs text-zinc-400 text-center py-6">No tasks</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
