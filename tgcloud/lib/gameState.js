import { db } from 'sdk';
import { eq } from 'sdk/db';
import { gameState } from '../schema.js';

export const getGame = (matchId) => db.select().from(gameState).where(eq(gameState.matchId, matchId)).get();

export const createGame = (matchId, state) =>
  db.insert(gameState).values({ matchId, state: JSON.stringify(state) })
    .onConflictDoNothing({ target: gameState.matchId }).run();

// patch: { roomIndex?, state?: string, digits?: string }
export const saveGame = (matchId, patch) =>
  db.update(gameState).set({ ...patch, updatedAt: new Date() }).where(eq(gameState.matchId, matchId)).run();
