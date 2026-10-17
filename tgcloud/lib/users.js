import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { users } from '../schema.js';
import { first } from './util.js';

export function titleFor(xp) {
  if (xp <= 100) return 'تازه‌وارد';
  if (xp <= 500) return 'کاوشگر';
  if (xp <= 2000) return 'استاد قفل';
  return 'افسانه فرار';
}

export async function upsertUser(from) {
  const vals = { username: from.username ?? null, firstName: from.first_name ?? null };
  const res = await db.insert(users)
    .values({ tgId: from.id, ...vals })
    .onConflictDoUpdate({ target: users.tgId, set: vals })
    .returning()
    .run();
  return first(res);
}

export const getUserByTgId = (tgId) => db.select().from(users).where(eq(users.tgId, tgId)).get();
export const topUsers = (n = 20) => db.select().from(users).orderBy(desc(users.totalXp)).limit(n).all();
