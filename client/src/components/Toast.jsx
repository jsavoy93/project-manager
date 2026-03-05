const typeStyles = {
  info: 'bg-accent text-white',
  warning: 'bg-amber-500 text-white',
  error: 'bg-red-600 text-white',
  success: 'bg-emerald-600 text-white',
};

export default function Toast({ toasts }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-2.5 text-sm rounded shadow-lg animate-in ${typeStyles[t.type] || typeStyles.info}`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
