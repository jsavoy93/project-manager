import { STATUS_ORDER, STATUS_CONFIG, PRIORITY_CONFIG } from '../lib/utils';

export default function FilterBar({ filters, setFilters, groups, team }) {
  const update = (key, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <select value={filters.status || ''} onChange={e => update('status', e.target.value)} className="input w-auto text-xs py-1">
        <option value="">All Statuses</option>
        {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
      </select>
      <select value={filters.priority || ''} onChange={e => update('priority', e.target.value)} className="input w-auto text-xs py-1">
        <option value="">All Priorities</option>
        {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <select value={filters.group_id || ''} onChange={e => update('group_id', e.target.value)} className="input w-auto text-xs py-1">
        <option value="">All Groups</option>
        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <select value={filters.assignee || ''} onChange={e => update('assignee', e.target.value)} className="input w-auto text-xs py-1">
        <option value="">All Assignees</option>
        {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      {hasFilters && (
        <button onClick={() => setFilters({})} className="btn-ghost text-xs text-red-500">Clear filters</button>
      )}
    </div>
  );
}
