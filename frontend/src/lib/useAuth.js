import { useEffect, useState } from 'react';
import { getMe, getAuthToken, setAuthToken } from './api.js';

export default function useAuth({ enabled }) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [user, setUser] = useState(null);

  async function refresh() {
    if (!enabled) {
      setLoading(false);
      setUser(null);
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }
    try {
      setLoading(true);
      const res = await getMe();
      setUser(res.user || null);
    } catch {
      setAuthToken('');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setAuthToken('');
    setUser(null);
  }

  useEffect(() => {
    refresh();
  }, [enabled]);

  return { loading, user, refresh, logout };
}
