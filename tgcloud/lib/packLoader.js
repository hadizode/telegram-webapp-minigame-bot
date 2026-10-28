import { PACKS } from './packs/index.js';
import { roomErrors, isInteractive } from './engine.js';

const REQUIRED = ['theme', 'name', 'min_players', 'max_players', 'lobby', 'rooms', 'variants'];
const HOTSPOT_TYPES = ['door', 'clue', 'lock'];

// Legacy hotspot-only rooms (no `objects`).
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

  // The lobby is an interactive "hub" room; the other rooms are interactive or legacy hotspot scenes.
  if (isInteractive(p.lobby)) errs.push(...roomErrors('lobby', p.lobby, { hub: true, roomIds }));
  else errs.push('lobby must be an interactive room (views + objects)');

  for (const [id, r] of Object.entries(p.rooms)) {
    errs.push(...(isInteractive(r) ? roomErrors(id, r, { roomIds }) : sceneErrors(id, r, roomIds)));
    const okDigits = Array.isArray(r.digits) && r.digits.every((d) => Number.isInteger(d) && d >= 0 && d <= 9);
    if (!okDigits) errs.push(`${id}: digits must be an array of integers 0-9`);
  }

  // requires / sets / win references: "obj" = same room, "room.obj" = any room (lobby included)
  const all = { lobby: p.lobby, ...p.rooms };
  const refOk = (rid, ref) => {
    const [tr, to] = String(ref).includes('.') ? String(ref).split('.') : [rid, ref];
    return !!all[tr]?.objects?.[to];
  };
  for (const [rid, r] of Object.entries(all)) {
    if (!isInteractive(r)) continue;
    for (const [oid, o] of Object.entries(r.objects)) {
      for (const ref of o.requires || []) if (!refOk(rid, ref)) errs.push(`${rid}.${oid}: requires unknown "${ref}"`);
      for (const k of Object.keys(o.sets || {})) if (!refOk(rid, k)) errs.push(`${rid}.${oid}: sets unknown "${k}"`);
    }
  }

  for (const [cap, v] of Object.entries(p.variants)) {
    const n = Number(cap);
    const vr = v.rooms ?? [];
    const unknown = vr.filter((r) => !roomIds.includes(r));
    if (unknown.length) { errs.push(`variant ${n}: unknown rooms ${unknown.join(',')}`); continue; }
    const total = vr.reduce((s, r) => s + (p.rooms[r].digits?.length ?? 0), 0);
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

// Legacy hotspot scenes only: hide doors that lead to rooms inactive for this team size.
export const stripScene = (scene, active) => ({
  name_fa: scene.name_fa,
  image: scene.image,
  bg: scene.bg,
  hotspots: (scene.hotspots ?? []).filter((h) => h.type !== 'door' || h.to === 'lobby' || active.includes(h.to)),
});