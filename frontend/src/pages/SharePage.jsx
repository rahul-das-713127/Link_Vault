import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { deleteShare, downloadFile, getShare, getShareWithPassword } from '../lib/api.js';
import useFeatures from '../lib/useFeatures.js';
import useAuth from '../lib/useAuth.js';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let idx = 0;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(v >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function SharePage() {
  const { id } = useParams();
  const { features } = useFeatures();
  const { user, logout } = useAuth({ enabled: features.auth });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [share, setShare] = useState(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [deleteToken, setDeleteToken] = useState(() => localStorage.getItem(`lv_delete_${id}`) || '');
  const [deleteStatus, setDeleteStatus] = useState('');

  useEffect(() => {
    setDeleteToken(localStorage.getItem(`lv_delete_${id}`) || '');
    setDeleteStatus('');
    setPassword('');
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError('');
        setNeedsPassword(false);
        const data = await getShare(id);
        if (!cancelled) setShare(data);
      } catch (err) {
        const msg = err?.message || 'Invalid or expired link.';
        if (!cancelled) {
          if (features.password && (msg === 'Password required.' || msg === 'Invalid password.')) {
            setNeedsPassword(true);
          }
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const expiresLabel = useMemo(() => {
    if (!share?.expiresAt) return '';
    try {
      return new Date(share.expiresAt).toLocaleString();
    } catch {
      return '';
    }
  }, [share]);

  async function copyText() {
    await navigator.clipboard.writeText(share?.text || '');
  }

  async function submitPassword(e) {
    e.preventDefault();
    setDeleteStatus('');
    try {
      setLoading(true);
      setError('');
      const data = await getShareWithPassword(id, password);
      setShare(data);
      setNeedsPassword(false);
    } catch (err) {
      setError(err?.message || 'Unable to load share');
      setNeedsPassword(true);
    } finally {
      setLoading(false);
    }
  }

  async function onDownload() {
    setDeleteStatus('');
    try {
      const { blob, filename } = await downloadFile({
        downloadUrl: share.downloadUrl,
        password: password || ''
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Download failed');
    }
  }

  async function onDelete() {
    setDeleteStatus('');
    setError('');
    try {
      await deleteShare(id, { deleteToken: deleteToken || undefined });
      localStorage.removeItem(`lv_delete_${id}`);
      setDeleteStatus('Deleted.');
      setShare(null);
    } catch (err) {
      setError(err?.message || 'Delete failed');
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LinkVault</h1>
            <p className="mt-1 text-sm text-slate-600">Secure share</p>
          </div>
          <div className="flex items-center gap-4">
            {features.auth && user ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-700">
                  Signed in as <span className="font-semibold">{user.username}</span>
                </p>
                <button type="button" className="text-sm font-medium underline" onClick={logout}>
                  Logout
                </button>
              </div>
            ) : features.auth ? (
              <Link className="text-sm font-medium underline" to={`/auth?next=${encodeURIComponent(`/s/${id}`)}`}>
                Login to delete
              </Link>
            ) : null}
            <Link className="text-sm font-medium underline" to="/">
              New upload
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading ? (
          <div className="rounded-xl border bg-white p-5 shadow-sm text-sm">Loading...</div>
        ) : features.password && needsPassword ? (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Password required</h2>
            <p className="mt-1 text-xs text-slate-600">Enter the password to view or download.</p>
            <form onSubmit={submitPassword} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Unlock
              </button>
            </form>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>
        ) : error ? (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-red-600">{error}</p>
            <p className="mt-2 text-xs text-slate-600">
              If this link has expired, the content is automatically deleted.
            </p>
          </div>
        ) : share?.kind === 'text' ? (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Text</h2>
                {expiresLabel ? (
                  <p className="mt-1 text-xs text-slate-600">Expires at {expiresLabel}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={copyText}
                className="rounded-lg border px-3 py-2 text-sm font-medium"
              >
                Copy
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-sm leading-relaxed">
              {share.text}
            </pre>

            {features.manualDelete ? (
              <div className="mt-4 rounded-lg border bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-700">Manual delete (optional)</p>
                <p className="mt-1 text-xs text-slate-600">
                  If this share was created while logged in, deletion requires the owner account. If it was created while logged out, a delete token may be saved automatically in the browser that created it.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    value={deleteToken}
                    onChange={(e) => setDeleteToken(e.target.value)}
                    placeholder="Delete token (optional if logged in)"
                  />
                  <button
                    type="button"
                    onClick={onDelete}
                    className="rounded-lg border px-4 py-2 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
                {deleteStatus ? <p className="mt-2 text-xs text-slate-700">{deleteStatus}</p> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">File</h2>
            {expiresLabel ? (
              <p className="mt-1 text-xs text-slate-600">Expires at {expiresLabel}</p>
            ) : null}

            <div className="mt-4 rounded-lg border bg-slate-50 p-4">
              <p className="text-sm font-medium break-all">{share.originalFilename}</p>
              <p className="mt-1 text-xs text-slate-600">
                {formatBytes(share.byteSize)}
                {share.mimeType ? ` • ${share.mimeType}` : ''}
              </p>
            </div>

            <button
              type="button"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              onClick={onDownload}
            >
              Download
            </button>

            {features.manualDelete ? (
              <div className="mt-4 rounded-lg border bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-700">Manual delete (optional)</p>
                <p className="mt-1 text-xs text-slate-600">
                  If this share was created while logged in, deletion requires the owner account. If it was created while logged out, a delete token may be saved automatically in the browser that created it.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    value={deleteToken}
                    onChange={(e) => setDeleteToken(e.target.value)}
                    placeholder="Delete token (optional if logged in)"
                  />
                  <button
                    type="button"
                    onClick={onDelete}
                    className="rounded-lg border px-4 py-2 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
                {deleteStatus ? <p className="mt-2 text-xs text-slate-700">{deleteStatus}</p> : null}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
