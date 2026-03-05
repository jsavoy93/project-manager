import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { CardSkeleton } from '../components/Skeleton';

export default function Dashboard({ addToast }) {
  const { data: projects, loading, refetch } = useFetch(() => api.getProjects());
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#4F46E5' });

  const openNew = () => {
    setEditingProject(null);
    setForm({ name: '', description: '', color: '#4F46E5' });
    setShowForm(true);
  };

  const openEdit = (p, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProject(p);
    setForm({ name: p.name, description: p.description, color: p.color });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await api.updateProject(editingProject.id, form);
        addToast('Project updated', 'success');
      } else {
        await api.createProject(form);
        addToast('Project created', 'success');
      }
      setShowForm(false);
      refetch();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this project and all its tasks?')) return;
    try {
      await api.deleteProject(id);
      addToast('Project deleted', 'success');
      refetch();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage your projects and track progress</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ New Project</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map(p => {
            const progress = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="card p-4 hover:border-accent/50 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
                    <h3 className="font-medium text-sm">{p.name}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => openEdit(p, e)} className="btn-ghost p-1 text-xs" aria-label="Edit project">✎</button>
                    <button onClick={(e) => handleDelete(p.id, e)} className="btn-ghost p-1 text-xs text-red-500" aria-label="Delete project">✕</button>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2">{p.description}</p>
                <div className="mt-3 flex items-center gap-3">
                  {/* Progress ring */}
                  <svg width="36" height="36" viewBox="0 0 36 36" className="flex-shrink-0">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-zinc-200 dark:text-zinc-800" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke={p.color} strokeWidth="3"
                      strokeDasharray={`${progress * 0.942} 94.2`}
                      strokeLinecap="round" transform="rotate(-90 18 18)" />
                    <text x="18" y="18" textAnchor="middle" dominantBaseline="central" className="fill-current text-[9px] font-mono font-medium">{progress}%</text>
                  </svg>
                  <div className="text-xs text-zinc-500 space-y-0.5">
                    <div>{p.task_count} tasks</div>
                    <div>{p.done_count} completed</div>
                    {p.overdue_count > 0 && <div className="text-red-500">{p.overdue_count} overdue</div>}
                  </div>
                </div>
              </Link>
            );
          })}
          {projects?.length === 0 && (
            <div className="col-span-full text-center py-12 text-zinc-500 text-sm">
              No projects yet. Create your first project to get started.
            </div>
          )}
        </div>
      )}

      {/* Project Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <form
            onSubmit={handleSubmit}
            onClick={e => e.stopPropagation()}
            className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-xl p-6 w-full max-w-md space-y-4"
          >
            <h2 className="text-base font-semibold">{editingProject ? 'Edit Project' : 'New Project'}</h2>
            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-500">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-500">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="input" rows={3} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-zinc-500">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm(f => ({...f, color: e.target.value}))} className="w-8 h-8 rounded border cursor-pointer" />
                <span className="text-xs font-mono text-zinc-500">{form.color}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">{editingProject ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
