import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { uploadShare } from '../lib/api.js';
import useFeatures from '../lib/useFeatures.js';
import useAuth from '../lib/useAuth.js';

function formatLocalDateTimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default function UploadPage() {
  const { features } = useFeatures();
  const { user, logout } = useAuth({ enabled: features.auth });
  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sharePassword, setSharePassword] = useState('');
  const [oneTime, setOneTime] = useState(false);
  const [maxViews, setMaxViews] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [useExpiry, setUseExpiry] = useState(false);
  const [expiresAtLocal, setExpiresAtLocal] = useState(() => {
    const d = new Date(Date.now() + 10 * 60 * 1000);
    return formatLocalDateTimeInputValue(d);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const expiryError = useMemo(() => {
    if (!useExpiry) return '';
    const ms = Date.parse(expiresAtLocal);
    if (Number.isNaN(ms)) return 'Invalid expiry date/time.';
    if (ms <= Date.now()) return 'Expiry must be in the future.';
    return '';
  }, [useExpiry, expiresAtLocal]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (expiryError) return false;
    if (mode === 'text') return text.trim().length > 0;
    return !!file;
  }, [loading, mode, text, file, expiryError]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setShareUrl('');

    if (expiryError) {
      setError(expiryError);
      return;
    }

    try {
      setLoading(true);
      const payload = {
        text: mode === 'text' ? text : '',
        file: mode === 'file' ? file : null,
        expiresAt: useExpiry ? new Date(expiresAtLocal).toISOString() : '',
        password: features.password ? sharePassword : '',
        oneTime: features.oneTime ? oneTime : false,
        maxViews: features.limits && maxViews ? Number(maxViews) : null,
        maxDownloads: features.limits && maxDownloads ? Number(maxDownloads) : null
      };
      const res = await uploadShare(payload);
      const url = `${window.location.origin}/s/${res.id}`;
      setShareUrl(url);

      if (res.deleteToken && !(features.auth && user)) {
        localStorage.setItem(`lv_delete_${res.id}`, res.deleteToken);
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LinkVault</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload text or a file and get a secure shareable link.
          </p>
          </div>
          {features.auth ? (
            user ? (
              <div className="flex flex-col items-end gap-2">
                <p className="text-sm text-slate-700">
                  Signed in as <span className="font-semibold">{user.username}</span>
                </p>
                <button
                  type="button"
                  className="text-sm font-medium underline"
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link className="text-sm font-medium underline" to="/auth">
                Login / Register
              </Link>
            )
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <form onSubmit={onSubmit} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium border ${
                mode === 'text' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
              }`}
              onClick={() => setMode('text')}
            >
              Text
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium border ${
                mode === 'file' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
              }`}
              onClick={() => setMode('file')}
            >
              File
            </button>
          </div>

          <div className="mt-4">
            {mode === 'text' ? (
              <textarea
                className="h-48 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Paste your text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            ) : (
              <input
                type="file"
                className="block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useExpiry}
                onChange={(e) => setUseExpiry(e.target.checked)}
              />
              Set expiry
            </label>

            <input
              type="datetime-local"
              disabled={!useExpiry}
              value={expiresAtLocal}
              onChange={(e) => setExpiresAtLocal(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>

          {expiryError ? <p className="mt-3 text-sm text-red-600">{expiryError}</p> : null}

          {features.password || features.oneTime || features.limits ? (
            <div className="mt-4 rounded-lg border bg-slate-50 p-4">
              <p className="text-sm font-semibold">Optional link protections</p>

              <div className="mt-3 grid gap-3">
                {features.password ? (
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-700">Password (optional)</span>
                    <input
                      className="rounded-lg border bg-white px-3 py-2 text-sm"
                      value={sharePassword}
                      onChange={(e) => setSharePassword(e.target.value)}
                      placeholder="Leave empty for no password"
                    />
                  </label>
                ) : null}

                {features.oneTime ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={oneTime}
                      onChange={(e) => setOneTime(e.target.checked)}
                    />
                    One-time link (deleted after first view/download)
                  </label>
                ) : null}

                {features.limits ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Max views (optional)</span>
                      <input
                        className="rounded-lg border bg-white px-3 py-2 text-sm"
                        value={maxViews}
                        onChange={(e) => setMaxViews(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 5"
                        inputMode="numeric"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">Max downloads (optional)</span>
                      <input
                        className="rounded-lg border bg-white px-3 py-2 text-sm"
                        value={maxDownloads}
                        onChange={(e) => setMaxDownloads(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 2"
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Uploading...' : 'Upload & Generate Link'}
            </button>

            <p className="text-xs text-slate-600">
              Default expiry is 10 minutes if you don’t set one.
            </p>
          </div>
        </form>

        {shareUrl ? (
          <section className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Your share link</h2>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                readOnly
                value={shareUrl}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={copyLink}
                className="rounded-lg border px-3 py-2 text-sm font-medium"
              >
                Copy
              </button>
              <a
                href={shareUrl}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white text-center"
              >
                Open
              </a>
            </div>
          </section>
        ) : null}

        <section className="mt-6 text-xs text-slate-600">
          <p>
            Anyone with the link can access the content until it expires. There is no public listing.
          </p>
        </section>
      </main>
    </div>
  );
}
