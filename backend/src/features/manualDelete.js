import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { deleteShare, getShare } from '../db.js';

export function createManualDelete({ uploadsDir, getAuthUser }) {
  return function deleteHandler(req, res) {
    const id = req.params.id;
    const share = getShare(id);
    if (!share) return res.status(403).json({ error: 'Invalid or expired link.' });

    if (share.owner_user_id != null) {
      const user = getAuthUser ? getAuthUser(req) : null;
      if (!user) return res.status(401).json({ error: 'Login required to delete this share.' });
      if (Number(share.owner_user_id) !== Number(user.id)) {
        return res.status(403).json({ error: 'Not allowed to delete this share.' });
      }

      if (share.kind === 'file' && share.stored_filename) {
        const filePath = path.join(uploadsDir, share.stored_filename);
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }
      }
      deleteShare(share.id);
      return res.json({ ok: true });
    }

    const provided = req.headers['x-delete-token'];
    const deleteToken = typeof provided === 'string' ? provided : '';
    if (!deleteToken || !share.delete_token_hash) {
      return res.status(401).json({ error: 'Delete token required.' });
    }
    const ok = bcrypt.compareSync(deleteToken, share.delete_token_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid delete token.' });

    if (share.kind === 'file' && share.stored_filename) {
      const filePath = path.join(uploadsDir, share.stored_filename);
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
    deleteShare(share.id);
    return res.json({ ok: true });
  };
}
