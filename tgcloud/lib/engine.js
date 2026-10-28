// Pure puzzle engine: no DB, no Telegram. An "interactive room" is plain data
// that lives in pack.rooms[<id>] (or pack.lobby); it is recognised by having `objects`.
//
// Room fields: name_fa, bg, digits[], start (view name), views{name:{image}}, items{type:{name,image}},
//              win{requires:[refs], text}, objects{...}
//              The lobby is a "hub": no digits, no win, exactly one `lock` object.
// Object fields (view,x,y,w,h,action required; poly optional 4-point shape):
//   action    examine | play | pickup | place | use | toggle | goto | door | lock | show
//   to        goto: target view of the same room · door: target room id (or "lobby")
//   popup     show: image shown full screen, tap to close (client-side only)
//   item      pickup: item type added to the player's inventory
//   accepts   place: item type that must be selected (consumed)
//   requires  [refs] that must already be "done". A ref is "obj" (this room) or "room.obj" (any room).
//             On a door it gates the navigation (the server is asked, failText is shown).
//   sets      { ref: state } applied on success (also reveals hidden objects with 'idle')
//   setState  state of this object after success (default: pickup->taken, examine->none, else done)
//   text / failText / doneText   messages
//   decoy     always fails with failText
//   hidden    starts invisible until another object sets it to 'idle'
//   audio     sound file under public/
//   image / images{state} / labels{state}   visuals; an image given as {image,x,y,w,h} is a full-frame layer

export const ACTIONS = ['examine', 'play', 'pickup', 'place', 'use', 'toggle', 'goto', 'door', 'lock', 'show'];
const NAV = ['goto', 'door', 'lock', 'show']; // the client handles these; the server only checks `requires`
const PUBLIC = ['view', 'x', 'y', 'w', 'h', 'poly', 'image', 'images', 'labels', 'action', 'to', 'popup'];

const isDone = (objs, id) => id in objs && !['idle', 'hidden'].includes(objs[id]);

// ref = "obj" (same room) or "room.obj" (another room)
const isRefDone = (gs, roomId, ref) => {
  const [r, o] = String(ref).includes('.') ? String(ref).split('.') : [roomId, ref];
  const objs = gs.objs[r];
  return !!objs && isDone(objs, o);
};

export const isInteractive = (room) => !!room && typeof room.objects === 'object';

// Problems in one interactive room definition; empty = valid.
// (requires/sets references are checked across the whole pack by validatePack.)
// opts.hub: the lobby (no win/digits, one lock) · opts.roomIds: all room ids of the pack (door targets)
export function roomErrors(id, room, opts = {}) {
  const errs = [];
  const views = room.views || {};
  const objs = room.objects || {};
  const start = room.start || Object.keys(views)[0];
  if (!start || !views[start]) errs.push(`${id}: needs a valid start view`);
  for (const [oid, o] of Object.entries(objs)) {
    const at = `${id}.${oid}`;
    if (!views[o.view]) errs.push(`${at}: unknown view "${o.view}"`);
    for (const k of ['x', 'y', 'w', 'h']) if (typeof o[k] !== 'number') errs.push(`${at}: ${k} must be a number`);
    if (o.poly !== undefined && !(Array.isArray(o.poly) && o.poly.length >= 3 &&
      o.poly.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))) {
      errs.push(`${at}: poly must be a list of [x,y] points`);
    }
    if (!ACTIONS.includes(o.action)) errs.push(`${at}: unknown action "${o.action}"`);
    if (o.action === 'goto' && !views[o.to]) errs.push(`${at}: goto unknown view "${o.to}"`);
    if (o.action === 'show' && !o.popup) errs.push(`${at}: show needs "popup"`);
    if (o.action === 'door') {
      if (!o.to) errs.push(`${at}: door needs "to"`);
      else if (opts.roomIds && o.to !== 'lobby' && !opts.roomIds.includes(o.to)) errs.push(`${at}: door to unknown room "${o.to}"`);
    }
    if (o.action === 'place' && !o.decoy && !o.accepts) errs.push(`${at}: place needs "accepts"`);
  }
  if (opts.hub) {
    const locks = Object.values(objs).filter((o) => o.action === 'lock').length;
    if (locks !== 1) errs.push(`${id}: needs exactly one "lock" object (found ${locks})`);
  } else {
    const need = room.win?.requires;
    if (!Array.isArray(need) || !need.length) errs.push(`${id}: needs win.requires`);
    else for (const r of need) if (!objs[r]) errs.push(`${id}: win requires unknown object "${r}"`);
  }
  return errs;
}

// Whole-match state: per-player inventory, shared log/seq, per-room object states (lobby included), solved rooms.
export function initialGame(pack, roomIds) {
  const objs = {};
  for (const id of ['lobby', ...roomIds]) {
    const room = id === 'lobby' ? pack.lobby : pack.rooms[id];
    if (!isInteractive(room)) continue;
    objs[id] = {};
    for (const [oid, o] of Object.entries(room.objects)) objs[id][oid] = o.hidden ? 'hidden' : 'idle';
  }
  return { seq: 0, log: [], inv: {}, objs, done: {} };
}

// What the Mini App may see of an interactive room (never requires/sets/accepts/texts).
// `active` = room ids in play for this team size; doors to other rooms are hidden.
// A door whose `requires` are not met yet is flagged `gated`: the client asks the server before opening it.
export function publicRoom(id, room, gs, active) {
  const states = gs.objs[id] || {};
  const objects = [];
  for (const [oid, o] of Object.entries(room.objects)) {
    const state = states[oid] || 'idle';
    if (state === 'hidden' || state === 'taken') continue;
    if (o.action === 'door' && o.to !== 'lobby' && active && !active.includes(o.to)) continue;
    const p = { id: oid, state };
    for (const k of PUBLIC) if (o[k] !== undefined) p[k] = o[k];
    if (o.action === 'door' && (o.requires || []).some((r) => !isRefDone(gs, id, r))) p.gated = true;
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
    win: done && room.win ? { text: room.win.text, digits: room.digits || [] } : null,
  };
}

// Mutates gs. Returns { ok, text, audio?, changed?, solved? }.
export function act(room, roomId, gs, id, withItem, by, uid) {
  const objs = gs.objs[roomId];
  if (!objs) return { ok: false, text: '⚠️ این مچ قدیمیه؛ یه مچ تازه بساز' };
  const o = room.objects[id];
  const s = objs[id];
  if (!o || !s || s === 'hidden' || s === 'taken') return { ok: false, text: '🔎 چیزی اینجا پیدا نشد' };
  if (NAV.includes(o.action)) {
    if ((o.requires || []).some((r) => !isRefDone(gs, roomId, r))) {
      return { ok: false, text: o.failText || '🔒 هنوز نمی‌تونی این کار رو بکنی' };
    }
    return { ok: true };
  }
  const inv = (gs.inv[uid] ||= []);
  if (o.decoy) return { ok: false, text: o.failText || '❌ هیچ اتفاقی نیفتاد' };

  if (s !== 'idle') {
    const repeat = o.action === 'examine' || o.action === 'play';
    return { ok: true, text: o.doneText || (repeat ? o.text : '✔️ این کار قبلاً انجام شده'), audio: repeat && !o.doneText ? o.audio : undefined };
  }
  if ((o.requires || []).some((r) => !isRefDone(gs, roomId, r))) {
    return { ok: false, text: o.failText || '🔒 هنوز نمی‌تونی این کار رو بکنی' };
  }
  if (o.action === 'place') {
    if (!withItem) return { ok: false, text: '🎒 اول یه آیتم از کوله‌ت انتخاب کن' };
    const i = inv.indexOf(withItem);
    if (i < 0) return { ok: false, text: '🎒 این آیتم رو نداری' };
    if (withItem !== o.accepts) return { ok: false, text: o.failText || '🤔 این اینجا جواب نمی‌ده' };
    inv.splice(i, 1);
  }
  if (o.action === 'pickup') inv.push(o.item || id);

  let next = o.setState;
  if (!next) next = o.action === 'pickup' ? 'taken' : o.action === 'examine' ? (o.sets ? 'done' : null) : 'done';
  const text = o.text || (o.action === 'pickup' ? '🎒 برداشتی' : '✅');
  if (!next) return { ok: true, text, audio: o.audio };

  objs[id] = next;
  for (const [k, v] of Object.entries(o.sets || {})) {
    const [r, oid] = k.includes('.') ? k.split('.') : [roomId, k];
    const target = gs.objs[r];
    if (target && oid in target) target[oid] = v;
  }

  gs.seq += 1;
  gs.log = [...gs.log, { n: gs.seq, by, text, audio: o.audio }].slice(-30);

  let solved = false;
  if (!gs.done[roomId] && room.win && room.win.requires.every((r) => isRefDone(gs, roomId, r))) {
    gs.done[roomId] = true;
    solved = true;
  }
  return { ok: true, text, audio: o.audio, changed: true, solved };
}