export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

export async function getFeatures() {
  const res = await fetch(`${API_BASE}/api/features`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Unable to load features');
  return data;
}

export function getAuthToken() {
  return sessionStorage.getItem('lv_token') || '';
}

export function setAuthToken(token) {
  if (token) sessionStorage.setItem('lv_token', token);
  else sessionStorage.removeItem('lv_token');
}

function authHeader() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function register({ username, password }) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Registration failed');
  return data;
}

export async function login({ username, password }) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Login failed');
  return data;
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      ...authHeader()
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Not authenticated');
  return data;
}

export async function uploadShare({ text, file, expiresAt, password, oneTime, maxViews, maxDownloads }) {
  const form = new FormData();
  if (typeof text === 'string' && text.trim().length > 0) form.append('text', text);
  if (file) form.append('file', file);
  if (expiresAt) form.append('expiresAt', expiresAt);
  if (password) form.append('password', password);
  if (oneTime) form.append('oneTime', 'true');
  if (maxViews) form.append('maxViews', String(maxViews));
  if (maxDownloads) form.append('maxDownloads', String(maxDownloads));

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers: {
      ...authHeader()
    },
    body: form
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Upload failed');
  }
  return data;
}

export async function getShare(id) {
  const res = await fetch(`${API_BASE}/api/share/${encodeURIComponent(id)}`, {
    headers: {
      ...authHeader()
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to load share');
  }
  return data;
}

export async function getShareWithPassword(id, password) {
  const res = await fetch(`${API_BASE}/api/share/${encodeURIComponent(id)}`, {
    headers: {
      ...authHeader(),
      'x-share-password': password
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Unable to load share');
  }
  return data;
}

export async function downloadFile({ downloadUrl, password }) {
  const res = await fetch(`${API_BASE}${downloadUrl}`, {
    headers: {
      ...authHeader(),
      ...(password ? { 'x-share-password': password } : {})
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Download failed');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = /filename\*?=(?:UTF-8''|\")?([^;\"]+)/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1].replace(/\"/g, '').trim()) : 'download';
  return { blob, filename };
}

export async function deleteShare(id, { deleteToken } = {}) {
  const res = await fetch(`${API_BASE}/api/share/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      ...authHeader(),
      ...(deleteToken ? { 'x-delete-token': deleteToken } : {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Delete failed');
  return data;
}
