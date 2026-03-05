import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/', label: 'Projects', icon: '◫' },
  { to: '/team', label: 'Team', icon: '⊕' },
];

export default function Sidebar({ dark, onToggleTheme }) {
  return (
    <aside className="w-56 flex-shrink-0 bg-zinc-900 dark:bg-zinc-950 border-r border-zinc-800 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
          <span className="w-6 h-6 bg-accent rounded flex items-center justify-center text-white text-xs font-bold">P</span>
          ProjectManager
        </h1>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              'flex items-center gap-2.5 px-3 py-2 text-sm rounded transition-colors',
              isActive
                ? 'bg-accent/10 text-accent-300'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded transition-colors"
          aria-label="Toggle dark mode"
        >
          <span>{dark ? '☀' : '☾'}</span>
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <div className="mt-1 px-3 text-xs text-zinc-600 font-mono">
          Ctrl+K search
        </div>
      </div>
    </aside>
  );
}
