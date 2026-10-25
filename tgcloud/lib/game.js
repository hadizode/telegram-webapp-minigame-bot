import { acquireLock } from './lock.js';
import { getPack, getVariant, stripScene } from './packLoader.js';
import { getGame, createGame, saveGame } from './gameState.js';
import { initialGame, publicRoom, act, isInteractive } from './engine.js';
import { send, tryApi } from './tg.js';
import { escapeHtml } from './util.js';

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

// What the Mini App sees: lobby + hotspot rooms (publicView-style), interactive rooms, shared inventory/log.
// Rules, answers and digits of unsolved rooms never leave the server.
export async function snapshot(match, user) {
  const g = await getGame(match.id);
  if (!g) return null;
  const pack = getPack(match.packId);
  const gs = JSON.parse(g.state);
  const active = activeRooms(pack, match);
  const scenes = { lobby: stripScene(pack.lobby, active) };
  const rooms = {};
  const found = [];
  for (const id of active) {
    const r = pack.rooms[id];
    if (isInteractive(r)) {
      rooms[id] = publicRoom(id, r, gs);
      if (gs.done[id]) found.push(...r.digits);
    } else {
      scenes[id] = stripScene(r, active);
    }
  }
  return { seq: gs.seq, name: pack.name, lockLength: match.maxPlayers, scenes, rooms, inv: (!Array.isArray(gs.inv) && gs.inv[user.id]) || [], log: gs.log, found };
}

export const playerAct = (match, user, roomId, objectId, withItem) => locked(match.id, async () => {
  const g = await getGame(match.id);
  if (!g) return { result: { ok: false, text: '⚠️ بازی هنوز آماده نیست' } };
  const pack = getPack(match.packId);
  const room = pack.rooms[roomId];
  if (!activeRooms(pack, match).includes(roomId) || !isInteractive(room)) {
    return { result: { ok: false, text: '🔎 این اتاق وجود نداره' } };
  }
  const gs = JSON.parse(g.state);
  if (Array.isArray(gs.inv)) gs.inv = {};
  if (gs.done[roomId]) return { result: { ok: true, text: '🏁 این اتاق حل شده' } };

  const result = act(room, roomId, gs, objectId, withItem, user.firstName || user.username || 'یکی از بازیکن‌ها', user.id);
  if (!result.changed) return { result: { ok: result.ok, text: result.text, audio: result.audio } };

  await saveGame(match.id, { state: JSON.stringify(gs) });
  if (result.solved) {
    await tryApi(() => send(match.groupId, `🔓 اتاق «${escapeHtml(room.name_fa || roomId)}» حل شد!`), 'solved');
  }
  return { result: { ok: true, text: result.text, audio: result.audio } };
});
