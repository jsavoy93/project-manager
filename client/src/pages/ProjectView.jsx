import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../hooks/useFetch';
import { useUndoRedo } from '../hooks/useUndoRedo';
import GanttChart from '../components/GanttChart';
import KanbanBoard from '../components/KanbanBoard';
import ListView from '../components/ListView';
import TaskDrawer from '../components/TaskDrawer';
import TaskForm from '../components/TaskForm';
import FilterBar from '../components/FilterBar';
import CSVImportModal from '../components/CSVImportModal';
import { Skeleton } from '../components/Skeleton';

export default function ProjectView({ addToast }) {
  const { id } = useParams();
  const [view, setView] = useState('gantt');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filters, setFilters] = useState({});
  const [zoom, setZoom] = useState('week');

  const { data: project, loading: projLoading } = useFetch(() => api.getProject(id), [id]);
  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useFetch(() => api.getTasks(id, filters), [id, JSON.stringify(filters)]);
  const { data: groups, refetch: refetchGroups } = useFetch(() => api.getGroups(id), [id]);
  const { data: team } = useFetch(() => api.getTeam(), []);
  const { pushAction, undo, redo, canUndo, canRedo } = useUndoRedo();

  const handleUpdateTask = useCallback(async (taskId, updates) => {
    const oldTask = tasks?.find(t => t.id === taskId);
    if (!oldTask) return;

    // Optimistic update
    try {
      const result = await api.updateTask(taskId, updates);
      pushAction({
        description: `Update task ${taskId}`,
        undo: async () => {
          const revertData = {};
          for (const key of Object.keys(updates)) revertData[key] = oldTask[key];
          await api.updateTask(taskId, revertData);
          refetchTasks();
        },
        redo: async () => {
          await api.updateTask(taskId, updates);
          refetchTasks();
        },
      });
      refetchTasks();
      return result;
    } catch (err) {
      addToast(err.message, 'error');
      refetchTasks();
    }
  }, [tasks, pushAction, refetchTasks, addToast]);

  const handleDeleteTask = useCallback(async (taskId) => {
    try {
      await api.deleteTask(taskId);
      setSelectedTaskId(null);
      addToast('Task deleted', 'success');
      refetchTasks();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }, [addToast, refetchTasks]);

  const handleCreateTask = useCallback(async (data) => {
    try {
      await api.createTask(id, data);
      setShowNewTask(false);
      addToast('Task created', 'success');
      refetchTasks();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }, [id, addToast, refetchTasks]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      switch (e.key) {
        case 'n': case 'N': setShowNewTask(true); break;
        case 'g': case 'G': setView('gantt'); break;
        case 'k': case 'K': setView('kanban'); break;
        case 'l': case 'L': setView('list'); break;
        case 'e': case 'E': api.exportExcel(id); break;
        case 'Escape': setSelectedTaskId(null); setShowNewTask(false); break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [id, undo, redo]);

  if (projLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-96 w-full" />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">Projects</Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="font-medium flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: project?.color }} />
              {project?.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <button onClick={undo} disabled={!canUndo} className="btn-ghost text-xs" aria-label="Undo" title="Undo (Ctrl+Z)">↩</button>
            <button onClick={redo} disabled={!canRedo} className="btn-ghost text-xs" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">↪</button>

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

            {/* View toggle */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded p-0.5">
              {[
                { key: 'gantt', label: 'Gantt', shortcut: 'G' },
                { key: 'kanban', label: 'Cards', shortcut: 'K' },
                { key: 'list', label: 'List', shortcut: 'L' },
              ].map(v => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    view === v.key ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Zoom (Gantt only) */}
            {view === 'gantt' && (
              <select
                value={zoom}
                onChange={e => setZoom(e.target.value)}
                className="input w-auto text-xs py-1"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
              </select>
            )}

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

            {/* Import */}
            <button onClick={() => setShowImport(true)} className="btn-secondary text-xs">Import CSV</button>

            {/* Export */}
            <div className="relative group">
              <button className="btn-secondary text-xs">Export ▾</button>
              <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg hidden group-hover:block z-10">
                <button onClick={() => api.exportExcel(id)} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">Excel (.xlsx)</button>
                <button onClick={() => api.exportCSV(id)} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">CSV (importable)</button>
              </div>
            </div>

            <button onClick={() => setShowNewTask(true)} className="btn-primary text-xs">+ Task</button>
          </div>
        </div>

        {/* Filter bar */}
        <FilterBar filters={filters} setFilters={setFilters} groups={groups || []} team={team || []} />
      </div>

      {/* View content */}
      <div className="flex-1 overflow-hidden">
        {tasksLoading ? (
          <div className="p-6"><Skeleton className="h-96 w-full" /></div>
        ) : view === 'gantt' ? (
          <GanttChart
            tasks={tasks || []}
            groups={groups || []}
            zoom={zoom}
            project={project}
            onSelectTask={setSelectedTaskId}
            onUpdateTask={handleUpdateTask}
          />
        ) : view === 'kanban' ? (
          <KanbanBoard
            tasks={tasks || []}
            groups={groups || []}
            team={team || []}
            onSelectTask={setSelectedTaskId}
            onUpdateTask={handleUpdateTask}
          />
        ) : (
          <ListView
            tasks={tasks || []}
            groups={groups || []}
            team={team || []}
            onSelectTask={setSelectedTaskId}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
          />
        )}
      </div>

      {/* Task drawer */}
      {selectedTaskId && (
        <TaskDrawer
          taskId={selectedTaskId}
          tasks={tasks || []}
          groups={groups || []}
          team={team || []}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onRefetch={refetchTasks}
          addToast={addToast}
        />
      )}

      {/* CSV import modal */}
      {showImport && (
        <CSVImportModal
          projectId={id}
          onClose={() => setShowImport(false)}
          onImported={() => { refetchTasks(); refetchGroups(); addToast('Tasks imported successfully', 'success'); }}
        />
      )}

      {/* New task modal */}
      {showNewTask && (
        <TaskForm
          projectId={id}
          groups={groups || []}
          team={team || []}
          onSubmit={handleCreateTask}
          onClose={() => setShowNewTask(false)}
        />
      )}
    </div>
  );
}
