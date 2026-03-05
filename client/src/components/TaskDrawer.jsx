import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { useFetch } from '../hooks/useFetch';
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUS_ORDER, isOverdue, hashColor, formatDate } from '../lib/utils';

export default function TaskDrawer({ taskId, tasks, groups, team, onClose, onUpdate, onDelete, onRefetch, addToast }) {
  const [tab, setTab] = useState('details');
  const { data: task, refetch } = useFetch(() => api.getTask(taskId), [taskId]);
  const { data: comments, refetch: refetchComments } = useFetch(() => api.getComments(taskId), [taskId]);
  const { data: history } = useFetch(() => api.getHistory(taskId), [taskId]);
  const { data: allTags } = useFetch(() => api.getTags(), []);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descPreview, setDescPreview] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [newDepId, setNewDepId] = useState('');
  const [newDepType, setNewDepType] = useState('FS');
  const [newDepLag, setNewDepLag] = useState(0);
  const descTimer = useRef(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
    }
  }, [task]);

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Debounced description save
  const handleDescChange = useCallback((value) => {
    setDescription(value);
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(() => {
      onUpdate(taskId, { description: value });
    }, 1000);
  }, [taskId, onUpdate]);

  const handleFieldUpdate = async (field, value) => {
    await onUpdate(taskId, { [field]: value });
    refetch();
  };

  const handleAddTag = async () => {
    if (!tagInput.trim() || !task) return;
    const currentTags = task.tags?.map(t => t.tag) || [];
    if (currentTags.includes(tagInput.trim())) return;
    await onUpdate(taskId, { tags: [...currentTags, tagInput.trim()] });
    setTagInput('');
    refetch();
  };

  const handleRemoveTag = async (tagToRemove) => {
    if (!task) return;
    const currentTags = task.tags?.map(t => t.tag).filter(t => t !== tagToRemove) || [];
    await onUpdate(taskId, { tags: currentTags });
    refetch();
  };

  const handleAddDep = async () => {
    if (!newDepId) return;
    try {
      await api.addDependency(taskId, { predecessor_task_id: parseInt(newDepId), dependency_type: newDepType, lag_days: newDepLag });
      setNewDepId('');
      refetch();
      onRefetch();
      addToast('Dependency added', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleRemoveDep = async (depId) => {
    try {
      await api.removeDependency(depId);
      refetch();
      onRefetch();
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.addComment(taskId, { body: newComment, author_id: 1 });
      setNewComment('');
      refetchComments();
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleSaveAsTemplate = async () => {
    try {
      await api.saveAsTemplate(taskId);
      addToast('Task saved as template', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  if (!task) return null;

  const overdue = isOverdue(task);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400">#{task.id}</span>
              {overdue && <span className="badge bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-[10px]">Overdue</span>}
              {task.milestone && <span className="text-amber-500">◆</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleSaveAsTemplate} className="btn-ghost text-xs" title="Save as template">⧉</button>
              <button onClick={() => { if (confirm('Delete this task?')) { onDelete(taskId); onClose(); } }}
                className="btn-ghost text-xs text-red-500" title="Delete task">✕</button>
              <button onClick={onClose} className="btn-ghost text-xs ml-1" aria-label="Close">←</button>
            </div>
          </div>

          {/* Title */}
          {editingTitle ? (
            <input value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => { setEditingTitle(false); handleFieldUpdate('title', title); }}
              onKeyDown={e => { if (e.key === 'Enter') { setEditingTitle(false); handleFieldUpdate('title', title); } }}
              className="w-full mt-2 text-base font-semibold bg-transparent border-b border-accent focus:outline-none"
              autoFocus />
          ) : (
            <h2 className="mt-2 text-base font-semibold cursor-pointer hover:text-accent" onClick={() => setEditingTitle(true)}>
              {task.title}
            </h2>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 flex gap-0">
          {['details', 'dependencies', 'comments', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'border-accent text-accent' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}>
              {t}
              {t === 'comments' && comments?.length > 0 && (
                <span className="ml-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{comments.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {tab === 'details' && (
            <>
              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Status</label>
                  <select value={task.status} onChange={e => handleFieldUpdate('status', e.target.value)} className="input text-xs">
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Priority</label>
                  <select value={task.priority} onChange={e => handleFieldUpdate('priority', e.target.value)} className="input text-xs">
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Start Date</label>
                  <input type="date" value={task.start_date || ''} onChange={e => handleFieldUpdate('start_date', e.target.value)} className="input text-xs font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">End Date</label>
                  <input type="date" value={task.end_date || ''} onChange={e => handleFieldUpdate('end_date', e.target.value)} className="input text-xs font-mono" />
                </div>
              </div>
              {task.duration_days != null && (
                <div className="text-xs text-zinc-400 font-mono">Duration: {task.duration_days} days</div>
              )}

              {/* % Complete */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Progress ({task.percent_complete}%)</label>
                <input type="range" min="0" max="100" step="5" value={task.percent_complete}
                  onChange={e => handleFieldUpdate('percent_complete', parseInt(e.target.value))}
                  className="w-full accent-accent" />
              </div>

              {/* Assignees */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Assignees</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {task.assignees?.map(a => (
                    <span key={a.id} className="inline-flex items-center gap-1 badge bg-zinc-100 dark:bg-zinc-800">
                      <span className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center text-white" style={{ backgroundColor: a.avatar_color }}>
                        {a.name.charAt(0)}
                      </span>
                      <span className="text-[10px]">{a.name}</span>
                      <button onClick={() => {
                        const ids = task.assigned_to.split(',').filter(id => id !== String(a.id)).join(',');
                        handleFieldUpdate('assigned_to', ids);
                      }} className="text-zinc-400 hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                </div>
                <select onChange={e => {
                  if (!e.target.value) return;
                  const current = task.assigned_to ? task.assigned_to.split(',').filter(Boolean) : [];
                  if (!current.includes(e.target.value)) {
                    handleFieldUpdate('assigned_to', [...current, e.target.value].join(','));
                  }
                  e.target.value = '';
                }} className="input text-xs">
                  <option value="">Add assignee...</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Tags</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {task.tags?.map(t => (
                    <span key={t.id} className="badge text-[10px]" style={{ backgroundColor: hashColor(t.tag) + '20', color: hashColor(t.tag) }}>
                      {t.tag}
                      <button onClick={() => handleRemoveTag(t.tag)} className="ml-1 hover:opacity-70">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
                    placeholder="Add tag..." className="input text-xs flex-1"
                    list="tag-suggestions" />
                  <datalist id="tag-suggestions">
                    {allTags?.map(t => <option key={t.tag} value={t.tag} />)}
                  </datalist>
                  <button onClick={handleAddTag} className="btn-secondary text-xs">Add</button>
                </div>
              </div>

              {/* Group */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Group</label>
                <select value={task.group_id || ''} onChange={e => handleFieldUpdate('group_id', e.target.value ? parseInt(e.target.value) : null)} className="input text-xs">
                  <option value="">No group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {/* Milestone toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!task.milestone} onChange={e => handleFieldUpdate('milestone', e.target.checked)}
                  className="rounded accent-accent" />
                <span className="text-xs">Milestone</span>
              </label>

              {/* Recurrence */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Recurrence</label>
                <select value={task.recurrence || ''} onChange={e => handleFieldUpdate('recurrence', e.target.value || null)} className="input text-xs">
                  <option value="">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Color override */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Color Override</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={task.color || '#4F46E5'} onChange={e => handleFieldUpdate('color', e.target.value)}
                    className="w-7 h-7 rounded border cursor-pointer" />
                  {task.color && <button onClick={() => handleFieldUpdate('color', null)} className="text-xs text-zinc-400 hover:text-zinc-600">Clear</button>}
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-zinc-500 uppercase">Description</label>
                  <button onClick={() => setDescPreview(!descPreview)} className="text-[10px] text-zinc-400 hover:text-zinc-600">
                    {descPreview ? 'Edit' : 'Preview'}
                  </button>
                </div>
                {descPreview ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs p-3 bg-zinc-50 dark:bg-zinc-800 rounded min-h-[80px]"
                    dangerouslySetInnerHTML={{ __html: description.replace(/\n/g, '<br/>') }} />
                ) : (
                  <textarea value={description} onChange={e => handleDescChange(e.target.value)}
                    placeholder="Add description (markdown supported)..."
                    className="input text-xs font-mono min-h-[80px]" rows={4} />
                )}
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Attachments</label>
                {(() => {
                  let attachments = [];
                  try { attachments = JSON.parse(task.attachments || '[]'); } catch {}
                  return (
                    <div className="space-y-1">
                      {attachments.map((a, i) => (
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-accent hover:underline">
                          📎 {a.name} {a.size && <span className="text-zinc-400">({a.size})</span>}
                        </a>
                      ))}
                      {attachments.length === 0 && <span className="text-xs text-zinc-400">No attachments</span>}
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {tab === 'dependencies' && (
            <>
              <div>
                <h4 className="text-xs font-semibold mb-2">Predecessors</h4>
                {task.dependencies?.length > 0 ? (
                  <div className="space-y-1">
                    {task.dependencies.map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 rounded px-2 py-1.5">
                        <span className="text-xs">
                          <span className="font-mono text-zinc-400">#{d.predecessor_task_id}</span> {d.predecessor_title}
                          <span className="ml-1 badge bg-zinc-200 dark:bg-zinc-700 text-[10px]">{d.dependency_type}</span>
                          {d.lag_days !== 0 && <span className="ml-1 text-zinc-400 text-[10px]">{d.lag_days > 0 ? '+' : ''}{d.lag_days}d</span>}
                        </span>
                        <button onClick={() => handleRemoveDep(d.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-zinc-400">No predecessors</p>}
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-2">Successors</h4>
                {task.successors?.length > 0 ? (
                  <div className="space-y-1">
                    {task.successors.map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 rounded px-2 py-1.5">
                        <span className="text-xs">
                          <span className="font-mono text-zinc-400">#{d.successor_task_id}</span> {d.successor_title}
                          <span className="ml-1 badge bg-zinc-200 dark:bg-zinc-700 text-[10px]">{d.dependency_type}</span>
                        </span>
                        <button onClick={() => handleRemoveDep(d.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-zinc-400">No successors</p>}
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
                <h4 className="text-xs font-semibold mb-2">Add Predecessor</h4>
                <div className="flex gap-2">
                  <select value={newDepId} onChange={e => setNewDepId(e.target.value)} className="input text-xs flex-1">
                    <option value="">Select task...</option>
                    {tasks.filter(t => t.id !== taskId).map(t => <option key={t.id} value={t.id}>#{t.id} {t.title}</option>)}
                  </select>
                  <select value={newDepType} onChange={e => setNewDepType(e.target.value)} className="input text-xs w-16">
                    <option value="FS">FS</option>
                    <option value="SS">SS</option>
                    <option value="FF">FF</option>
                    <option value="SF">SF</option>
                  </select>
                  <input type="number" value={newDepLag} onChange={e => setNewDepLag(parseInt(e.target.value) || 0)}
                    className="input text-xs w-16" placeholder="Lag" />
                  <button onClick={handleAddDep} className="btn-primary text-xs">Add</button>
                </div>
              </div>
            </>
          )}

          {tab === 'comments' && (
            <>
              <div className="space-y-3">
                {comments?.map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full text-[9px] flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: c.author_color || '#6B7280' }}>
                      {(c.author_name || '?').charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium">{c.author_name || 'Unknown'}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{c.body}</p>
                    </div>
                  </div>
                ))}
                {(!comments || comments.length === 0) && (
                  <p className="text-xs text-zinc-400">No comments yet</p>
                )}
              </div>
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  placeholder="Write a comment..." className="input text-xs" rows={3} />
                <button onClick={handleAddComment} className="btn-primary text-xs mt-2">Post Comment</button>
              </div>
            </>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              {history?.map(h => (
                <div key={h.id} className="flex items-start gap-2 text-xs">
                  <span className="text-zinc-300 dark:text-zinc-700 mt-0.5">●</span>
                  <div>
                    <span className="font-medium">{h.field_changed}</span> changed
                    {h.old_value && <> from <span className="font-mono text-zinc-400">{h.old_value}</span></>}
                    {h.new_value && <> to <span className="font-mono text-accent">{h.new_value}</span></>}
                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      {new Date(h.changed_at).toLocaleString()} by {h.changed_by}
                    </div>
                  </div>
                </div>
              ))}
              {(!history || history.length === 0) && (
                <p className="text-xs text-zinc-400">No history yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
