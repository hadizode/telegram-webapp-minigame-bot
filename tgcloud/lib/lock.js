import { db } from 'sdk';
import { rid } from './util.js';

// DB-backed lock (replaces Redis SET NX PX). Returns a release function or throws 'LOCKED'.
export async function acquireLock(id, ttlMs = 3000) {
  const now = Date.now();
  const token = rid();
  await db.run('DELETE FROM locks WHERE id = :id AND expires_at < :now', { ':id': id, ':now': now });
  const r = await db.run(
    'INSERT OR IGNORE INTO locks (id, token, expires_at) VALUES (:id, :token, :exp)',
    { ':id': id, ':token': token, ':exp': now + ttlMs },
  );
  if (!r.rowsAffected) throw new Error('LOCKED');
  return () => db.run('DELETE FROM locks WHERE id = :id AND token = :token', { ':id': id, ':token': token });
}
