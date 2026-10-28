const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const $ = (id) => document.getElementById(id);
const call = (name, input) =>
  new Promise((ok, no) => tg.Serverless.call(name, input, (err, res) => (err ? no(err) : ok(res))));
const url = (p) => '/' + encodeURI(String(p).replace(/^\/+/, ''));
const mk = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
if (new URLSearchParams(location.search).has('debug')) document.body.classList.add('debug');

const ENTER = '@enter:'; // must match ENTER_PREFIX in tgcloud/lib/rules.js
let G = null;            // last game snapshot from the server
let where = 'lobby';     // 'lobby' | hotspot room id | interactive room id
const curView = {};      // interactive room id -> current view name
let sel = null, seq = -1, busy = false, toastTimer, sound;
let lastLog = null;      // highest team-log entry already seen (null until the first snapshot)
let entered = null;      // "room:view" the server was last told about

function toast(text, ok = true) {
  const t = $('toast');
  t.textContent = text;
  t.className = ok ? '' : 'bad';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

function playSound(path) {
  if (!path) return;
  if (sound) sound.pause();
  sound = new Audio(url(path));
  sound.play().catch(() => toast('🔇 صدا پخش نشد', false));
}

// Reader overlay: text and/or an image opened by a rule's {read} effect. Tap anywhere to close.
function showReader(r) {
  let box = $('reader');
  if (!box) {
    box = mk('div');
    box.id = 'reader';
    box.onclick = () => (box.hidden = true);
    document.body.append(box);
  }
  box.replaceChildren();
  if (r.image) { const i = new Image(); i.src = url(r.image); i.draggable = false; box.append(i); }
  if (r.text) box.append(mk('p', '', r.text));
  box.hidden = false;
}

// Shared by clicks and view-enter reports: toast, sound, reader, jump to a view.
function handleResult(res) {
  if (!res) return;
  const text = res.msgs && res.msgs.length ? res.msgs.map((m) => m.text).join('\n') : res.text;
  if (text) toast(text, res.ok);
  if (res.ok) playSound(res.audio);
  if (res.read) showReader(res.read);
}

function apply(g, fromPoll) {
  if (!g || g.unchanged || g.notReady || g.seq < seq) return;
  G = g;
  seq = g.seq;
  // Team-wide messages written by other players arrive through the log: show them as a toast.
  const top = g.log.length ? g.log[g.log.length - 1].n : 0;
  if (fromPoll && lastLog !== null) {
    const fresh = g.log.filter((l) => l.n > lastLog);
    if (fresh.length) toast(fresh.map((l) => `${l.by}: ${l.text}`).join('\n'));
  }
  lastLog = Math.max(lastLog ?? 0, top);
  if (!G.scenes[where] && !G.rooms[where]) where = 'lobby';
  render();
}

// Countdown from the server-provided deadline (no clock trust in the client).
function tickTimer() {
  const t = $('timer');
  if (!t) return;
  if (!G || !G.deadline || G.end) { if (G?.end) t.textContent = ''; return; }
  const left = Math.max(0, G.deadline - Date.now());
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  t.textContent = `⏳ ${m}:${String(s).padStart(2, '0')}`;
  t.classList.toggle('warn', left < 5 * 60000);
  setTimeout(tickTimer, 1000);
}

function render() {
  if (G.end) { renderEnd(G.end); return; } // end screen takes over the whole app
  const room = G.rooms[where];
  $('title').textContent = room ? room.name : (G.scenes[where].name_fa || '');
  $('back').hidden = where === 'lobby';
  $('digits').textContent = G.found.join(' ');
  if (room) renderRoom(room); else renderScene(G.scenes[where]);
  renderInv();
  renderLog();
  renderBanner();
  notifyEnter(room);
  tickTimer();
}

// Tell the server when the player enters a view that has `enter` rules (the server marks those views).
function notifyEnter(room) {
  if (!room) { entered = null; return; }
  const view = curView[room.id] || room.start;
  const key = `${room.id}:${view}`;
  if (key === entered) return;
  entered = key;
  if (!room.views[view].enter) return;
  call('act', { room: room.id, object: ENTER + view, with: null })
    .then((r) => { handleResult(r.result); applyGoto(r.result); apply(r.game); })
    .catch(() => {});
}

function applyGoto(res) {
  const g = res && res.goto;
  if (!g || !G || !G.rooms[g.room] || !G.rooms[g.room].views[g.view]) return;
  curView[g.room] = g.view;
  where = g.room;
  render();
}

// ---- hotspot scenes (lobby and simple rooms) -------------------------------------------------
function renderScene(scene) {
  const st = $('stage');
  st.replaceChildren();
  st.className = 'simple';
  st.style.background = scene.bg || '#1b1f2a';
  if (scene.image) {
    const img = new Image();
    img.src = url(scene.image);
    img.draggable = false;
    img.onerror = () => img.remove();
    st.append(img);
  }
  for (const h of scene.hotspots) {
    const b = mk('button', 'hs ' + h.type, h.label_fa || '');
    b.style.cssText = `left:${h.x}%;top:${h.y}%;width:${h.w}%;height:${h.h}%`;
    b.onclick = () => onHotspot(h);
    st.append(b);
  }
}

function onHotspot(h) {
  if (h.type === 'door') { where = h.to; render(); }
  else if (h.type === 'lock') openKeypad(); // the exit lock — end of the game
  else toast(h.content?.text_fa || '…');
}

// ---- interactive rooms ------------------------------------------------------------------------
function renderRoom(room) {
  const view = (curView[room.id] ||= room.start);
  const st = $('stage');
  st.replaceChildren();
  st.className = '';
  st.style.background = '';
  const img = new Image();
  img.src = url(room.views[view].image);
  img.draggable = false;
  st.append(img);

  const here = room.objects.filter((o) => o.view === view);
  const picOf = (o) => (o.images && o.images[o.state]) || o.image;
  // Layers first (below the click areas): a state image written as { image, x, y, w, h }
  // is drawn at its own rectangle (default: the whole view) instead of inside the click area.
  for (const o of here) {
    const p = picOf(o);
    if (p && typeof p === 'object') {
      const i = new Image();
      i.src = url(p.image);
      i.className = 'layer';
      i.draggable = false;
      i.style.cssText = `left:${p.x ?? 0}%;top:${p.y ?? 0}%;width:${p.w ?? 100}%;height:${p.h ?? 100}%`;
      st.append(i);
    }
  }
  for (const o of here) {
    const b = mk('button', 'obj');
    b.style.cssText = `left:${o.x}%;top:${o.y}%;width:${o.w}%;height:${o.h}%`;
    const p = picOf(o);
    if (typeof p === 'string') { const i = new Image(); i.src = url(p); i.draggable = false; b.append(i); }
    const label = o.labels && o.labels[o.state];
    if (label) b.append(mk('span', '', label));
    b.onclick = () => onObj(room, o);
    st.append(b);
  }
}

async function onObj(room, o) {
  if (o.action === 'goto') { curView[room.id] = o.to; render(); return; }
  if (busy) return;
  busy = true;
  try {
    const r = await call('act', { room: room.id, object: o.id, with: sel });
    handleResult(r.result);
    if (r.result.ok && o.action === 'place') sel = null;
    apply(r.game);
    applyGoto(r.result);
  } catch (e) {
    toast(e.message || 'خطا', false);
  } finally {
    busy = false;
  }
}

// ---- shared UI --------------------------------------------------------------------------------
function itemDef(t) {
  for (const r of Object.values(G.rooms)) if (r.items[t]) return r.items[t];
  return {};
}

function renderInv() {
  const box = $('inv');
  box.replaceChildren();
  const counts = {};
  for (const t of G.inv) counts[t] = (counts[t] || 0) + 1;
  if (sel && !counts[sel]) sel = null;
  const types = Object.keys(counts);
  if (!types.length) { box.textContent = '🎒 کوله خالیه'; return; }
  for (const t of types) {
    const def = itemDef(t);
    const b = mk('button', 'item' + (t === sel ? ' sel' : ''));
    if (def.image) { const i = new Image(); i.src = url(def.image); b.append(i); }
    b.append((def.name || t) + (counts[t] > 1 ? ` ×${counts[t]}` : ''));
    b.onclick = () => { sel = sel === t ? null : t; renderInv(); };
    box.append(b);
  }
}

function renderLog() {
  $('log').replaceChildren(...G.log.slice(-3).map((l) => {
    const row = mk('div', '', `${l.by}: ${l.text} `);
    if (l.audio) { const b = mk('button', 'snd', '🔊'); b.onclick = () => playSound(l.audio); row.append(b); }
    return row;
  }));
}

function renderBanner() {
  const room = G.rooms[where];
  const b = $('banner');
  b.hidden = !(room && room.done);
  if (b.hidden) return;
  b.replaceChildren(mk('p', '', '🎉 ' + (room.win.text || 'اتاق حل شد!')));
  if (room.win.digits.length) b.append(mk('strong', '', room.win.digits.join(' ')));
  const btn = mk('button', '', 'بازگشت به لابی');
  btn.onclick = () => { where = 'lobby'; render(); };
  b.append(btn);
}

// ---- exit-lock keypad (the end of the game) --------------------------------------------------
const FA = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
const faNum = (s) => String(s).replace(/\d/g, (d) => FA[+d]);
let kpEntry = '';   // what this player has typed into the pad
let kpCdUntil = 0;  // local deadline for the wrong-code cooldown

function openKeypad() {
  if (!G || !G.lock) { toast('🔐 هنوز آماده نیست', false); return; }
  kpEntry = '';
  renderKeypad();
  $('keypad').hidden = false;
}

function renderKeypad() {
  const L = G.lock;
  // Slot cells: filled ones show the digit the team already logged (first-correct-wins),
  // empty ones show what THIS player is currently typing at that position.
  const slots = $('kpSlots');
  slots.replaceChildren();
  for (let i = 0; i < L.lockLength; i++) {
    const shown = L.slots[i] ?? kpEntry[i] ?? '';
    const c = mk('div', 'kslot' + (L.slots[i] ? ' filled' : ''), faNum(shown));
    slots.append(c);
  }
  $('kpFound').textContent = L.found.length ? 'رقم‌های پیداشده: ' + L.found.join(' ') : 'هنوز رقمی پیدا نکردید';
  $('kpHint').textContent = `رمز ${faNum(L.lockLength)} رقمی — هر ترتیبی`;
  // The server computes the cooldown from the event log; trust it over the local guess.
  if (L.cooldownMs > 0) kpCdUntil = Math.max(kpCdUntil, Date.now() + L.cooldownMs);
  const cdLeft = Math.max(0, kpCdUntil - Date.now());
  $('kpCd').hidden = !cdLeft;
  if (cdLeft) $('kpCd').textContent = `⛔ ${faNum(Math.ceil(cdLeft / 1000))} ثانیه صبر کن`;
}

function buildPad() {
  const pad = $('kpPad');
  pad.replaceChildren();
  for (let d = 1; d <= 9; d++) {
    const b = mk('button', '', FA[d]);
    b.onclick = () => press(d);
    pad.append(b);
  }
  pad.append(mk('span')); // spacer
  const z = mk('button', '', FA[0]);
  z.onclick = () => press(0);
  pad.append(z);
}

function press(d) {
  const max = (G?.lock?.lockLength ?? 4) - (G?.lock?.slots.filter((s) => s !== null).length ?? 0);
  if (kpEntry.length >= Math.max(1, max)) return;
  kpEntry += String(d);
  renderKeypad();
}

async function submitCode() {
  if (busy || !G || !G.lock) return;
  if (Date.now() < kpCdUntil) return renderKeypad();
  const code = kpEntry;
  if (!code) return toast('🔢 اول رمز رو بزن', false);
  busy = true;
  try {
    const r = await call('submitCode', { code });
    handleResult(r.result);
    apply(r.game); // a correct code brings snap.end → renderEnd takes over
    if (r.game && !r.game.end) { kpEntry = ''; renderKeypad(); } // wrong: keep the pad open
  } catch (e) {
    toast(e.message || 'خطا', false);
  } finally {
    busy = false;
  }
}

function tickCooldown() {
  if (!$('keypad').hidden) {
    const cdLeft = Math.max(0, kpCdUntil - Date.now());
    $('kpCd').hidden = !cdLeft;
    if (cdLeft) $('kpCd').textContent = `⛔ ${faNum(Math.ceil(cdLeft / 1000))} ثانیه صبر کن`;
  }
  setTimeout(tickCooldown, 500);
}

function renderEnd(end) {
  $('keypad').hidden = true;
  const box = $('end');
  box.hidden = false;
  box.className = end.won ? 'won' : 'lost';
  $('endTitle').textContent = end.title;
  $('endSub').textContent = end.subtitle || '';
  $('endCode').textContent = '🔑 ' + end.digits;
  $('endRanks').replaceChildren(...(end.players || []).map((p) => {
    const li = mk('li', '', `${FA[p.rank] ?? p.rank}. ${p.name}`);
    li.append(mk('b', '', `+${p.score} XP`));
    return li;
  }));
}

$('back').onclick = () => {
  const room = G && G.rooms[where];
  if (room && curView[room.id] && curView[room.id] !== room.start) curView[room.id] = room.start;
  else where = 'lobby';
  render();
};

async function poll() {
  try {
    apply(await call('getGame', { seq }), true);
  } catch (e) {
    if (!G) $('stage').textContent = e.message || 'خطا در اتصال';
  }
  setTimeout(poll, 2500);
}

buildPad();
$('kpClose').onclick = () => ($('keypad').hidden = true);
$('kpDel').onclick = () => { kpEntry = kpEntry.slice(0, -1); renderKeypad(); };
$('kpOk').onclick = submitCode;
tickCooldown();
poll();