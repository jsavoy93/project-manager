import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { isOverdue, STATUS_CONFIG, formatDate } from '../lib/utils';

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const LEFT_PANEL_WIDTH = 420;
const BAR_HEIGHT = 22;
const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;

function getZoomConfig(zoom) {
  switch (zoom) {
    case 'day': return { dayWidth: 40, format: 'day' };
    case 'week': return { dayWidth: 18, format: 'week' };
    case 'month': return { dayWidth: 5, format: 'month' };
    case 'quarter': return { dayWidth: 2, format: 'quarter' };
    default: return { dayWidth: 18, format: 'week' };
  }
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function isWeekend(date) {
  const d = new Date(date);
  return d.getDay() === 0 || d.getDay() === 6;
}

// Calculate critical path using longest path method
function calculateCriticalPath(tasks) {
  const taskMap = {};
  for (const t of tasks) taskMap[t.id] = t;

  // Forward pass: earliest start/finish
  const es = {}, ef = {};
  const processed = new Set();

  function forwardPass(taskId) {
    if (processed.has(taskId)) return ef[taskId] || 0;
    processed.add(taskId);
    const task = taskMap[taskId];
    if (!task) return 0;

    let earliest = 0;
    for (const dep of (task.dependencies || [])) {
      if (dep.dependency_type === 'FS') {
        earliest = Math.max(earliest, forwardPass(dep.predecessor_task_id) + (dep.lag_days || 0));
      }
    }
    es[taskId] = earliest;
    ef[taskId] = earliest + (task.duration_days || 1);
    return ef[taskId];
  }

  for (const t of tasks) forwardPass(t.id);

  // Find project end
  const projectEnd = Math.max(...Object.values(ef), 0);

  // Backward pass: latest start/finish
  const ls = {}, lf = {};
  const processed2 = new Set();

  function backwardPass(taskId) {
    if (processed2.has(taskId)) return ls[taskId] || 0;
    processed2.add(taskId);
    const task = taskMap[taskId];
    if (!task) return projectEnd;

    let latest = projectEnd;
    for (const succ of (task.successors || [])) {
      if (succ.dependency_type === 'FS') {
        latest = Math.min(latest, backwardPass(succ.successor_task_id) - (succ.lag_days || 0));
      }
    }
    lf[taskId] = latest;
    ls[taskId] = latest - (task.duration_days || 1);
    return ls[taskId];
  }

  for (const t of tasks) backwardPass(t.id);

  // Critical = zero slack
  const critical = new Set();
  for (const t of tasks) {
    const slack = (ls[t.id] || 0) - (es[t.id] || 0);
    if (Math.abs(slack) < 0.5) critical.add(t.id);
  }
  return critical;
}

export default function GanttChart({ tasks, groups, zoom, project, onSelectTask, onUpdateTask }) {
  const containerRef = useRef(null);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [tooltip, setTooltip] = useState(null);
  const [dragging, setDragging] = useState(null);
  const dragRef = useRef(null);

  const { dayWidth } = getZoomConfig(zoom);

  // Compute date range
  const { startDate, endDate, rows, groupedTasks } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      return { startDate: addDays(today, -7), endDate: addDays(today, 30), rows: [], groupedTasks: {} };
    }

    const dates = tasks.flatMap(t => [t.start_date, t.end_date].filter(Boolean)).map(d => new Date(d));
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 14);

    const startDate = min.toISOString().split('T')[0];
    const endDate = max.toISOString().split('T')[0];

    // Group tasks
    const grouped = {};
    const ungrouped = [];
    for (const t of tasks) {
      if (t.group_id) {
        if (!grouped[t.group_id]) grouped[t.group_id] = [];
        grouped[t.group_id].push(t);
      } else {
        ungrouped.push(t);
      }
    }

    // Build rows
    const rows = [];
    for (const g of groups) {
      rows.push({ type: 'group', group: g });
      if (!collapsedGroups.has(g.id) && grouped[g.id]) {
        for (const t of grouped[g.id]) {
          rows.push({ type: 'task', task: t });
        }
      }
    }
    if (ungrouped.length > 0) {
      rows.push({ type: 'group', group: { id: 0, name: 'Ungrouped', color: '#6B7280' } });
      for (const t of ungrouped) {
        rows.push({ type: 'task', task: t });
      }
    }

    return { startDate, endDate, rows, groupedTasks: grouped };
  }, [tasks, groups, collapsedGroups]);

  const totalDays = daysBetween(startDate, endDate);
  const chartWidth = totalDays * dayWidth;
  const chartHeight = rows.length * ROW_HEIGHT;
  const todayOffset = daysBetween(startDate, new Date().toISOString().split('T')[0]) * dayWidth;

  const criticalPath = useMemo(() => calculateCriticalPath(tasks), [tasks]);

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Group progress rollup
  const groupProgress = useMemo(() => {
    const result = {};
    for (const g of groups) {
      const gTasks = tasks.filter(t => t.group_id === g.id);
      if (gTasks.length === 0) { result[g.id] = 0; continue; }
      const totalDur = gTasks.reduce((s, t) => s + (t.duration_days || 1), 0);
      const weightedComplete = gTasks.reduce((s, t) => s + (t.percent_complete || 0) * (t.duration_days || 1), 0);
      result[g.id] = totalDur > 0 ? Math.round(weightedComplete / totalDur) : 0;
    }
    return result;
  }, [tasks, groups]);

  // Dragging logic
  const handleMouseDown = useCallback((e, task, mode) => {
    e.stopPropagation();
    const startX = e.clientX;
    dragRef.current = { task, mode, startX, startDate: task.start_date, endDate: task.end_date };
    setDragging({ taskId: task.id, mode });

    const handleMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dayDelta = Math.round(dx / dayWidth);
      if (dayDelta === 0) return;

      const d = dragRef.current;
      if (mode === 'move') {
        d.newStart = addDays(d.startDate, dayDelta);
        d.newEnd = addDays(d.endDate, dayDelta);
      } else if (mode === 'resize') {
        d.newEnd = addDays(d.endDate, dayDelta);
        d.newStart = d.startDate;
      }
      setDragging({ taskId: task.id, mode, newStart: d.newStart, newEnd: d.newEnd || d.endDate });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      const d = dragRef.current;
      if (d.newStart || d.newEnd) {
        onUpdateTask(task.id, {
          start_date: d.newStart || d.startDate,
          end_date: d.newEnd || d.endDate,
        });
      }
      setDragging(null);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [dayWidth, onUpdateTask]);

  // Render timeline header
  const renderTimelineHeader = () => {
    const items = [];
    const d = new Date(startDate);
    const end = new Date(endDate);

    if (zoom === 'day' || zoom === 'week') {
      // Show months on top, days/weeks below
      let currentMonth = '';
      let monthStart = 0;
      let dayIndex = 0;

      while (d <= end) {
        const monthLabel = d.toLocaleDateString('en', { month: 'short', year: 'numeric' });
        if (monthLabel !== currentMonth) {
          if (currentMonth) {
            items.push(
              <text key={`m-${currentMonth}`} x={monthStart * dayWidth + 4} y={14} className="fill-zinc-500 dark:fill-zinc-400 text-[10px] font-medium">
                {currentMonth}
              </text>
            );
          }
          currentMonth = monthLabel;
          monthStart = dayIndex;
        }

        if (zoom === 'day') {
          const x = dayIndex * dayWidth;
          items.push(
            <text key={`d-${dayIndex}`} x={x + dayWidth / 2} y={36} textAnchor="middle" className="fill-zinc-400 dark:fill-zinc-500 text-[9px] font-mono">
              {d.getDate()}
            </text>
          );
        } else if (zoom === 'week' && d.getDay() === 1) {
          const x = dayIndex * dayWidth;
          items.push(
            <text key={`w-${dayIndex}`} x={x + 2} y={36} className="fill-zinc-400 dark:fill-zinc-500 text-[9px] font-mono">
              {d.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </text>
          );
        }

        d.setDate(d.getDate() + 1);
        dayIndex++;
      }
      // Last month
      if (currentMonth) {
        items.push(
          <text key={`m-${currentMonth}-last`} x={monthStart * dayWidth + 4} y={14} className="fill-zinc-500 dark:fill-zinc-400 text-[10px] font-medium">
            {currentMonth}
          </text>
        );
      }
    } else {
      // month/quarter - just show month labels
      let dayIndex = 0;
      let lastLabel = '';
      while (d <= end) {
        const label = zoom === 'quarter'
          ? `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`
          : d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
        if (label !== lastLabel) {
          items.push(
            <text key={`ml-${dayIndex}`} x={dayIndex * dayWidth + 4} y={28} className="fill-zinc-500 dark:fill-zinc-400 text-[10px] font-medium">
              {label}
            </text>
          );
          lastLabel = label;
        }
        d.setDate(d.getDate() + 1);
        dayIndex++;
      }
    }

    return items;
  };

  // Render dependency arrows
  const renderDependencyArrows = () => {
    const arrows = [];
    const taskPositions = {};
    rows.forEach((row, i) => {
      if (row.type === 'task' && row.task.start_date) {
        const t = row.task;
        const taskStart = dragging?.taskId === t.id ? (dragging.newStart || t.start_date) : t.start_date;
        const taskEnd = dragging?.taskId === t.id ? (dragging.newEnd || t.end_date) : t.end_date;
        const x = daysBetween(startDate, taskStart) * dayWidth;
        const w = Math.max(daysBetween(taskStart, taskEnd) * dayWidth, dayWidth);
        taskPositions[t.id] = { x, w, y: i * ROW_HEIGHT + BAR_Y_OFFSET + BAR_HEIGHT / 2 };
      }
    });

    for (const task of tasks) {
      for (const dep of (task.dependencies || [])) {
        const from = taskPositions[dep.predecessor_task_id];
        const to = taskPositions[task.id];
        if (!from || !to) continue;

        const depColors = { FS: '#6B7280', SS: '#3B82F6', FF: '#10B981', SF: '#F59E0B' };
        const color = depColors[dep.dependency_type] || '#6B7280';

        let startX, startY, endX, endY;
        switch (dep.dependency_type) {
          case 'SS':
            startX = from.x; startY = from.y;
            endX = to.x; endY = to.y;
            break;
          case 'FF':
            startX = from.x + from.w; startY = from.y;
            endX = to.x + to.w; endY = to.y;
            break;
          case 'SF':
            startX = from.x; startY = from.y;
            endX = to.x + to.w; endY = to.y;
            break;
          default: // FS
            startX = from.x + from.w; startY = from.y;
            endX = to.x; endY = to.y;
            break;
        }

        const midX = (startX + endX) / 2;
        const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
        arrows.push(
          <g key={`dep-${dep.id}`}>
            <path d={path} fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
            <circle cx={endX} cy={endY} r="3" fill={color} opacity="0.8" />
          </g>
        );
      }
    }
    return arrows;
  };

  // Render weekend shading
  const renderWeekends = () => {
    if (zoom === 'quarter') return null;
    const rects = [];
    const d = new Date(startDate);
    let dayIndex = 0;
    const end = new Date(endDate);
    while (d <= end) {
      if (isWeekend(d)) {
        rects.push(
          <rect key={`we-${dayIndex}`} x={dayIndex * dayWidth} y={0} width={dayWidth} height={chartHeight}
            className="fill-zinc-50 dark:fill-zinc-900/50" />
        );
      }
      d.setDate(d.getDate() + 1);
      dayIndex++;
    }
    return rects;
  };

  return (
    <div className="flex h-full overflow-hidden" ref={containerRef}>
      {/* Left panel - task list */}
      <div className="flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto" style={{ width: LEFT_PANEL_WIDTH }}>
        <div className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex text-[10px] font-medium text-zinc-500 uppercase tracking-wider" style={{ height: HEADER_HEIGHT }}>
          <div className="w-8 px-2 flex items-center">#</div>
          <div className="flex-1 px-2 flex items-center">Task</div>
          <div className="w-16 px-1 flex items-center">Start</div>
          <div className="w-16 px-1 flex items-center">End</div>
          <div className="w-10 px-1 flex items-center">%</div>
        </div>
        {rows.map((row, i) => (
          <div
            key={row.type === 'group' ? `g-${row.group.id}` : `t-${row.task.id}`}
            className={`flex items-center border-b border-zinc-100 dark:border-zinc-800/50 text-xs ${
              row.type === 'group' ? 'bg-zinc-50 dark:bg-zinc-900/50 font-semibold' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer'
            }`}
            style={{ height: ROW_HEIGHT }}
            onClick={() => {
              if (row.type === 'group') toggleGroup(row.group.id);
              else onSelectTask(row.task.id);
            }}
          >
            {row.type === 'group' ? (
              <>
                <div className="w-8 px-2 text-zinc-400">
                  {collapsedGroups.has(row.group.id) ? '▸' : '▾'}
                </div>
                <div className="flex-1 px-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: row.group.color }} />
                  {row.group.name}
                </div>
                <div className="w-16 px-1" />
                <div className="w-16 px-1" />
                <div className="w-10 px-1 font-mono text-zinc-400">{groupProgress[row.group.id] || 0}%</div>
              </>
            ) : (
              <>
                <div className="w-8 px-2 text-zinc-400 font-mono">{row.task.id}</div>
                <div className="flex-1 px-2 truncate flex items-center gap-1">
                  {row.task.milestone ? <span className="text-amber-500">◆</span> : null}
                  <span className={isOverdue(row.task) ? 'text-red-500' : ''}>{row.task.title}</span>
                </div>
                <div className="w-16 px-1 font-mono text-zinc-400 text-[10px]">{row.task.start_date?.slice(5) || ''}</div>
                <div className="w-16 px-1 font-mono text-zinc-400 text-[10px]">{row.task.end_date?.slice(5) || ''}</div>
                <div className="w-10 px-1 font-mono text-zinc-400">{row.task.percent_complete}%</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Right panel - timeline */}
      <div className="flex-1 overflow-auto">
        <svg width={chartWidth} height={chartHeight + HEADER_HEIGHT} className="select-none">
          {/* Header */}
          <g className="gantt-header">
            <rect x={0} y={0} width={chartWidth} height={HEADER_HEIGHT} className="fill-zinc-50 dark:fill-zinc-950" />
            {renderTimelineHeader()}
            <line x1={0} y1={HEADER_HEIGHT} x2={chartWidth} y2={HEADER_HEIGHT} className="stroke-zinc-200 dark:stroke-zinc-800" />
          </g>

          <g transform={`translate(0, ${HEADER_HEIGHT})`}>
            {/* Weekend shading */}
            {renderWeekends()}

            {/* Row backgrounds */}
            {rows.map((row, i) => (
              <rect
                key={`bg-${i}`}
                x={0} y={i * ROW_HEIGHT} width={chartWidth} height={ROW_HEIGHT}
                className={row.type === 'group' ? 'fill-zinc-50/50 dark:fill-zinc-900/30' : 'fill-transparent'}
              />
            ))}

            {/* Row grid lines */}
            {rows.map((_, i) => (
              <line key={`gl-${i}`} x1={0} y1={(i + 1) * ROW_HEIGHT} x2={chartWidth} y2={(i + 1) * ROW_HEIGHT}
                className="stroke-zinc-100 dark:stroke-zinc-800/50" strokeWidth="0.5" />
            ))}

            {/* Today line */}
            {todayOffset > 0 && todayOffset < chartWidth && (
              <line x1={todayOffset} y1={0} x2={todayOffset} y2={chartHeight}
                stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.7" />
            )}

            {/* Task bars */}
            {rows.map((row, i) => {
              if (row.type !== 'task' || !row.task.start_date || !row.task.end_date) return null;
              const t = row.task;
              const tStart = dragging?.taskId === t.id ? (dragging.newStart || t.start_date) : t.start_date;
              const tEnd = dragging?.taskId === t.id ? (dragging.newEnd || t.end_date) : t.end_date;
              const x = daysBetween(startDate, tStart) * dayWidth;
              const w = Math.max(daysBetween(tStart, tEnd) * dayWidth, dayWidth);
              const y = i * ROW_HEIGHT + BAR_Y_OFFSET;
              const barColor = t.color || project?.color || '#4F46E5';
              const isCritical = criticalPath.has(t.id);
              const overdue = isOverdue(t);

              if (t.milestone) {
                // Diamond for milestone
                const cx = x + dayWidth / 2;
                const cy = y + BAR_HEIGHT / 2;
                return (
                  <g key={`bar-${t.id}`} className="cursor-pointer" onClick={() => onSelectTask(t.id)}
                    onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, task: t })}
                    onMouseLeave={() => setTooltip(null)}>
                    <polygon points={`${cx},${cy-10} ${cx+10},${cy} ${cx},${cy+10} ${cx-10},${cy}`}
                      fill={barColor} stroke={isCritical ? '#EF4444' : 'none'} strokeWidth="2" />
                  </g>
                );
              }

              return (
                <g key={`bar-${t.id}`}>
                  {/* Baseline bar (ghost) */}
                  {t.baseline_start && t.baseline_end && (
                    <rect
                      x={daysBetween(startDate, t.baseline_start) * dayWidth}
                      y={y + BAR_HEIGHT - 4}
                      width={Math.max(daysBetween(t.baseline_start, t.baseline_end) * dayWidth, dayWidth)}
                      height={4}
                      rx={2} fill={barColor} opacity="0.2"
                    />
                  )}

                  {/* Main bar background */}
                  <rect x={x} y={y} width={w} height={BAR_HEIGHT} rx={4}
                    fill={barColor} opacity="0.15"
                    stroke={isCritical ? '#EF4444' : overdue ? '#EF4444' : 'none'}
                    strokeWidth={isCritical || overdue ? 1.5 : 0}
                    strokeDasharray={overdue && !isCritical ? '3 2' : 'none'}
                    className="cursor-pointer"
                    onClick={() => onSelectTask(t.id)}
                    onMouseDown={(e) => handleMouseDown(e, t, 'move')}
                    onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, task: t })}
                    onMouseLeave={() => setTooltip(null)}
                  />

                  {/* Progress fill */}
                  <rect x={x} y={y} width={w * (t.percent_complete / 100)} height={BAR_HEIGHT} rx={4}
                    fill={barColor} opacity="0.6" className="pointer-events-none" />

                  {/* Bar label */}
                  {w > 60 && (
                    <text x={x + 6} y={y + BAR_HEIGHT / 2} dominantBaseline="central"
                      className="fill-white text-[10px] font-medium pointer-events-none" clipPath={`inset(0 0 0 0)`}>
                      {t.title.length > Math.floor(w / 7) ? t.title.slice(0, Math.floor(w / 7)) + '…' : t.title}
                    </text>
                  )}

                  {/* Resize handle */}
                  <rect x={x + w - 6} y={y} width={6} height={BAR_HEIGHT} rx={2}
                    fill="transparent" className="cursor-ew-resize"
                    onMouseDown={(e) => handleMouseDown(e, t, 'resize')} />
                </g>
              );
            })}

            {/* Dependency arrows */}
            {renderDependencyArrows()}
          </g>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-zinc-900 text-white px-3 py-2 rounded shadow-lg text-xs pointer-events-none max-w-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <div className="font-medium">{tooltip.task.title}</div>
          <div className="text-zinc-400 mt-1">
            {STATUS_CONFIG[tooltip.task.status]?.label} · {tooltip.task.percent_complete}% complete
          </div>
          <div className="text-zinc-400">
            {formatDate(tooltip.task.start_date)} → {formatDate(tooltip.task.end_date)}
          </div>
          {tooltip.task.duration_days && (
            <div className="text-zinc-400">{tooltip.task.duration_days} days</div>
          )}
          {isOverdue(tooltip.task) && <div className="text-red-400 font-medium">Overdue</div>}
        </div>
      )}
    </div>
  );
}
