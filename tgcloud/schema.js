import { table, integer, text, boolean, index, unique, check, sql } from 'sdk/db';

// NOTE: no foreign keys on this platform; integrity is enforced in app code.
export const users = table('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tgId: integer('telegram_id').notNull().unique(),
  username: text('username'),
  firstName: text('first_name'),
  totalXp: integer('total_xp').notNull().default(0),
  matchesPlayed: integer('matches_played').notNull().default(0),
  matchesWon: integer('matches_won').notNull().default(0),
  // Unused: the title is computed from XP by titleFor() in lib/users.js.
  // Dropped on the next `npx tgcloud migrate`.
  title: text('title').deprecated('unused; title is computed from total_xp'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const matches = table('matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull(),
  packId: text('pack_id').notNull(),
  maxPlayers: integer('max_players').notNull(),
  status: text('status').notNull().default('open'),
  messageId: integer('message_id'),
  createdBy: integer('created_by').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  validStatus: check('valid_status', sql`${t.status} in ('open','full','running','finished','cancelled')`),
  groupStatusIdx: index('idx_matches_group_status').on(t.groupId, t.status),
}));

export const matchPlayers = table('match_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').notNull(),
  userId: integer('user_id').notNull(), // users.id (internal id)
  isActive: boolean('is_active').notNull().default(true),
  rank: integer('rank'),
  score: integer('score'),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  uq: unique('uq_match_user').on(t.matchId, t.userId),
  activeIdx: index('idx_players_match_active').on(t.matchId, t.isActive),
}));

// Replaces Redis: wizard state with expiry (unix ms).
export const fsmSessions = table('fsm_sessions', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

// Replaces Redis locks (unix ms expiry).
export const locks = table('locks', {
  id: text('id').primaryKey(),
  token: text('token').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

// Append-only log of what happens in a match. Progress and ranking are computed from it.
//   type 'digit_ok'    — a correct digit was accepted; `slot` = lock cell it filled (0..n-1)
//   type 'digit_wrong' — a rejected attempt (used for the per-player cooldown); slot is NULL
// unique(match_id, slot) guarantees a cell is filled once; NULL slots don't collide in SQLite.
export const matchEvents = table('match_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').notNull(),
  userId: integer('user_id').notNull(), // users.id (internal id)
  type: text('type').notNull(),
  digit: integer('digit'),
  slot: integer('slot'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (t) => ({
  uqSlot: unique('uq_event_slot').on(t.matchId, t.slot),
  matchTypeIdx: index('idx_events_match_type').on(t.matchId, t.type),
}));
