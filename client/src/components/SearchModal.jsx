import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { STATUS_CONFIG } from '../lib/utils';

export default function SearchModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query);
        setResults(data);
      } catch {} finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-zinc-400 text-sm">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, descriptions, tags..."
            className="flex-1 bg-transparent text-sm focus:outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
          />
          <kbd className="text-xs px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded border border-zinc-200 dark:border-zinc-700">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading && <div className="p-4 text-sm text-zinc-500">Searching...</div>}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="p-4 text-sm text-zinc-500">No results found</div>
          )}
          {results.map(task => (
            <button
              key={task.id}
              onClick={() => { navigate(`/projects/${task.project_id}`); onClose(); }}
              className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[task.status]?.color}`} />
                <span className="text-sm font-medium truncate">{task.title}</span>
                <span className="ml-auto text-xs text-zinc-400 font-mono">#{task.id}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5 truncate">{task.project_name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
