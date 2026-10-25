import { db } from 'sdk';
import { eq, and, gt } from 'sdk/db';
import { matches, matchPlayers } from '../schema.js';
import { acquireLock } from './lock.js';
import { setStatus } from './matches.js';
import { refreshCard } from './cards.js';
import { send, tryApi } from './tg.js';

const STALE_MS = 2 * 60 * 1000; // بازیکنی که این مدت poll نکرده «رفته» حساب می‌شه
const GRACE_MS = 5 * 60 * 1000; // به بازیکن‌ها وقت می‌دیم بعد از شروع مچ وارد بشن

// cron نداریم؛ از handlerها (با احتمال p) صدا زده می‌شه.
export async function closeAbandoned(p = 0.2) {
  if (Math.random() >= p) return;
  try {
    const running = await db.select().from(matches).where(eq(matches.status, 'running')).all();
    const now = Date.now();
    for (const m of running) {
      const started = m.startedAt ? new Date(m.startedAt).getTime() : 0;
      if (now - started < GRACE_MS) continue;
      const alive = await db.$count(matchPlayers, and(
        eq(matchPlayers.matchId, m.id), eq(matchPlayers.isActive, true),
        gt(matchPlayers.lastSeen, now - STALE_MS),
      ));
      if (alive) continue;
      let release;
      try { release = await acquireLock(`match:${m.id}`, 3000); } catch { continue; }
      try {
        await setStatus(m.id, 'cancelled');
        await tryApi(() => refreshCard(m.id), 'abandon card');
        await tryApi(() => send(m.groupId, '🚪 همه از بازی خارج شدن؛ مچ بسته شد.'), 'abandon msg');
      } finally { await release(); }
    }
  } catch (e) {
    console.warn('closeAbandoned failed', e.message);
  }
}