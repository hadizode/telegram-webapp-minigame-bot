import { db } from 'sdk';

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