import { acquireLock } from './lock.js';
import { getPack } from './packLoader.js';
import { getGame, createGame, saveGame } from './gameState.js';
import { initialState, publicRoom, act } from './engine.js';
import { send, tryApi } from './tg.js';
import { escapeHtml } from './util.js';

async function locked(matchId, fn) {
  let release;
  try { release = await acquireLock(`game:${matchId}`, 4000); } catch { return { busy: true }; }
  try { return await fn(); } finally { await release(); }
}

export const startGame = (match) => createGame(match.id, initialState(getPack(match.packId).rooms[0]));

// What the Mini App sees: public room data + shared state. Rules/answers never leave the server.
export async function snapshot(match) {
  const g = await getGame(match.id);
  if (!g) return null;
  const rooms = getPack(match.packId).rooms;
  const room = rooms[g.roomIndex];
  const st = JSON.parse(g.state);
  return {
    ...publicRoom(room, st),
    index: g.roomIndex,
    total: rooms.length,
    last: g.roomIndex === rooms.length - 1,
    digits: JSON.parse(g.digits),
    win: st.done ? { digit: room.win.digit, text: room.win.text } : null,
  };
}

export const playerAct = (match, user, objectId, withItem) => locked(match.id, async () => {
  const g = await getGame(match.id);
  if (!g) return { result: { ok: false, text: '⚠️ بازی هنوز آماده نیست' } };
  const room = getPack(match.packId).rooms[g.roomIndex];
  const st = JSON.parse(g.state);
  if (st.done) return { result: { ok: true, text: '🏁 این اتاق حل شده' } };

  const result = act(room, st, objectId, withItem, user.firstName || user.username || 'یکی از بازیکن‌ها');
  if (!result.changed) return { result: { ok: result.ok, text: result.text, audio: result.audio } };

  const patch = { state: JSON.stringify(st) };
  if (result.solved) {
    const digits = JSON.parse(g.digits);
    if (room.win.digit !== undefined) digits.push(room.win.digit);
    patch.digits = JSON.stringify(digits);
  }
  await saveGame(match.id, patch);
  if (result.solved) {
    await tryApi(() => send(match.groupId, `🔓 اتاق «${escapeHtml(room.name || room.id)}» حل شد!`), 'solved');
  }
  return { result: { ok: true, text: result.text, audio: result.audio } };
});

// Any player can move the team on once the current room is solved.
export const advance = (match) => locked(match.id, async () => {
  const g = await getGame(match.id);
  const rooms = getPack(match.packId).rooms;
  const next = rooms[g.roomIndex + 1];
  const st = JSON.parse(g.state);
  if (!st.done || !next) return {};
  const ns = initialState(next);
  ns.seq = st.seq + 1; // seq is monotonic across rooms so clients can poll with a single number
  await saveGame(match.id, { roomIndex: g.roomIndex + 1, state: JSON.stringify(ns) });
  await tryApi(() => send(match.groupId, `🚪 تیم وارد اتاق «${escapeHtml(next.name || next.id)}» شد`), 'advance');
  return {};
});
