import { db } from 'sdk';
import { eq, and, inArray } from 'sdk/db';
import { matches } from '../schema.js';
import { first } from './core.js';

export const getMatch = (id) => db.select().from(matches).where(eq(matches.id, id)).get();

export const findOpenByGroup = (groupId) =>
  db.select().from(matches)
    .where(and(eq(matches.groupId, groupId), inArray(matches.status, ['open', 'full'])))
    .get();

// Used by /finish — the admin's manual end-of-match button.
export const findRunningByGroup = (groupId) =>
  db.select().from(matches)
    .where(and(eq(matches.groupId, groupId), eq(matches.status, 'running')))
    .get();

export async function createMatch({ groupId, packId, maxPlayers, createdBy }) {
  const res = await db.insert(matches)
    .values({ groupId, packId, maxPlayers, createdBy })
    .returning()
    .run();
  return first(res);
}

export function setStatus(id, status) {
  let set = { status };
  if (status === 'running') set = { status, startedAt: new Date() };
  // Going back to registration (e.g. engine failed to start) clears the start time.
  else if (status === 'open' || status === 'full') set = { status, startedAt: null };
  // Terminal states stamp finishedAt (used by reports; end-of-match logic lives in lib/finish.js).
  else if (status === 'finished' || status === 'cancelled') set = { status, finishedAt: new Date() };
  return db.update(matches).set(set).where(eq(matches.id, id)).run();
}

export const setMessageId = (id, messageId) =>
  db.update(matches).set({ messageId }).where(eq(matches.id, id)).run();