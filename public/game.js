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

let room = null, view = null, sel = null, seq = -1, busy = false, toastTimer, sound;

function playSound(path) {
  if (!path) return;
  if (sound) sound.pause();
  sound = new Audio(url(path));
  sound.play().catch(() => toast('🔇 صدا پخش نشد', false));
}

function toast(text, ok = true) {
  const t = $('toast');
  t.textContent = text;
  t.className = ok ? '' : 'bad';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

function apply(r) {
  if (!r || r.unchanged || r.notReady || r.seq < seq) return;
  if (!room || room.id !== r.id) { view = r.start; sel = null; }
  room = r;
  seq = r.seq;
  render();
}

function render() {
  $('title').textContent = room.name;
  $('back').hidden = view === room.start;
  $('digits').textContent = room.digits.length ? room.digits.join(' ') : '';
  renderStage();
  renderInv();
  renderLog();
  renderBanner();
}

function renderStage() {
  const st = $('stage');
  st.replaceChildren();
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
    b.onclick = () => onObj(o);
    st.append(b);
  }
}

function renderInv() {
  const box = $('inv');
  box.replaceChildren();
  const counts = {};
  for (const t of room.inv) counts[t] = (counts[t] || 0) + 1;
  if (sel && !counts[sel]) sel = null;
  const types = Object.keys(counts);
  if (!types.length) { box.textContent = '🎒 کوله خالیه'; return; }
  for (const t of types) {
    const def = room.items[t] || {};
    const b = mk('button', 'item' + (t === sel ? ' sel' : ''));
    if (def.image) { const i = new Image(); i.src = url(def.image); b.append(i); }
    b.append((def.name || t) + (counts[t] > 1 ? ` ×${counts[t]}` : ''));
    b.onclick = () => { sel = sel === t ? null : t; renderInv(); };
    box.append(b);
  }
}

function renderLog() {
  $('log').replaceChildren(...room.log.slice(-3).map((l) => {
    const row = mk('div', '', `${l.by}: ${l.text} `);
    if (l.audio) { const b = mk('button', 'snd', '🔊'); b.onclick = () => playSound(l.audio); row.append(b); }
    return row;
  }));
}

function renderBanner() {
  const b = $('banner');
  b.hidden = !room.done;
  if (!room.done) return;
  b.replaceChildren(mk('p', '', '🎉 ' + (room.win?.text || 'اتاق حل شد!')));
  if (room.win?.digit !== undefined) b.append(mk('strong', '', String(room.win.digit)));
  const btn = mk('button', '', room.last ? 'همه‌ی اتاق‌ها تموم شد' : 'ورود به اتاق بعدی');
  if (room.last) btn.disabled = true; else btn.onclick = nextRoom;
  b.append(btn);
}

async function onObj(o) {
  if (o.action === 'goto') { view = o.to; render(); return; }
  if (busy) return;
  busy = true;
  try {
    const r = await call('act', { object: o.id, with: sel });
    toast(r.result.text, r.result.ok);
    if (r.result.ok) playSound(r.result.audio);
    if (r.result.ok && o.action === 'place') sel = null;
    apply(r.room);
  } catch (e) {
    toast(e.message || 'خطا', false);
  } finally {
    busy = false;
  }
}

async function nextRoom() {
  try { apply((await call('nextRoom', {})).room); } catch (e) { toast(e.message || 'خطا', false); }
}

$('back').onclick = () => { view = room.start; render(); };

async function poll() {
  try {
    apply(await call('getRoom', { seq }));
  } catch (e) {
    if (!room) $('stage').textContent = e.message || 'خطا در اتصال';
  }
  setTimeout(poll, 2500);
}
poll();