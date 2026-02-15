import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, getUserById, getUserByUsername } from '../db.js';

export function createAuth({ jwtSecret }) {
  function getAuthUser(req) {
    const header = req.headers.authorization;
    if (!header || typeof header !== 'string') return null;
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    try {
      const payload = jwt.verify(token, jwtSecret);
      if (!payload || typeof payload !== 'object') return null;
      if (!payload.sub) return null;
      const userId = Number(payload.sub);
      if (!Number.isFinite(userId)) return null;
      const user = getUserById(userId);
      if (!user) return null;
      return { id: user.id, username: user.username };
    } catch {
      return null;
    }
  }

  function registerHandler(req, res) {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const existing = getUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username already exists.' });

    const password_hash = bcrypt.hashSync(password, 10);
    const id = createUser({ username, password_hash, created_at: Date.now() });
    const token = jwt.sign({ sub: String(id) }, jwtSecret, { expiresIn: '7d' });
    return res.status(201).json({ token, user: { id, username } });
  }

  function loginHandler(req, res) {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const user = getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ sub: String(user.id) }, jwtSecret, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, username: user.username } });
  }

  return {
    getAuthUser,
    registerHandler,
    loginHandler
  };
}
