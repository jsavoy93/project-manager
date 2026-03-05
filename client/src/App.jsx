import { Routes, Route } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from './hooks/useTheme';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import TeamPage from './pages/TeamPage';
import Sidebar from './components/Sidebar';
import SearchModal from './components/SearchModal';
import Toast from './components/Toast';
import { api } from './lib/api';
import { isOverdue } from './lib/utils';

export default function App() {
  const { dark, toggle } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Due date alerts on load
  useEffect(() => {
    (async () => {
      try {
        const projects = await api.getProjects();
        for (const p of projects) {
          const tasks = await api.getTasks(p.id);
          const soon = tasks.filter(t => {
            if (!t.end_date || t.status === 'done' || t.status === 'cancelled') return false;
            const days = Math.round((new Date(t.end_date) - new Date()) / (1000*60*60*24));
            return days >= 0 && days <= 3;
          });
          if (soon.length > 0) {
            addToast(`${soon.length} task(s) due within 3 days in "${p.name}"`, 'warning');
          }
          const overdue = tasks.filter(isOverdue);
          if (overdue.length > 0) {
            addToast(`${overdue.length} overdue task(s) in "${p.name}"`, 'error');
          }
        }
      } catch {}
    })();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar dark={dark} onToggleTheme={toggle} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard addToast={addToast} />} />
          <Route path="/projects/:id" element={<ProjectView addToast={addToast} />} />
          <Route path="/team" element={<TeamPage addToast={addToast} />} />
        </Routes>
      </main>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <Toast toasts={toasts} />
    </div>
  );
}
