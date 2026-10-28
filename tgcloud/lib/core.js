// Shared low-level core: formatting helpers, the game_state row (one per match),
// the DB-backed mutex, and the opportunistic sweep that replaces a cron job.
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { gameState } from '../schema.js';

// ---- small helpers (were lib/util.js) --------------------------------------------------------
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

export const formatDate = (d) =>
  new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(d));

export const rid = () => Math.random().toString(36).slice(2, 10);

// NOTE: docs show both array and {rows} shapes for .returning().run(); handle both.
export const first = (res) => (Array.isArray(res) ? res[0] : res?.rows?.[0]);

// ---- game_state rows (were lib/gameState.js) -------------------------------------------------
export const getGame = (matchId) => db.select().from(gameState).where(eq(gameState.matchId, matchId)).get();

export const createGame = (matchId, state) =>
  db.insert(gameState).values({ matchId, state: JSON.stringify(state) })
    .onConflictDoNothing({ target: gameState.matchId }).run();

// patch: { state?: string, finished?: string }
export const saveGame = (matchId, patch) =>
  db.update(gameState).set({ ...patch, updatedAt: new Date() }).where(eq(gameState.matchId, matchId)).run();

// ---- cleanup (were lib/cleanup.js) -----------------------------------------------------------
// No cron on the platform, so expired rows are swept opportunistically:
// roughly once every 1/p calls of saveState / acquireLock.
export async function maybeSweep(p = 0.05) {
  if (Math.random() >= p) return;
  const now = Date.now();
  try {
    await db.run('DELETE FROM fsm_sessions WHERE expires_at < :now', { ':now': now });
    await db.run('DELETE FROM locks WHERE expires_at < :now', { ':now': now });
  } catch (e) {
    console.warn('sweep failed', e.message);
  }
}

// ---- locks (were lib/lock.js) ----------------------------------------------------------------
// DB-backed lock (replaces Redis SET NX PX). Returns a release function or throws 'LOCKED'.
export async function acquireLock(id, ttlMs = 3000) {
  await maybeSweep(); // clears expired locks/sessions of every id, not just this one
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
