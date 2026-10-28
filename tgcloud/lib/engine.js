// Pure puzzle engine: no DB, no Telegram. An "interactive room" is plain data (see packs/hospital/power.js)
// that lives in pack.rooms[<id>] next to the old hotspot-only rooms; it is recognised by having `objects`.
//
// Room fields: name_fa, bg, digits[], start (view name), views{name:{image, rules?}}, items{type:{name,image}},
//              win{requires:[objectIds], text}, objects{...}, rules[]
// Object fields (view,x,y,w,h required; action required unless the object has rules):
//   action    examine | play | pickup | place | use | toggle | goto
//   to        goto: target view (client-side only)
//   item      pickup: item type added to the team inventory
//   accepts   place: item type that must be selected (consumed)
//   requires  [objectIds] that must already be "done" (not idle/hidden)
//   sets      { objectId: state } applied on success (also reveals hidden objects with 'idle')
//   setState  state of this object after success (default: pickup->taken, examine->none, else done)
//   text / failText / doneText   messages
//   decoy     always fails with failText
//   hidden    starts invisible until another object sets it to 'idle'
//   audio     sound file under public/ (played for the actor; others get a play button in the log)
//   image / images{state} / labels{state}   visuals; an image given as {image,x,y,w,h} is a full-frame layer
//   rules     [{on, if, do, else}] — the open-ended event system, documented at the top of lib/rules.js.
//             The legacy fields above are compiled into rules internally (rules.js: legacyRules).
// `win` is optional when some rule of the room has a {solve:<thisRoom>} effect.

import { ENTER_PREFIX, hasSolveFor, isDone, ruleErrors, runAct, runEnter } from './rules.js';

export { ENTER_PREFIX };
export const ACTIONS = ['examine', 'play', 'pickup', 'place', 'use', 'toggle', 'goto'];
const PUBLIC = ['view', 'x', 'y', 'w', 'h', 'image', 'images', 'labels', 'action', 'to'];

export const isInteractive = (room) => !!room && typeof room.objects === 'object';

// Problems in an interactive room definition; empty = valid. `rooms` (all pack rooms) enables cross-room refs.
export function roomErrors(id, room, rooms = { [id]: room }) {
  const errs = [];
  const views = room.views || {};
  const objs = room.objects || {};
  const start = room.start || Object.keys(views)[0];
  if (!start || !views[start]) errs.push(`${id}: needs a valid start view`);
  const cx = (where) => ({ rooms, roomId: id, where });
  for (const [oid, o] of Object.entries(objs)) {
    const at = `${id}.${oid}`;
    if (/[:=]/.test(oid) || oid.startsWith('@')) errs.push(`${at}: object id must not contain ":" or "=" or start with "@"`);
    if (!views[o.view]) errs.push(`${at}: unknown view "${o.view}"`);
    for (const k of ['x', 'y', 'w', 'h']) if (typeof o[k] !== 'number') errs.push(`${at}: ${k} must be a number`);
    if (o.action === undefined && !(Array.isArray(o.rules) && o.rules.length)) errs.push(`${at}: needs an action or rules`);
    if (o.action !== undefined && !ACTIONS.includes(o.action)) errs.push(`${at}: unknown action "${o.action}"`);
    if (o.action === 'goto' && !views[o.to]) errs.push(`${at}: goto unknown view "${o.to}"`);
    if (o.action === 'place' && !o.decoy && !o.accepts) errs.push(`${at}: place needs "accepts"`);
    for (const r of o.requires || []) if (!objs[r]) errs.push(`${at}: requires unknown object "${r}"`);
    for (const k of Object.keys(o.sets || {})) if (!objs[k]) errs.push(`${at}: sets unknown object "${k}"`);
    errs.push(...ruleErrors(at, o.rules, cx('object')));
  }
  for (const [vid, v] of Object.entries(views)) {
    if (/[:=]/.test(vid)) errs.push(`${id}.${vid}: view id must not contain ":" or "="`);
    errs.push(...ruleErrors(`${id}.views.${vid}`, v.rules, cx('view')));
  }
  errs.push(...ruleErrors(id, room.rules, cx('room')));
  const need = room.win?.requires;
  if (room.win || !hasSolveFor(room, id)) {
    if (!Array.isArray(need) || !need.length) errs.push(`${id}: needs win.requires`);
    else for (const r of need) if (!objs[r]) errs.push(`${id}: win requires unknown object "${r}"`);
  }
  return errs;
}

// Whole-match state: shared inventory/log/seq, per-room object states, solved rooms,
// plus rule state (flags, image/background overrides, rooms whose digits were revealed early).
export function initialGame(pack, roomIds) {
  const objs = {};
  for (const id of roomIds) {
    const room = pack.rooms[id];
    if (!isInteractive(room)) continue;
    objs[id] = {};
    for (const [oid, o] of Object.entries(room.objects)) objs[id][oid] = o.hidden ? 'hidden' : 'idle';
  }
  return { seq: 0, log: [], inv: [], objs, done: {}, flags: {}, imgs: {}, bgs: {}, shown: [] };
}

// What the Mini App may see of an interactive room (never rules/requires/sets/accepts/texts).
export function publicRoom(id, room, gs) {
  const objects = [];
  for (const [oid, o] of Object.entries(room.objects)) {
    const state = gs.objs[id][oid];
    if (state === 'hidden' || state === 'taken') continue;
    const p = { id: oid, state };
    for (const k of PUBLIC) if (o[k] !== undefined) p[k] = o[k];
    const ov = gs.imgs?.[`${id}:${oid}`];
    if (ov !== undefined) { p.image = ov; delete p.images; }
    objects.push(p);
  }
  const roomEnter = (room.rules || []).some((r) => r.on === 'enter');
  const views = {};
  for (const [vn, v] of Object.entries(room.views)) {
    const { rules, ...rest } = v;
    views[vn] = { ...rest, image: gs.bgs?.[`${id}:${vn}`] ?? v.image };
    if (roomEnter || (rules || []).some((r) => r.on === 'enter')) views[vn].enter = true; // lets the client skip pointless calls
  }
  const done = !!gs.done[id];
  return {
    id,
    name: room.name_fa || room.name || id,
    start: room.start || Object.keys(room.views)[0],
    views,
    items: room.items || {},
    objects,
    done,
    win: done ? { text: room.win?.text, digits: room.digits || [] } : null,
  };
}

// rooms = { roomId: interactiveRoom } of the ACTIVE rooms. Mutates gs only when something changed.
// Returns { ok, text?, audio?, changed, solved, solvedRooms, msgs[], read?, goto?{room,view}, error? }.
export const act = (rooms, roomId, gs, id, withItem, by) => runAct(rooms, roomId, gs, id, withItem, by);

// The player entered a view: runs `enter` rules.
export const enter = (rooms, roomId, gs, view, by) => runEnter(rooms, roomId, gs, view, by);

export { isDone };
