// Pure room engine: no DB, no Telegram. Rooms are plain data (see packs/hospital/power.js).
//
// Object fields (all optional except view/x/y/w/h/action):
//   action    examine | play | pickup | place | use | toggle | goto
//   to        goto: target view name (handled client-side)
//   item      pickup: item type added to the team inventory
//   accepts   place: item type that must be selected (consumed)
//   requires  [objectIds] that must already be "done" (not idle/hidden)
//   sets      { objectId: state } applied on success (also reveals hidden objects with 'idle')
//   setState  state of this object after success (default: pickup->taken, examine->none, else done)
//   text / failText / doneText   messages
//   audio     path of a sound file (under public/) played for the player; others get a play button in the log
//   decoy     always fails with failText
//   hidden    starts invisible until another object sets it to 'idle'
//   image / images{state} / labels{state}   visuals (client only)
// Room fields: id, name, intro, start, items{type:{name,image}}, win{requires,digit,text}

const PUBLIC = ['view', 'x', 'y', 'w', 'h', 'image', 'images', 'labels', 'action', 'to'];
const isDone = (st, id) => id in st.objs && !['idle', 'hidden'].includes(st.objs[id]);

export function initialState(room) {
  const objs = {};
  for (const [id, o] of Object.entries(room.objects)) objs[id] = o.hidden ? 'hidden' : 'idle';
  return { objs, inv: [], seq: 0, log: [], done: false };
}

export function publicRoom(room, st) {
  const objects = [];
  for (const [id, o] of Object.entries(room.objects)) {
    const state = st.objs[id];
    if (state === 'hidden' || state === 'taken') continue;
    const p = { id, state };
    for (const k of PUBLIC) if (o[k] !== undefined) p[k] = o[k];
    objects.push(p);
  }
  return {
    id: room.id,
    name: room.name || room.id,
    start: room.start || Object.keys(room.views)[0],
    views: room.views,
    items: room.items || {},
    objects,
    inv: st.inv,
    seq: st.seq,
    log: st.log,
    done: st.done,
  };
}

// Mutates st. Returns { ok, text, changed?, solved? }.
export function act(room, st, id, withItem, by) {
  const o = room.objects[id];
  const s = st.objs[id];
  if (!o || !s || s === 'hidden' || s === 'taken') return { ok: false, text: '🔎 چیزی اینجا پیدا نشد' };
  if (o.action === 'goto') return { ok: true };
  if (o.decoy) return { ok: false, text: o.failText || '❌ هیچ اتفاقی نیفتاد' };

  if (s !== 'idle') {
    const repeat = o.action === 'examine' || o.action === 'play';
    return { ok: true, text: o.doneText || (repeat ? o.text : '✔️ این کار قبلاً انجام شده'), audio: repeat && !o.doneText ? o.audio : undefined };
  }
  if ((o.requires || []).some((r) => !isDone(st, r))) {
    return { ok: false, text: o.failText || '🔒 هنوز نمی‌تونی این کار رو بکنی' };
  }
  if (o.action === 'place') {
    if (!withItem) return { ok: false, text: '🎒 اول یه آیتم از کوله‌ت انتخاب کن' };
    const i = st.inv.indexOf(withItem);
    if (i < 0) return { ok: false, text: '🎒 این آیتم رو نداری' };
    if (withItem !== o.accepts) return { ok: false, text: o.failText || '🤔 این اینجا جواب نمی‌ده' };
    st.inv.splice(i, 1);
  }
  if (o.action === 'pickup') st.inv.push(o.item || id);

  let next = o.setState;
  if (!next) next = o.action === 'pickup' ? 'taken' : o.action === 'examine' ? (o.sets ? 'done' : null) : 'done';
  const text = o.text || (o.action === 'pickup' ? '🎒 برداشتی' : '✅');
  if (!next) return { ok: true, text, audio: o.audio };

  st.objs[id] = next;
  for (const [k, v] of Object.entries(o.sets || {})) if (k in st.objs) st.objs[k] = v;

  st.seq += 1;
  st.log = [...st.log, { n: st.seq, by, text, audio: o.audio }].slice(-30);

  let solved = false;
  const w = room.win;
  if (w && !st.done && w.requires.every((r) => isDone(st, r))) { st.done = true; solved = true; }
  return { ok: true, text, audio: o.audio, changed: true, solved };
}
