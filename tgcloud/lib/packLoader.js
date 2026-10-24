import { PACKS } from './packs/index.js';
import { roomErrors, isInteractive } from './engine.js';

const REQUIRED = ['theme', 'name', 'min_players', 'max_players', 'lobby', 'rooms', 'variants'];
const HOTSPOT_TYPES = ['door', 'clue', 'lock'];

function sceneErrors(label, scene, roomIds) {
  const errs = [];
  const seen = new Set();
  for (const h of scene.hotspots ?? []) {
    if (!h.id || seen.has(h.id)) errs.push(`${label}: hotspot id missing or duplicate (${h.id})`);
    seen.add(h.id);
    if (!HOTSPOT_TYPES.includes(h.type)) errs.push(`${label}.${h.id}: unknown type "${h.type}"`);
    if (h.type === 'door' && h.to !== 'lobby' && !roomIds.includes(h.to)) {
      errs.push(`${label}.${h.id}: door to unknown scene "${h.to}"`);
    }
    if (h.type === 'clue' && !h.content?.kind) errs.push(`${label}.${h.id}: clue needs content.kind`);
  }
  return errs;
}

// Returns a list of problems; empty list = valid pack.
export function validatePack(p) {
  const errs = REQUIRED.filter((k) => p?.[k] === undefined).map((k) => `missing ${k}`);
  if (errs.length) return errs;

  const roomIds = Object.keys(p.rooms);
  errs.push(...sceneErrors('lobby', p.lobby, roomIds));
  if ((p.lobby.hotspots ?? []).filter((h) => h.type === 'lock').length !== 1) {
    errs.push('lobby needs exactly one "lock" hotspot');
  }
  for (const [id, r] of Object.entries(p.rooms)) {
    // Interactive rooms (views + objects) are checked by the engine; the rest are hotspot scenes.
    errs.push(...(isInteractive(r) ? roomErrors(id, r) : sceneErrors(id, r, roomIds)));
    const okDigits = Array.isArray(r.digits) && r.digits.every((d) => Number.isInteger(d) && d >= 0 && d <= 9);
    if (!okDigits) errs.push(`${id}: digits must be an array of integers 0-9`);
  }
  for (const [cap, v] of Object.entries(p.variants)) {
    const n = Number(cap);
    const unknown = (v.rooms ?? []).filter((r) => !roomIds.includes(r));
    if (unknown.length) { errs.push(`variant ${n}: unknown rooms ${unknown.join(',')}`); continue; }
    const total = v.rooms.reduce((s, r) => s + (p.rooms[r].digits?.length ?? 0), 0);
    if (total !== n) errs.push(`variant ${n}: active rooms hold ${total} digits, lock needs ${n}`);
    if (!(v.minutes > 0)) errs.push(`variant ${n}: minutes must be > 0`);
  }
  return errs;
}

export function listPacks() {
  const out = [];
  for (const [id, p] of Object.entries(PACKS)) {
    const errs = validatePack(p);
    if (errs.length) { console.warn(`skipping invalid pack ${id}: ${errs.join('; ')}`); continue; }
    out.push({
      id, name: p.name, theme: p.theme, theme_fa: p.theme_fa || p.theme,
      min_players: p.min_players, max_players: p.max_players,
    });
  }
  return out;
}

export function getPack(id) {
  const p = PACKS[id];
  if (!p) throw new Error(`pack not found: ${id}`);
  const errs = validatePack(p);
  if (errs.length) throw new Error(`pack ${id} invalid: ${errs.join('; ')}`);
  return p;
}

// The concrete setup for a team of n: active rooms, timer, and the secret digits.
export function getVariant(pack, n) {
  const v = pack.variants?.[n];
  if (!v) throw new Error(`no variant for ${n} players`);
  return {
    capacity: n,
    rooms: v.rooms,
    minutes: v.minutes,
    digits: v.rooms.flatMap((r) => pack.rooms[r].digits), // SECRET — server only
  };
}

export const stripScene = (scene, active) => ({
  name_fa: scene.name_fa,
  image: scene.image,
  bg: scene.bg,
  // hide doors that lead to rooms inactive for this team size
  hotspots: (scene.hotspots ?? []).filter((h) => h.type !== 'door' || h.to === 'lobby' || active.includes(h.to)),
});

// What the Mini App may see: scenes + hotspots + clue content. Never the digits.
export function publicView(pack, n) {
  const v = getVariant(pack, n);
  const scenes = { lobby: stripScene(pack.lobby, v.rooms) };
  for (const id of v.rooms) scenes[id] = stripScene(pack.rooms[id], v.rooms);
  return { name: pack.name, minutes: v.minutes, lockLength: n, scenes };
}