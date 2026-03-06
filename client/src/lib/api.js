const BASE = '/api/v1';

async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('json')) return res.json();
  return res;
}

export const api = {
  // Projects
  getProjects: () => request('/projects'),
  createProject: (data) => request('/projects', { method: 'POST', body: data }),
  getProject: (id) => request(`/projects/${id}`),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: data }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (projectId, params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/projects/${projectId}/tasks${qs ? '?' + qs : ''}`);
  },
  createTask: (projectId, data) => request(`/projects/${projectId}/tasks`, { method: 'POST', body: data }),
  getTask: (id) => request(`/tasks/${id}`),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  toggleComplete: (id) => request(`/tasks/${id}/complete`, { method: 'PATCH' }),
  saveAsTemplate: (id) => request(`/tasks/${id}/template`, { method: 'POST' }),
  getTemplates: (projectId) => request(`/projects/${projectId}/templates`),

  // Groups
  getGroups: (projectId) => request(`/projects/${projectId}/groups`),
  createGroup: (projectId, data) => request(`/projects/${projectId}/groups`, { method: 'POST', body: data }),
  updateGroup: (id, data) => request(`/groups/${id}`, { method: 'PUT', body: data }),
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),

  // Dependencies
  addDependency: (taskId, data) => request(`/tasks/${taskId}/dependencies`, { method: 'POST', body: data }),
  removeDependency: (id) => request(`/dependencies/${id}`, { method: 'DELETE' }),

  // Comments
  getComments: (taskId) => request(`/tasks/${taskId}/comments`),
  addComment: (taskId, data) => request(`/tasks/${taskId}/comments`, { method: 'POST', body: data }),
  deleteComment: (id) => request(`/comments/${id}`, { method: 'DELETE' }),

  // Team
  getTeam: () => request('/team'),
  createMember: (data) => request('/team', { method: 'POST', body: data }),
  updateMember: (id, data) => request(`/team/${id}`, { method: 'PUT', body: data }),
  deleteMember: (id) => request(`/team/${id}`, { method: 'DELETE' }),

  // Search
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
  getTags: () => request('/tags'),

  // History
  getHistory: (taskId) => request(`/tasks/${taskId}/history`),

  // Export
  exportExcel: (projectId) => {
    window.open(BASE + `/projects/${projectId}/export/excel`);
  },
  exportCSV: (projectId) => {
    window.open(BASE + `/projects/${projectId}/export/tasks`);
  },

  // Import
  importCSV: (projectId, csvText, mode = 'append') =>
    request(`/projects/${projectId}/import/tasks`, {
      method: 'POST',
      body: { csv: csvText, mode },
    }),
  downloadImportTemplate: (projectId) => {
    window.open(BASE + `/projects/${projectId}/import/template`);
  },
};
