export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

export function isOverdue(task) {
  if (!task.end_date || task.status === 'done' || task.status === 'cancelled') return false;
  return new Date(task.end_date) < new Date(new Date().toISOString().split('T')[0]);
}

export function daysBetween(start, end) {
  if (!start || !end) return 0;
  return Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
}

export function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#4F46E5', '#0D9488', '#E11D48', '#F59E0B', '#8B5CF6', '#06B6D4', '#D946EF', '#84CC16'];
  return colors[Math.abs(hash) % colors.length];
}

export const STATUS_CONFIG = {
  todo: { label: 'To Do', color: 'bg-zinc-500', text: 'text-zinc-700 dark:text-zinc-300', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950' },
  blocked: { label: 'Blocked', color: 'bg-red-500', text: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950' },
  done: { label: 'Done', color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950' },
  cancelled: { label: 'Cancelled', color: 'bg-zinc-400', text: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
};

export const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#6B7280', border: 'border-l-zinc-400' },
  medium: { label: 'Medium', color: '#3B82F6', border: 'border-l-blue-500' },
  high: { label: 'High', color: '#F59E0B', border: 'border-l-amber-500' },
  critical: { label: 'Critical', color: '#EF4444', border: 'border-l-red-500' },
};

export const STATUS_ORDER = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'];
