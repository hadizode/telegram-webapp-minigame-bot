// Data-only rule interpreter. PURE: no sdk, no DB, no clock, no randomness, no eval.
//
// A rule lives in `rules: []` of an object, a view (views[name].rules) or a room (room.rules):
//   { on, if?: [checks that must ALL pass], do?: [effects], else?: [effects] }
//
// on (trigger):  'click' | 'use:<item>' | 'enter' | 'state:<obj>[=<state>]' | 'flag:<name>' | 'solved[:<room>]'
//   click / use  -> only on object rules      enter -> only on view / room rules
//   state / flag / solved -> anywhere (this is how effects chain into other rules, across rooms)
// refs: a bare id means "this room"; "room:id" reaches another room.
// checks: {state:obj, is|isnt} {done:[obj..]} {has:item} {using:item|false} {holding:true}
//         {solved:room} {flag:name, is|isnt|gte|lte} {view:name}
// effects: {set:obj,to} {show:obj} {hide:obj} {image:obj,to} {bg:view,to} {give:item} {take:item}
//          {audio:path} {say:text,to:'actor'|'team',bad?,audio?} {read:{text?,image?}} {goto:view}
//          {flag:name,set|inc} {digit:room} {solve:room} {stop:true}   (stop = ends this trigger's rule list)
//
// Legacy object fields (action/requires/sets/setState/accepts/item/hidden/decoy/text/failText/doneText/
// audio/images/labels, room.win) are compiled into rules by legacyRules() and run AFTER explicit rules.

export const MAX_STEPS = 50; // chained events (state/flag/solved) per player action
export const ENTER_PREFIX = '@enter:'; // object id the client sends to report "entered view <name>"

export const isDone = (objs, id) => id in objs && !['idle', 'hidden'].includes(objs[id]);

const norm = (v) => (v === true ? 1 : v === false ? 0 : v);
export const ref = (raw, room) => {
  const s = String(raw);
  const i = s.indexOf(':');
  return i < 0 ? { room, id: s } : { room: s.slice(0, i), id: s.slice(i + 1) };
};

// ---------------------------------------------------------------------------------------------
// Legacy compiler: reproduces the old act() decision chain as ordered guard rules ({stop} ends it).
export function legacyRules(id, o) {
  if (!o.action) return [];
  const bad = (text) => [{ say: text, to: 'actor', bad: true }, { stop: true }];
  if (o.action === 'goto') return [{ on: 'click', do: [{ stop: true }] }];
  if (o.decoy) return [{ on: 'click', do: bad(o.failText || '❌ هیچ اتفاقی نیفتاد') }];

  const R = [];
  const repeat = o.action === 'examine' || o.action === 'play';
  const dText = o.doneText || (repeat ? o.text : '✔️ این کار قبلاً انجام شده');
  const dAudio = repeat && !o.doneText ? o.audio : undefined;
  const d = [];
  if (dText !== undefined || dAudio !== undefined) d.push({ say: dText, to: 'actor', audio: dAudio });
  d.push({ stop: true });
  R.push({ on: 'click', if: [{ state: id, isnt: 'idle' }], do: d });

  if ((o.requires || []).length) {
    R.push({ on: 'click', if: [{ done: o.requires }], else: bad(o.failText || '🔒 هنوز نمی‌تونی این کار رو بکنی') });
  }
  if (o.action === 'place') {
    R.push({ on: 'click', if: [{ using: false }], do: bad('🎒 اول یه آیتم از کوله‌ت انتخاب کن') });
    R.push({ on: 'click', if: [{ holding: true }], else: bad('🎒 این آیتم رو نداری') });
    R.push({ on: 'click', if: [{ using: o.accepts }], else: bad(o.failText || '🤔 این اینجا جواب نمی‌ده') });
  }
  const fx = [];
  if (o.action === 'place') fx.push({ take: o.accepts });
  if (o.action === 'pickup') fx.push({ give: o.item || id });
  let next = o.setState;
  if (!next) next = o.action === 'pickup' ? 'taken' : o.action === 'examine' ? (o.sets ? 'done' : null) : 'done';
  const text = o.text || (o.action === 'pickup' ? '🎒 برداشتی' : '✅');
  if (!next) fx.push({ say: text, to: 'actor', audio: o.audio });
  else {
    fx.push({ set: id, to: next });
    for (const [k, v] of Object.entries(o.sets || {})) fx.push({ set: k, to: v });
    fx.push({ say: text, to: 'team', audio: o.audio });
  }
  R.push({ on: 'click', do: fx });
  return R;
}

// ---------------------------------------------------------------------------------------------
// Triggers
function parseOn(on) {
  const s = String(on);
  if (s === 'click' || s === 'enter' || s === 'solved') return { kind: s };
  const i = s.indexOf(':');
  if (i < 0) return null;
  const kind = s.slice(0, i);
  const arg = s.slice(i + 1);
  if (!arg) return null;
  if (kind === 'use' || kind === 'flag' || kind === 'solved') return { kind, arg };
  if (kind === 'state') {
    const j = arg.lastIndexOf('=');
    return j < 0 ? { kind, arg } : { kind, arg: arg.slice(0, j), val: arg.slice(j + 1) };
  }
  return null;
}

function matches(p, ev, rid) {
  switch (p.kind) {
    case 'click': return ev.on === 'click';
    case 'use': return ev.on === 'use' && ev.item === p.arg;
    case 'enter': return ev.on === 'enter';
    case 'state': {
      if (ev.on !== 'state') return false;
      const r = ref(p.arg, rid);
      return r.room === ev.room && r.id === ev.obj && (p.val === undefined || p.val === ev.to);
    }
    case 'flag': return ev.on === 'flag' && ev.name === p.arg;
    case 'solved': return ev.on === 'solved' && (p.arg === undefined || p.arg === ev.room);
    default: return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Interpreter
class CascadeError extends Error {}

function makeWorld(rooms, gs, by, withItem, view) {
  const g = JSON.parse(JSON.stringify(gs)); // draft: only committed if the whole run succeeds
  g.flags ||= {}; g.imgs ||= {}; g.bgs ||= {}; g.shown ||= [];
  return {
    rooms, gs: g, by, withItem: withItem || null, view: view || null,
    queue: [], steps: 0, dirty: false, touched: new Set(), solved: [], n: g.seq + 1,
    out: { ok: true, msgs: [] }, memo: new Map(),
  };
}

function objRules(w, rid, oid) {
  const k = `${rid}:${oid}`;
  if (!w.memo.has(k)) {
    const o = w.rooms[rid]?.objects?.[oid];
    w.memo.set(k, o ? [...(o.rules || []), ...legacyRules(oid, o)] : []);
  }
  return w.memo.get(k);
}

function sources(w, ev) {
  const out = [];
  const add = (rid, rules) => { for (const r of rules || []) out.push([rid, r]); };
  if (ev.on === 'click' || ev.on === 'use') add(ev.room, objRules(w, ev.room, ev.obj));
  else if (ev.on === 'enter') {
    const rm = w.rooms[ev.room];
    add(ev.room, rm.rules);
    add(ev.room, rm.views?.[ev.view]?.rules);
  } else {
    for (const [rid, rm] of Object.entries(w.rooms)) {
      add(rid, rm.rules);
      for (const v of Object.values(rm.views || {})) add(rid, v.rules);
      for (const oid of Object.keys(rm.objects || {})) add(rid, objRules(w, rid, oid));
    }
  }
  return out;
}

const LEAVES = ['state', 'done', 'has', 'using', 'holding', 'solved', 'flag', 'view'];

function holds(w, rid, c) {
  const g = w.gs;
  switch (LEAVES.find((k) => k in c)) {
    case 'state': {
      const r = ref(c.state, rid);
      const s = g.objs[r.room]?.[r.id];
      return 'isnt' in c ? s !== c.isnt : s === c.is;
    }
    case 'done': return [].concat(c.done).every((x) => { const r = ref(x, rid); return isDone(g.objs[r.room] || {}, r.id); });
    case 'has': return g.inv.includes(c.has);
    case 'using': return c.using === false ? !w.withItem : w.withItem === c.using;
    case 'holding': return (!!w.withItem && g.inv.includes(w.withItem)) === !!c.holding;
    case 'solved': return !!g.done[c.solved];
    case 'flag': {
      const v = g.flags[c.flag] ?? 0;
      if ('is' in c) return v === norm(c.is);
      if ('isnt' in c) return v !== norm(c.isnt);
      if ('gte' in c) return v >= c.gte;
      if ('lte' in c) return v <= c.lte;
      return !!v;
    }
    case 'view': return w.view === c.view;
    default: return false;
  }
}

function setState(w, r, to) {
  const objs = w.gs.objs[r.room];
  if (!objs || !(r.id in objs)) return;
  w.dirty = true;
  w.touched.add(r.room);
  const from = objs[r.id];
  if (from === to) return;
  objs[r.id] = to;
  w.queue.push({ on: 'state', room: r.room, obj: r.id, from, to });
}

function solveRoom(w, room) {
  if (!w.rooms[room] || w.gs.done[room]) return;
  w.gs.done[room] = true;
  w.solved.push(room);
  w.dirty = true;
  w.queue.push({ on: 'solved', room });
}

export const VERBS = ['stop', 'flag', 'say', 'set', 'show', 'hide', 'image', 'bg', 'give', 'take', 'audio', 'read', 'goto', 'digit', 'solve'];

function effect(w, rid, e) {
  const g = w.gs;
  const o = w.out;
  switch (VERBS.find((k) => k in e)) {
    case 'flag': {
      const cur = g.flags[e.flag] ?? 0;
      const next = 'inc' in e ? Number(cur) + Number(e.inc) : norm(e.set);
      if (cur !== next) { g.flags[e.flag] = next; w.dirty = true; w.queue.push({ on: 'flag', name: e.flag }); }
      break;
    }
    case 'say':
      if (e.say !== undefined && e.say !== null) {
        o.text = e.say;
        o.msgs.push({ text: e.say, bad: !!e.bad });
        if (e.bad) o.ok = false;
        if (e.to === 'team') { g.log = [...g.log, { n: w.n, by: w.by, text: e.say, audio: e.audio }].slice(-30); w.dirty = true; }
      }
      if (e.audio) o.audio = e.audio;
      break;
    case 'set': setState(w, ref(e.set, rid), e.to); break;
    case 'show': { const r = ref(e.show, rid); if (g.objs[r.room]?.[r.id] === 'hidden') setState(w, r, 'idle'); break; }
    case 'hide': setState(w, ref(e.hide, rid), 'hidden'); break;
    case 'image': { const r = ref(e.image, rid); if (g.objs[r.room]?.[r.id] !== undefined) { g.imgs[`${r.room}:${r.id}`] = e.to; w.dirty = true; } break; }
    case 'bg': { const r = ref(e.bg, rid); if (w.rooms[r.room]?.views?.[r.id]) { g.bgs[`${r.room}:${r.id}`] = e.to; w.dirty = true; } break; }
    case 'give': g.inv.push(e.give); w.dirty = true; break;
    case 'take': { const i = g.inv.indexOf(e.take); if (i >= 0) { g.inv.splice(i, 1); w.dirty = true; } break; }
    case 'audio': o.audio = e.audio; break;
    case 'read': o.read = { ...(e.read.text !== undefined && { text: e.read.text }), ...(e.read.image !== undefined && { image: e.read.image }) }; break;
    case 'goto': { const r = ref(e.goto, rid); o.goto = { room: r.room, view: r.id }; break; }
    case 'digit': if (w.rooms[e.digit] && !g.shown.includes(e.digit)) { g.shown.push(e.digit); w.dirty = true; } break;
    case 'solve': solveRoom(w, e.solve); break;
    default: break;
  }
}

// Returns true when a {stop} effect ended the list.
function exec(w, rid, effects) {
  for (const e of effects || []) {
    if (e.stop) return true;
    effect(w, rid, e);
  }
  return false;
}

// Runs every rule matching `ev`. Returns true if at least one branch executed.
function dispatch(w, ev) {
  let fired = false;
  for (const [rid, rule] of sources(w, ev)) {
    const p = parseOn(rule.on);
    if (!p || !matches(p, ev, rid)) continue;
    const pass = [].concat(rule.if ?? []).every((c) => holds(w, rid, c));
    const branch = pass ? rule.do : rule.else;
    if (!branch || !branch.length) continue;
    fired = true;
    if (exec(w, rid, branch)) break;
  }
  return fired;
}

// Drains chained events; after each full drain, implicit room.win checks (legacy `win`) may solve rooms.
function drain(w) {
  for (;;) {
    while (w.queue.length) {
      if (++w.steps > MAX_STEPS) throw new CascadeError(`cascade limit (${MAX_STEPS}) exceeded`);
      dispatch(w, w.queue.shift());
    }
    const touched = [...w.touched];
    w.touched.clear();
    for (const rid of touched) {
      const rm = w.rooms[rid];
      const need = rm?.win?.requires;
      if (need && !w.gs.done[rid] && need.every((r) => isDone(w.gs.objs[rid], r))) solveRoom(w, rid);
    }
    if (!w.queue.length) break;
  }
}

function finish(w, gs) {
  const o = w.out;
  if (w.dirty) {
    w.gs.seq = w.n;
    for (const k of Object.keys(w.gs)) gs[k] = w.gs[k];
  }
  return {
    ok: o.ok, text: o.text, audio: o.audio, changed: w.dirty, solved: w.solved.length > 0,
    solvedRooms: w.solved, msgs: o.msgs, read: o.read, goto: o.goto,
  };
}

const failed = (e) => {
  if (!(e instanceof CascadeError)) throw e;
  return { ok: false, text: '⚠️ زنجیره‌ی رویدادها خیلی طولانی شد؛ اتفاقی نیفتاد', changed: false, error: e.message, msgs: [] };
};

// rooms: { roomId: interactiveRoom } (the ACTIVE rooms). Mutates gs only if the run succeeds.
export function runAct(rooms, roomId, gs, id, withItem, by) {
  const w = makeWorld(rooms, gs, by, withItem);
  const o = rooms[roomId]?.objects?.[id];
  const s = w.gs.objs[roomId]?.[id];
  if (!o || !s || s === 'hidden' || s === 'taken') return { ok: false, text: '🔎 چیزی اینجا پیدا نشد' };
  try {
    let fired = false;
    if (withItem) fired = dispatch(w, { on: 'use', room: roomId, obj: id, item: withItem });
    if (!fired) dispatch(w, { on: 'click', room: roomId, obj: id });
    drain(w);
  } catch (e) { return failed(e); }
  return finish(w, gs);
}

export function runEnter(rooms, roomId, gs, view, by) {
  if (!rooms[roomId]?.views?.[view]) return { ok: false, changed: false, msgs: [] };
  const w = makeWorld(rooms, gs, by, null, view);
  try {
    dispatch(w, { on: 'enter', room: roomId, view });
    drain(w);
  } catch (e) { return failed(e); }
  return finish(w, gs);
}

// ---------------------------------------------------------------------------------------------
// Validation
const EXTRA = { set: ['to'], image: ['to'], bg: ['to'], say: ['to', 'bad', 'audio'], flag: ['set', 'inc'] };
const LEAF_EXTRA = { state: ['is', 'isnt'], flag: ['is', 'isnt', 'gte', 'lte'] };

export const hasSolveFor = (room, id) => {
  const all = [...(room.rules || []), ...Object.values(room.views || {}).flatMap((v) => v.rules || []),
    ...Object.values(room.objects || {}).flatMap((o) => o.rules || [])];
  return all.some((r) => [].concat(r.do || [], r.else || []).some((e) => e.solve === id));
};

// cx = { rooms: {id: room}, roomId, where: 'object' | 'view' | 'room' }
export function ruleErrors(at, rules, cx) {
  if (rules === undefined) return [];
  if (!Array.isArray(rules)) return [`${at}: rules must be an array`];
  const errs = [];
  const rooms = cx.rooms;
  const interactive = (rm) => !!rm && typeof rm.objects === 'object';
  const objOk = (raw) => { if (typeof raw !== 'string' || !raw) return false; const r = ref(raw, cx.roomId); return !!rooms[r.room]?.objects?.[r.id]; };
  const viewOk = (raw) => { if (typeof raw !== 'string' || !raw) return false; const r = ref(raw, cx.roomId); return !!rooms[r.room]?.views?.[r.id]; };
  const roomOk = (raw) => typeof raw === 'string' && interactive(rooms[raw]);
  const itemOk = (raw) => typeof raw === 'string' && Object.values(rooms).some((rm) => rm?.items && raw in rm.items);
  const str = (v) => typeof v === 'string' && v.length > 0;

  rules.forEach((r, i) => {
    const p = `${at}.rules[${i}]`;
    if (!r || typeof r !== 'object' || Array.isArray(r)) { errs.push(`${p}: rule must be an object`); return; }
    for (const k of Object.keys(r)) if (!['on', 'if', 'do', 'else'].includes(k)) errs.push(`${p}: unknown field "${k}"`);
    const on = parseOn(r.on);
    if (!on) errs.push(`${p}: bad trigger "${r.on}"`);
    else {
      if ((on.kind === 'click' || on.kind === 'use') && cx.where !== 'object') errs.push(`${p}: "${r.on}" only works on object rules`);
      if (on.kind === 'enter' && cx.where === 'object') errs.push(`${p}: "enter" only works on view or room rules`);
      if (on.kind === 'use' && !itemOk(on.arg)) errs.push(`${p}: unknown item "${on.arg}"`);
      if (on.kind === 'state' && !objOk(on.arg)) errs.push(`${p}: trigger on unknown object "${on.arg}"`);
      if (on.kind === 'solved' && on.arg !== undefined && !roomOk(on.arg)) errs.push(`${p}: trigger on unknown room "${on.arg}"`);
    }
    const conds = r.if === undefined ? [] : r.if;
    if (!Array.isArray(conds)) errs.push(`${p}.if: must be an array`);
    else conds.forEach((c, j) => {
      const q = `${p}.if[${j}]`;
      if (!c || typeof c !== 'object') { errs.push(`${q}: must be an object`); return; }
      const leaf = LEAVES.find((k) => k in c);
      if (!leaf) { errs.push(`${q}: unknown check`); return; }
      for (const k of Object.keys(c)) if (k !== leaf && !(LEAF_EXTRA[leaf] || []).includes(k)) errs.push(`${q}: unexpected field "${k}"`);
      if (leaf === 'state' && !objOk(c.state)) errs.push(`${q}: unknown object "${c.state}"`);
      if (leaf === 'state' && !('is' in c) && !('isnt' in c)) errs.push(`${q}: state needs is or isnt`);
      if (leaf === 'done') for (const x of [].concat(c.done)) if (!objOk(x)) errs.push(`${q}: unknown object "${x}"`);
      if (leaf === 'has' && !itemOk(c.has)) errs.push(`${q}: unknown item "${c.has}"`);
      if (leaf === 'using' && c.using !== false && !itemOk(c.using)) errs.push(`${q}: unknown item "${c.using}"`);
      if (leaf === 'solved' && !roomOk(c.solved)) errs.push(`${q}: unknown room "${c.solved}"`);
      if (leaf === 'flag' && !str(c.flag)) errs.push(`${q}: flag needs a name`);
      if (leaf === 'view' && !viewOk(c.view)) errs.push(`${q}: unknown view "${c.view}"`);
    });
    for (const branch of ['do', 'else']) {
      const list = r[branch];
      if (list === undefined) continue;
      if (!Array.isArray(list)) { errs.push(`${p}.${branch}: must be an array`); continue; }
      list.forEach((e, j) => {
        const q = `${p}.${branch}[${j}]`;
        if (!e || typeof e !== 'object') { errs.push(`${q}: must be an object`); return; }
        const verb = VERBS.find((k) => k in e);
        if (!verb) { errs.push(`${q}: unknown effect`); return; }
        for (const k of Object.keys(e)) if (k !== verb && !(EXTRA[verb] || []).includes(k)) errs.push(`${q}: unexpected field "${k}"`);
        const v = e[verb];
        if ((verb === 'set' || verb === 'show' || verb === 'hide' || verb === 'image') && !objOk(v)) errs.push(`${q}: unknown object "${v}"`);
        if ((verb === 'set' || verb === 'image' || verb === 'bg') && !str(e.to) && !(verb !== 'set' && e.to && typeof e.to === 'object')) errs.push(`${q}: needs "to"`);
        if (verb === 'bg' && !viewOk(v)) errs.push(`${q}: unknown view "${v}"`);
        if ((verb === 'give' || verb === 'take') && !itemOk(v)) errs.push(`${q}: unknown item "${v}"`);
        if (verb === 'say') {
          if (typeof v !== 'string') errs.push(`${q}: say needs text`);
          if (e.to !== undefined && !['actor', 'team'].includes(e.to)) errs.push(`${q}: to must be actor or team`);
        }
        if (verb === 'audio' && !str(v)) errs.push(`${q}: audio needs a path`);
        if (verb === 'read' && !(v && typeof v === 'object' && (str(v.text) || str(v.image)))) errs.push(`${q}: read needs {text} or {image}`);
        if (verb === 'goto' && !viewOk(v)) errs.push(`${q}: unknown view "${v}"`);
        if (verb === 'flag') {
          if (!str(v)) errs.push(`${q}: flag needs a name`);
          if (('set' in e) === ('inc' in e)) errs.push(`${q}: flag needs exactly one of set / inc`);
          if ('inc' in e && typeof e.inc !== 'number') errs.push(`${q}: inc must be a number`);
        }
        if ((verb === 'digit' || verb === 'solve') && !roomOk(v)) errs.push(`${q}: unknown room "${v}"`);
        if (verb === 'stop' && v !== true) errs.push(`${q}: stop must be true`);
      });
    }
    if (r.do === undefined && r.else === undefined) errs.push(`${p}: rule has no do or else`);
  });
  return errs;
}