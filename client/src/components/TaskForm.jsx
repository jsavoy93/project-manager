import { useState } from 'react';
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUS_ORDER } from '../lib/utils';

export default function TaskForm({ projectId, groups, team, onSubmit, onClose }) {
  const [form, setForm] = useState({
    title: '', description: '', status: 'todo', priority: 'medium',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '', assigned_to: '', group_id: null,
    milestone: false, tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const addTag = () => {
    if (!tagInput.trim()) return;
    update('tags', [...form.tags, tagInput.trim()]);
    setTagInput('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
        className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-3">
        <h2 className="text-sm font-semibold">New Task</h2>

        <div>
          <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Title</label>
          <input value={form.title} onChange={e => update('title', e.target.value)} className="input text-sm" required autoFocus />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Description</label>
          <textarea value={form.description} onChange={e => update('description', e.target.value)} className="input text-xs" rows={3} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Status</label>
            <select value={form.status} onChange={e => update('status', e.target.value)} className="input text-xs">
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Priority</label>
            <select value={form.priority} onChange={e => update('priority', e.target.value)} className="input text-xs">
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Start Date</label>
            <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} className="input text-xs font-mono" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">End Date</label>
            <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} className="input text-xs font-mono" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Group</label>
          <select value={form.group_id || ''} onChange={e => update('group_id', e.target.value ? parseInt(e.target.value) : null)} className="input text-xs">
            <option value="">No group</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Assignees</label>
          <select onChange={e => {
            if (!e.target.value) return;
            const current = form.assigned_to ? form.assigned_to.split(',').filter(Boolean) : [];
            if (!current.includes(e.target.value)) update('assigned_to', [...current, e.target.value].join(','));
            e.target.value = '';
          }} className="input text-xs">
            <option value="">Add assignee...</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {form.assigned_to && (
            <div className="flex gap-1 mt-1">
              {form.assigned_to.split(',').filter(Boolean).map(id => {
                const m = team.find(t => t.id === parseInt(id));
                return m && <span key={id} className="badge bg-zinc-100 dark:bg-zinc-800 text-[10px]">{m.name}
                  <button type="button" onClick={() => update('assigned_to', form.assigned_to.split(',').filter(i => i !== id).join(','))} className="ml-1">×</button>
                </span>;
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-medium text-zinc-500 uppercase mb-1">Tags</label>
          <div className="flex gap-1 mb-1">
            {form.tags.map(t => (
              <span key={t} className="badge bg-zinc-100 dark:bg-zinc-800 text-[10px]">
                {t} <button type="button" onClick={() => update('tags', form.tags.filter(x => x !== t))} className="ml-1">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Add tag..." className="input text-xs flex-1" />
            <button type="button" onClick={addTag} className="btn-secondary text-xs">Add</button>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.milestone} onChange={e => update('milestone', e.target.checked)} className="rounded" />
          <span className="text-xs">Milestone</span>
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button type="submit" className="btn-primary text-xs">Create Task</button>
        </div>
      </form>
    </div>
  );
}
