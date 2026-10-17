import { db } from 'sdk';

const TTL_MS = 5 * 60 * 1000;
export const fsmKey = (chatId, userId) => `newmatch:${chatId}:${userId}`;

export async function loadState(id) {
  const row = await db.get('SELECT data, expires_at FROM fsm_sessions WHERE id = :id', { ':id': id });
  if (!row) return null;
  if (row.expires_at < Date.now()) { await clearState(id); return null; }
  return JSON.parse(row.data);
}

// Every save refreshes the 5-minute TTL.
export const saveState = (id, state) =>
  db.run('INSERT OR REPLACE INTO fsm_sessions (id, data, expires_at) VALUES (:id, :data, :exp)', {
    ':id': id, ':data': JSON.stringify(state), ':exp': Date.now() + TTL_MS,
  });

export const clearState = (id) => db.run('DELETE FROM fsm_sessions WHERE id = :id', { ':id': id });
