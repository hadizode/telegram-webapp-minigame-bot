// Pure puzzle engine: no DB, no Telegram. An "interactive room" is plain data (see packs/hospital/power.js)
// that lives in pack.rooms[<id>] next to the old hotspot-only rooms; it is recognised by having `objects`.
//
// Room fields: name_fa, bg, digits[], start (view name), views{name:{image}}, items{type:{name,image}},
//              win{requires:[objectIds], text}, objects{...}
// Object fields (view,x,y,w,h,action required):
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

export const ACTIONS = ['examine', 'play', 'pickup', 'place', 'use', 'toggle', 'goto'];
const PUBLIC = ['view', 'x', 'y', 'w', 'h', 'image', 'images', 'labels', 'action', 'to'];
const isDone = (objs, id) => id in objs && !['idle', 'hidden'].includes(objs[id]);

export const isInteractive = (room) => !!room && typeof room.objects === 'object';

// Problems in an interactive room definition; empty = valid.
export function roomErrors(id, room) {
  const errs = [];
  const views = room.views || {};
  const objs = room.objects || {};
  const start = room.start || Object.keys(views)[0];
  if (!start || !views[start]) errs.push(`${id}: needs a valid start view`);
  for (const [oid, o] of Object.entries(objs)) {
    const at = `${id}.${oid}`;
    if (!views[o.view]) errs.push(`${at}: unknown view "${o.view}"`);
    for (const k of ['x', 'y', 'w', 'h']) if (typeof o[k] !== 'number') errs.push(`${at}: ${k} must be a number`);
    if (!ACTIONS.includes(o.action)) errs.push(`${at}: unknown action "${o.action}"`);
    if (o.action === 'goto' && !views[o.to]) errs.push(`${at}: goto unknown view "${o.to}"`);
    if (o.action === 'place' && !o.decoy && !o.accepts) errs.push(`${at}: place needs "accepts"`);
    for (const r of o.requires || []) if (!objs[r]) errs.push(`${at}: requires unknown object "${r}"`);
    for (const k of Object.keys(o.sets || {})) if (!objs[k]) errs.push(`${at}: sets unknown object "${k}"`);
  }
  const need = room.win?.requires;
  if (!Array.isArray(need) || !need.length) errs.push(`${id}: needs win.requires`);
  else for (const r of need) if (!objs[r]) errs.push(`${id}: win requires unknown object "${r}"`);
  return errs;
}

// Whole-match state: shared inventory/log/seq, per-room object states, solved rooms.
export function initialGame(pack, roomIds) {
  const objs = {};
  for (const id of roomIds) {
    const room = pack.rooms[id];
    if (!isInteractive(room)) continue;
    objs[id] = {};
    for (const [oid, o] of Object.entries(room.objects)) objs[id][oid] = o.hidden ? 'hidden' : 'idle';
  }
  return { seq: 0, log: [], inv: [], objs, done: {} };
}

// What the Mini App may see of an interactive room (never requires/sets/accepts/texts).
export function publicRoom(id, room, gs) {
  const objects = [];
  for (const [oid, o] of Object.entries(room.objects)) {
    const state = gs.objs[id][oid];
    if (state === 'hidden' || state === 'taken') continue;
    const p = { id: oid, state };
    for (const k of PUBLIC) if (o[k] !== undefined) p[k] = o[k];
    objects.push(p);
  }
  const done = !!gs.done[id];
  return {
    id,
    name: room.name_fa || room.name || id,
    start: room.start || Object.keys(room.views)[0],
    views: room.views,
    items: room.items || {},
    objects,
    done,
    win: done ? { text: room.win.text, digits: room.digits || [] } : null,
  };
}

// Mutates gs. Returns { ok, text, audio?, changed?, solved? }.
export function act(room, roomId, gs, id, withItem, by) {
  const objs = gs.objs[roomId];
  const o = room.objects[id];
  const s = objs[id];
  if (!o || !s || s === 'hidden' || s === 'taken') return { ok: false, text: '🔎 چیزی اینجا پیدا نشد' };
  if (o.action === 'goto') return { ok: true };
  if (o.decoy) return { ok: false, text: o.failText || '❌ هیچ اتفاقی نیفتاد' };

  if (s !== 'idle') {
    const repeat = o.action === 'examine' || o.action === 'play';
    return { ok: true, text: o.doneText || (repeat ? o.text : '✔️ این کار قبلاً انجام شده'), audio: repeat && !o.doneText ? o.audio : undefined };
  }
  if ((o.requires || []).some((r) => !isDone(objs, r))) {
    return { ok: false, text: o.failText || '🔒 هنوز نمی‌تونی این کار رو بکنی' };
  }
  if (o.action === 'place') {
    if (!withItem) return { ok: false, text: '🎒 اول یه آیتم از کوله‌ت انتخاب کن' };
    const i = gs.inv.indexOf(withItem);
    if (i < 0) return { ok: false, text: '🎒 این آیتم رو نداری' };
    if (withItem !== o.accepts) return { ok: false, text: o.failText || '🤔 این اینجا جواب نمی‌ده' };
    gs.inv.splice(i, 1);
  }
  if (o.action === 'pickup') gs.inv.push(o.item || id);

  let next = o.setState;
  if (!next) next = o.action === 'pickup' ? 'taken' : o.action === 'examine' ? (o.sets ? 'done' : null) : 'done';
  const text = o.text || (o.action === 'pickup' ? '🎒 برداشتی' : '✅');
  if (!next) return { ok: true, text, audio: o.audio };

  objs[id] = next;
  for (const [k, v] of Object.entries(o.sets || {})) if (k in objs) objs[k] = v;

  gs.seq += 1;
  gs.log = [...gs.log, { n: gs.seq, by, text, audio: o.audio }].slice(-30);

  let solved = false;
  if (!gs.done[roomId] && room.win.requires.every((r) => isDone(objs, r))) { gs.done[roomId] = true; solved = true; }
  return { ok: true, text, audio: o.audio, changed: true, solved };
}
