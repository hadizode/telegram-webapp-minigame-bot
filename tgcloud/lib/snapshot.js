// PURE snapshot builder shared by the server (game.js) and the editor playtest. No sdk / DB imports.
import { isInteractive, publicRoom } from './engine.js';
import { stripScene } from './packLoader.js';

// pack: full pack data; active: active room ids; gs: parsed game state; lockLength: team size.
// Rules, answers and digits of unsolved rooms never leave the server.
export function buildSnapshot(pack, active, gs, lockLength) {
  const scenes = { lobby: stripScene(pack.lobby, active) };
  const rooms = {};
  const found = [];
  const shown = new Set(gs.shown || []);
  for (const id of active) {
    const r = pack.rooms[id];
    if (isInteractive(r)) {
      rooms[id] = publicRoom(id, r, gs);
      if (gs.done[id] || shown.has(id)) found.push(...r.digits);
    } else {
      scenes[id] = stripScene(r, active);
    }
  }
  return { seq: gs.seq, name: pack.name, lockLength, scenes, rooms, inv: gs.inv, log: gs.log, found };
}

// { roomId: interactiveRoom } for the active rooms — the shape act()/enter() expect.
export function activeInteractive(pack, active) {
  const out = {};
  for (const id of active) if (isInteractive(pack.rooms[id])) out[id] = pack.rooms[id];
  return out;
}