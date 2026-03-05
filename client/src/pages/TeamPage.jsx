import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { CardSkeleton } from '../components/Skeleton';

export default function TeamPage({ addToast }) {
  const { data: members, loading, refetch } = useFetch(() => api.getTeam());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', avatar_color: '#4F46E5', role: '' });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', email: '', avatar_color: '#4F46E5', role: '' });
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({ name: m.name, email: m.email, avatar_color: m.avatar_color, role: m.role });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateMember(editing.id, form);
        addToast('Member updated', 'success');
      } else {
        await api.createMember(form);
        addToast('Member added', 'success');
      }
      setShowForm(false);
      refetch();
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this team member?')) return;
    try {
      await api.deleteMember(id);
      addToast('Member removed', 'success');
      refetch();
    } catch (err) { addToast(err.message, 'error'); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Team</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage team members and view workload</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Add Member</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {members?.map(m => (
            <div key={m.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full text-sm font-semibold flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: m.avatar_color }}>
                  {m.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{m.name}</h3>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(m)} className="btn-ghost text-xs p-1" aria-label="Edit">✎</button>
                      <button onClick={() => handleDelete(m.id)} className="btn-ghost text-xs p-1 text-red-500" aria-label="Delete">✕</button>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">{m.role}</div>
                  <div className="text-xs text-zinc-400 font-mono">{m.email}</div>

                  {/* Workload bar */}
                  {m.workload && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                        <span>{m.workload.total || 0} tasks</span>
                        {(m.workload.overdue || 0) > 0 && <span className="text-red-500">{m.workload.overdue} overdue</span>}
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        {(m.workload.done || 0) > 0 && <div className="bg-emerald-500" style={{ width: `${(m.workload.done / Math.max(m.workload.total, 1)) * 100}%` }} />}
                        {(m.workload.in_progress || 0) > 0 && <div className="bg-amber-500" style={{ width: `${(m.workload.in_progress / Math.max(m.workload.total, 1)) * 100}%` }} />}
                        {(m.workload.blocked || 0) > 0 && <div className="bg-red-500" style={{ width: `${(m.workload.blocked / Math.max(m.workload.total, 1)) * 100}%` }} />}
                      </div>
                      <div className="flex gap-3 mt-1 text-[10px]">
                        <span className="text-emerald-500">{m.workload.done || 0} done</span>
                        <span className="text-amber-500">{m.workload.in_progress || 0} active</span>
                        <span className="text-red-500">{m.workload.blocked || 0} blocked</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {members?.length === 0 && (
            <div className="col-span-full text-center py-12 text-zinc-500 text-sm">No team members yet.</div>
          )}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
            className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-base font-semibold">{editing ? 'Edit Member' : 'New Member'}</h2>
            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-500">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-500">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-500">Role</label>
              <input value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-500">Avatar Color</label>
              <input type="color" value={form.avatar_color} onChange={e => setForm(f => ({...f, avatar_color: e.target.value}))} className="w-8 h-8 rounded border cursor-pointer" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">{editing ? 'Update' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
