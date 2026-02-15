import bcrypt from 'bcryptjs';

export function requireSharePasswordIfNeeded(req, share) {
  if (!share.password_hash) return { ok: true };
  const provided = req.headers['x-share-password'];
  const password = typeof provided === 'string' ? provided : '';
  if (!password) return { ok: false, status: 401, error: 'Password required.' };
  const ok = bcrypt.compareSync(password, share.password_hash);
  if (!ok) return { ok: false, status: 401, error: 'Invalid password.' };
  return { ok: true };
}
