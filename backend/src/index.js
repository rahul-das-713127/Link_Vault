import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import {
  deleteShare,
  getShare,
  incrementDownloadCount,
  incrementViewCount,
  insertShare,
  listExpiredShares
} from './db.js';
import { getFeaturesFromEnv } from './features/config.js';
import { createAuth } from './features/auth.js';
import { requireSharePasswordIfNeeded } from './features/password.js';
import { isOverLimits } from './features/limits.js';
import { createFileTypeValidator } from './features/fileTypeValidation.js';
import { isOneTime } from './features/oneTime.js';
import { createManualDelete } from './features/manualDelete.js';

const app = express();

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const features = getFeaturesFromEnv(process.env);
const ALLOWED_MIME_TYPES = (process.env.ALLOWED_MIME_TYPES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const auth = createAuth({ jwtSecret: JWT_SECRET });
const fileTypeValidator = createFileTypeValidator({ allowedMimeTypes: ALLOWED_MIME_TYPES });

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: false
  })
);

app.use(express.json({ limit: '1mb' }));

const uploadsDir = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeId = nanoid(32);
      const ext = path.extname(file.originalname || '');
      cb(null, `${safeId}${ext}`);
    }
  }),
  limits: {
    fileSize: process.env.MAX_FILE_BYTES ? Number(process.env.MAX_FILE_BYTES) : 25 * 1024 * 1024
  }
});

function nowMs() {
  return Date.now();
}

function getAuthUser(req) {
  if (!features.auth) return null;
  return auth.getAuthUser(req);
}

function parseExpiresAt(expiresAtInput, createdAtMs) {
  if (!expiresAtInput) return createdAtMs + 10 * 60 * 1000;
  const parsed = Date.parse(expiresAtInput);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function validateExpiresAt(expiresAtMs, createdAtMs) {
  if (!Number.isFinite(expiresAtMs)) return { ok: false, status: 400, error: 'Invalid expiresAt. Use ISO datetime.' };
  if (expiresAtMs <= createdAtMs) {
    return { ok: false, status: 400, error: 'expiresAt must be in the future.' };
  }
  return { ok: true };
}

function isExpired(share, now = nowMs()) {
  return share.expires_at <= now;
}

function cleanupExpired() {
  const expired = listExpiredShares(nowMs());
  for (const share of expired) {
    if (share.kind === 'file' && share.stored_filename) {
      const filePath = path.join(uploadsDir, share.stored_filename);
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
    deleteShare(share.id);
  }
}

setInterval(cleanupExpired, 60 * 1000);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/features', (_req, res) => {
  res.json({
    auth: features.auth,
    password: features.password,
    oneTime: features.oneTime,
    limits: features.limits,
    manualDelete: features.manualDelete,
    fileTypeValidation: features.fileTypeValidation
  });
});

app.post('/api/auth/register', (req, res) => {
  if (!features.auth) return res.status(404).json({ error: 'Not found' });
  return auth.registerHandler(req, res);
});

app.post('/api/auth/login', (req, res) => {
  if (!features.auth) return res.status(404).json({ error: 'Not found' });
  return auth.loginHandler(req, res);
});

app.get('/api/auth/me', (req, res) => {
  if (!features.auth) return res.status(404).json({ error: 'Not found' });
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });
  return res.json({ user });
});

app.post('/api/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large.' });
      }
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: 'Invalid upload.' });
  });
}, (req, res) => {
  const createdAt = nowMs();
  const user = getAuthUser(req);
  const expiresAt = parseExpiresAt(req.body?.expiresAt, createdAt);
  if (expiresAt === null) {
    return res.status(400).json({ error: 'Invalid expiresAt. Use ISO datetime.' });
  }
  const expiryCheck = validateExpiresAt(expiresAt, createdAt);
  if (!expiryCheck.ok) {
    return res.status(expiryCheck.status).json({ error: expiryCheck.error });
  }

  const hasText = typeof req.body?.text === 'string' && req.body.text.trim().length > 0;
  const hasFile = !!req.file;

  if ((hasText && hasFile) || (!hasText && !hasFile)) {
    return res.status(400).json({ error: 'Provide either text or a file (exactly one).' });
  }

  const id = nanoid(22);

  const password = features.password && typeof req.body?.password === 'string' ? req.body.password : '';
  const oneTime = features.oneTime && (req.body?.oneTime === 'true' || req.body?.oneTime === true);
  const maxViews = features.limits && req.body?.maxViews ? Number(req.body.maxViews) : null;
  const maxDownloads = features.limits && req.body?.maxDownloads ? Number(req.body.maxDownloads) : null;

  if (features.fileTypeValidation && req.file && !fileTypeValidator.isAllowedMimeType(req.file.mimetype)) {
    try {
      fs.unlinkSync(path.join(uploadsDir, req.file.filename));
    } catch {
      // ignore
    }
    return res.status(415).json({ error: 'File type not allowed.' });
  }

  const password_hash = password ? bcrypt.hashSync(password, 10) : null;
  const deleteToken = nanoid(32);
  const delete_token_hash = bcrypt.hashSync(deleteToken, 10);

  if (maxViews != null && (!Number.isFinite(maxViews) || maxViews <= 0)) {
    return res.status(400).json({ error: 'maxViews must be a positive number.' });
  }
  if (maxDownloads != null && (!Number.isFinite(maxDownloads) || maxDownloads <= 0)) {
    return res.status(400).json({ error: 'maxDownloads must be a positive number.' });
  }

  if (hasText) {
    insertShare({
      id,
      kind: 'text',
      text_content: req.body.text,
      original_filename: null,
      stored_filename: null,
      mime_type: 'text/plain',
      byte_size: Buffer.byteLength(req.body.text, 'utf8'),
      created_at: createdAt,
      expires_at: expiresAt,
      owner_user_id: user?.id || null,
      password_hash,
      one_time: oneTime ? 1 : 0,
      max_views: maxViews,
      max_downloads: maxDownloads,
      view_count: 0,
      download_count: 0,
      delete_token_hash
    });

    return res.status(201).json({ id, kind: 'text', expiresAt, deleteToken });
  }

  insertShare({
    id,
    kind: 'file',
    text_content: null,
    original_filename: req.file.originalname,
    stored_filename: req.file.filename,
    mime_type: req.file.mimetype,
    byte_size: req.file.size,
    created_at: createdAt,
    expires_at: expiresAt,
    owner_user_id: user?.id || null,
    password_hash,
    one_time: oneTime ? 1 : 0,
    max_views: maxViews,
    max_downloads: maxDownloads,
    view_count: 0,
    download_count: 0,
    delete_token_hash
  });

  return res.status(201).json({ id, kind: 'file', expiresAt, deleteToken });
});

app.delete('/api/share/:id', (req, res) => {
  if (!features.manualDelete) return res.status(404).json({ error: 'Not found' });
  cleanupExpired();
  const handler = createManualDelete({ uploadsDir, getAuthUser: features.auth ? getAuthUser : null });
  return handler(req, res);
});

app.get('/api/share/:id', (req, res) => {
  cleanupExpired();
  const share = getShare(req.params.id);
  if (!share) return res.status(403).json({ error: 'Invalid or expired link.' });
  if (isExpired(share)) return res.status(403).json({ error: 'Invalid or expired link.' });

  if (features.limits && isOverLimits(share)) return res.status(403).json({ error: 'Invalid or expired link.' });
  if (features.password) {
    const pw = requireSharePasswordIfNeeded(req, share);
    if (!pw.ok) return res.status(pw.status).json({ error: pw.error });
  }

  if (share.kind === 'text') {
    incrementViewCount(share.id);
    if (features.oneTime && isOneTime(share)) {
      deleteShare(share.id);
    }
    return res.json({
      id: share.id,
      kind: 'text',
      text: share.text_content,
      createdAt: share.created_at,
      expiresAt: share.expires_at
    });
  }

  incrementViewCount(share.id);

  return res.json({
    id: share.id,
    kind: 'file',
    originalFilename: share.original_filename,
    mimeType: share.mime_type,
    byteSize: share.byte_size,
    createdAt: share.created_at,
    expiresAt: share.expires_at,
    downloadUrl: `/api/share/${share.id}/file`
  });
});

app.get('/api/share/:id/file', (req, res) => {
  cleanupExpired();
  const share = getShare(req.params.id);
  if (!share) return res.status(403).json({ error: 'Invalid or expired link.' });
  if (share.kind !== 'file') return res.status(400).json({ error: 'Not a file share.' });
  if (isExpired(share)) return res.status(403).json({ error: 'Invalid or expired link.' });

  if (features.limits && isOverLimits(share)) return res.status(403).json({ error: 'Invalid or expired link.' });
  if (features.password) {
    const pw = requireSharePasswordIfNeeded(req, share);
    if (!pw.ok) return res.status(pw.status).json({ error: pw.error });
  }

  const filePath = path.join(uploadsDir, share.stored_filename);
  if (!fs.existsSync(filePath)) return res.status(403).json({ error: 'Invalid or expired link.' });

  incrementDownloadCount(share.id);
  if (features.oneTime && isOneTime(share)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
    deleteShare(share.id);
  }
  res.download(filePath, share.original_filename);
});

app.listen(PORT, () => {
  console.log(`LinkVault backend listening on http://localhost:${PORT}`);
});
