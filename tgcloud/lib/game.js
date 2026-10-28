import { act, enter, ENTER_PREFIX, initialGame, isInteractive } from './engine.js';
import { createGame, getGame, saveGame } from './core.js';
import { acquireLock } from './core.js';
import { getPack, getVariant } from './packLoader.js';
import { activeInteractive, buildSnapshot } from './snapshot.js';
import { send, tryApi } from './tg.js';
import { escapeHtml } from './core.js';

async function locked(matchId, fn) {
  let release;
  try { release = await acquireLock(`game:${matchId}`, 4000); } catch { return { busy: true }; }
  try { return await fn(); } finally { await release(); }
}

// The match's team size picks the variant, which picks the active rooms.
const activeRooms = (pack, match) => getVariant(pack, match.maxPlayers).rooms;

export function startGame(match) {
  const pack = getPack(match.packId);
  return createGame(match.id, initialGame(pack, activeRooms(pack, match)));
}

// What the Mini App sees: lobby + hotspot rooms, interactive rooms, shared inventory/log.
// Rules, answers and digits of unsolved rooms never leave the server. (Pure part: lib/snapshot.js.)
export async function snapshot(match) {
  const g = await getGame(match.id);
  if (!g) return null;
  const pack = getPack(match.packId);
  return buildSnapshot(pack, activeRooms(pack, match), JSON.parse(g.state), match.maxPlayers);
}

// objectId '@enter:<view>' = "the player entered that view" (runs `enter` rules); anything else is a click.
export const playerAct = (match, user, roomId, objectId, withItem) => locked(match.id, async () => {
  const g = await getGame(match.id);
  if (!g) return { result: { ok: false, text: '⚠️ بازی هنوز آماده نیست' } };
  const pack = getPack(match.packId);
  const room = pack.rooms[roomId];
  const active = activeRooms(pack, match);
  if (!active.includes(roomId) || !isInteractive(room)) {
    return { result: { ok: false, text: '🔎 این اتاق وجود نداره' } };
  }
  const gs = JSON.parse(g.state);
  const view = objectId.startsWith(ENTER_PREFIX) ? objectId.slice(ENTER_PREFIX.length) : null;
  if (view === null && gs.done[roomId]) return { result: { ok: true, text: '🏁 این اتاق حل شده' } };

  const rooms = activeInteractive(pack, active);
  const by = user.firstName || user.username || 'یکی از بازیکن‌ها';
  const r = view !== null ? enter(rooms, roomId, gs, view, by) : act(rooms, roomId, gs, objectId, withItem, by);
  if (r.error) console.error('rules aborted:', r.error, roomId, objectId);
  const result = { ok: r.ok, text: r.text, audio: r.audio, msgs: r.msgs, read: r.read, goto: r.goto };
  if (!r.changed) return { result };

  await saveGame(match.id, { state: JSON.stringify(gs) });
  for (const rid of r.solvedRooms || []) {
    await tryApi(() => send(match.groupId, `🔓 اتاق «${escapeHtml(pack.rooms[rid].name_fa || rid)}» حل شد!`), 'solved');
  }
  return { result };
});