// PURE snapshot builder shared by the server (game.js) and the editor playtest. No sdk / DB imports.
import { isInteractive, publicRoom } from './engine.js';
import { stripScene } from './packLoader.js';

// pack: full pack data; active: active room ids; gs: parsed game state; lockLength: team size.
// Rules, answers and digits of unsolved rooms never leave the server.
export function buildSnapshot(pack, active, gs, lockLength) {
  const lobby = pack.lobby;
  const scenes = {};
  // An interactive lobby lives in `rooms` (the client renders it like any puzzle room);
  // a hotspot lobby goes through stripScene like the plain scenes.
  if (isInteractive(lobby)) active = ['lobby', ...active];
  else scenes.lobby = stripScene(lobby, active);
  const rooms = {};
  const found = [];
  const shown = new Set(gs.shown || []);
  for (const id of active) {
    const r = id === 'lobby' ? lobby : pack.rooms[id];
    if (isInteractive(r)) {
      rooms[id] = publicRoom(id, r, gs);
      // digitsHidden: the room's digits only reach the client via a {digit:<room>} rule
      // (e.g. the power-room display shows "2" only after the generator is on).
      if (!r.digitsHidden && (gs.done[id] || shown.has(id))) found.push(...(r.digits ?? []));
    } else {
      scenes[id] = stripScene(r, active);
    }
  }
  return { seq: gs.seq, name: pack.name, lockLength, scenes, rooms, inv: gs.inv, log: gs.log, found };
}

// { roomId: interactiveRoom } for the active rooms — the shape act()/enter() expect.
// The lobby counts as an active room when it is interactive (its objects are playable).
export function activeInteractive(pack, active) {
  const out = {};
  if (isInteractive(pack.lobby)) out.lobby = pack.lobby;
  for (const id of active) if (isInteractive(pack.rooms[id])) out[id] = pack.rooms[id];
  return out;
}