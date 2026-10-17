import { PACKS } from './packs/index.js';

const REQUIRED = ['theme', 'name', 'min_players', 'max_players', 'rooms', 'map_positions'];
const missing = (p) => REQUIRED.filter((k) => p?.[k] === undefined);

export function listPacks() {
  const out = [];
  for (const [id, p] of Object.entries(PACKS)) {
    const m = missing(p);
    if (m.length) { console.warn(`skipping invalid pack ${id}: missing ${m.join(',')}`); continue; }
    out.push({
      id, name: p.name, theme: p.theme, theme_fa: p.theme_fa || p.theme,
      min_players: p.min_players, max_players: p.max_players, room_count: p.rooms.length,
    });
  }
  return out;
}

export function getPack(id) {
  const p = PACKS[id];
  if (!p) throw new Error(`pack not found: ${id}`);
  const m = missing(p);
  if (m.length) throw new Error(`pack ${id} missing: ${m.join(',')}`);
  return p;
}
