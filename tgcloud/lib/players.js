import { db } from 'sdk';
import { eq, and, asc, inArray } from 'sdk/db';
import { matchPlayers, users } from '../schema.js';

const activeWhere = (matchId) => and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.isActive, true));

export async function listActive(matchId) {
  const rows = await db.select().from(matchPlayers).where(activeWhere(matchId))
    .orderBy(asc(matchPlayers.joinedAt), asc(matchPlayers.id)).all();
  if (!rows.length) return [];
  const us = await db.select().from(users).where(inArray(users.id, rows.map((r) => r.userId))).all();
  const byId = new Map(us.map((u) => [u.id, u]));
  return rows.map((r) => byId.get(r.userId)).filter(Boolean);
}

export const countActive = (matchId) => db.$count(matchPlayers, activeWhere(matchId));

export const getActive = (matchId, userId) =>
  db.select().from(matchPlayers)
    .where(and(activeWhere(matchId), eq(matchPlayers.userId, userId))).get();

// Callers hold the match lock, so select-then-write is safe.
export async function addPlayer(matchId, userId) {
  const row = await db.select().from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId))).get();
  if (row) {
    return db.update(matchPlayers).set({ isActive: true, joinedAt: new Date() })
      .where(eq(matchPlayers.id, row.id)).run();
  }
  return db.insert(matchPlayers).values({ matchId, userId }).run();
}
export const touch = (matchId, userId) =>
  db.update(matchPlayers).set({ lastSeen: Date.now() })
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId))).run();
    
export const deactivate = (matchId, userId) =>
  db.update(matchPlayers).set({ isActive: false })
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId))).run();
