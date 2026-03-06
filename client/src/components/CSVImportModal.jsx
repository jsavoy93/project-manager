import { useState, useRef, useCallback } from 'react';
import { api } from '../lib/api';

const EXPECTED_HEADERS = [
  'title', 'description', 'status', 'priority',
  'start_date', 'end_date', 'percent_complete',
  'group', 'tags', 'milestone', 'assigned_to',
  'predecessors', 'successors',
  'color', 'baseline_start', 'baseline_end', 'recurrence',
];

function parsePreviewRows(csvText, maxRows = 5) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 1) return { headers: [], rows: [] };

  function splitLine(line) {
    const fields = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { fields.push(cur); cur = ''; }
      else cur += ch;
    }
    fields.push(cur);
    return fields;
  }

  const headers = splitLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i <= Math.min(maxRows, lines.length - 1); i++) {
    const vals = splitLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = vals[j] ?? '';
    rows.push(row);
  }
  return { headers, rows, totalRows: lines.length - 1 };
}

export default function CSVImportModal({ projectId, onClose, onImported }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('append');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const loadFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'text/plain') {
      setPreview({ error: 'Please select a .csv file.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setCsvText(text);
      setPreview(parsePreviewRows(text));
      setResult(null);
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e) => loadFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    if (!csvText) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.importCSV(projectId, csvText, mode);
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const knownHeaders = preview?.headers?.map(h => h.toLowerCase()) ?? [];
  const missingRequired = csvText && !knownHeaders.includes('title');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Import Tasks from CSV</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Format note */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-3 space-y-1.5">
            <p className="font-medium text-zinc-700 dark:text-zinc-300">Supported CSV columns</p>
            <p className="font-mono leading-relaxed break-all">{EXPECTED_HEADERS.join(', ')}</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li><span className="font-semibold">title</span> is required; all other columns are optional.</li>
              <li><span className="font-semibold">status</span>: todo · in_progress · blocked · done · cancelled</li>
              <li><span className="font-semibold">priority</span>: low · medium · high · critical</li>
              <li><span className="font-semibold">predecessors / successors</span>: task title or row number, with optional type and lag — e.g. <span className="font-mono">Design Phase(FS)</span> or <span className="font-mono">1(SS:2)</span>. Separate multiple with <span className="font-mono">;</span></li>
              <li><span className="font-semibold">assigned_to / tags</span>: semicolon-separated values</li>
              <li><span className="font-semibold">group</span>: group name; new groups are created automatically</li>
            </ul>
            <button
              onClick={() => api.downloadImportTemplate(projectId)}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium mt-1 inline-block"
            >
              Download template CSV ↓
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors select-none ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-500'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {csvText
                ? <span className="text-green-600 dark:text-green-400 font-medium">File loaded — {preview?.totalRows ?? 0} data rows</span>
                : <><span className="font-medium text-zinc-700 dark:text-zinc-300">Click to choose</span> or drag &amp; drop a CSV file</>
              }
            </p>
            {csvText && (
              <button
                onClick={(e) => { e.stopPropagation(); setCsvText(''); setPreview(null); setResult(null); fileInputRef.current.value = ''; }}
                className="mt-2 text-xs text-zinc-400 hover:text-red-500 underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Preview table */}
          {preview && !preview.error && preview.rows?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Preview — first {preview.rows.length} of {preview.totalRows} rows
              </p>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="text-xs w-full">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    <tr>
                      {preview.headers.map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="bg-white dark:bg-zinc-900">
                        {preview.headers.map(h => (
                          <td key={h} className="px-2 py-1.5 text-zinc-700 dark:text-zinc-300 max-w-[180px] truncate" title={row[h]}>
                            {row[h] || <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {missingRequired && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  ⚠ No "title" column found. Import will fail — check your CSV headers.
                </p>
              )}
            </div>
          )}

          {preview?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{preview.error}</p>
          )}

          {/* Import mode */}
          {csvText && (
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Import mode:</span>
              {[
                { value: 'append', label: 'Append', description: 'Add to existing tasks' },
                { value: 'replace', label: 'Replace', description: 'Delete all existing tasks first' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="import-mode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => setMode(opt.value)}
                    className="accent-indigo-600"
                  />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{opt.label}</span>
                  <span className="text-zinc-400">— {opt.description}</span>
                </label>
              ))}
            </div>
          )}

          {/* Result */}
          {result && !result.error && (
            <div className={`rounded-lg p-3 text-sm ${result.errors?.length > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300' : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'}`}>
              <p className="font-medium">
                Import complete — {result.imported} task{result.imported !== 1 ? 's' : ''} created
                {result.errors?.length > 0 ? `, ${result.errors.length} row${result.errors.length !== 1 ? 's' : ''} skipped` : ''}
              </p>
              {result.errors?.length > 0 && (
                <ul className="mt-2 text-xs space-y-0.5 list-disc list-inside">
                  {result.errors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">Error: {result.error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">
            {result?.imported > 0 ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleImport}
            disabled={!csvText || loading || missingRequired || !!result?.imported}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {loading ? 'Importing…' : `Import${preview?.totalRows ? ` ${preview.totalRows} rows` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
