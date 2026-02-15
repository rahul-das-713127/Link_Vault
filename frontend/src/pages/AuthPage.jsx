import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login, register, setAuthToken } from '../lib/api.js';
import useFeatures from '../lib/useFeatures.js';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { features } = useFeatures();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!features.auth) {
      setError('Authentication is disabled on this server.');
      return;
    }
    try {
      setLoading(true);
      const fn = mode === 'login' ? login : register;
      const res = await fn({ username, password });
      setAuthToken(res.token);
      const next = searchParams.get('next') || '/';
      navigate(next, { replace: true });
    } catch (err) {
      setError(err?.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LinkVault</h1>
            <p className="mt-1 text-sm text-slate-600">Authentication (optional)</p>
          </div>
          <Link className="text-sm font-medium underline" to="/">
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {!features.auth ? (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-700">Authentication is disabled on this server.</p>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium border ${
                mode === 'login' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
              }`}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium border ${
                mode === 'register' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
              }`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-700">Username</span>
              <input
                className="rounded-lg border px-3 py-2 text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-700">Password</span>
              <input
                className="rounded-lg border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
          </div>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>

          <p className="mt-3 text-xs text-slate-600">
            Auth is optional. If you log in, your uploads are owned by your account and you can delete them without a delete token.
          </p>
        </form>
      </main>
    </div>
  );
}
