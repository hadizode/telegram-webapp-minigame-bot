const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
try { tg.disableVerticalSwipes?.(); } catch {}
try { tg.setBackgroundColor?.('#000000'); tg.setHeaderColor?.('#000000'); } catch {}
try { if (tg.isVersionAtLeast?.('8.0') && !tg.isFullscreen) tg.requestFullscreen(); } catch {}

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
// A picture that failed to load is removed, so no "broken image" icon is ever drawn.
const pic = (src, cls) => {
  const i = new Image();
  if (cls) i.className = cls;
  i.draggable = false;
  i.onerror = () => i.remove();
  i.src = url(src);
  return i;
};
if (new URLSearchParams(location.search).has('debug')) document.body.classList.add('debug');

const u = tg.initDataUnsafe?.user || {};
const myName = u.first_name || u.username || 'یکی از بازیکن‌ها'; // same name the server writes in the log

let G = null;            // last snapshot
let where = 'lobby';     // room id ('lobby', an interactive room, or a legacy hotspot scene)
const curView = {};      // room id -> current view name
let sel = null, seq = -1, busy = false, lastLog = -1, sound;

// ---- notifications: they appear, stay a few seconds, fade out ------------------------------------
function toast(text, ok = true, audio) {
  const box = $('toasts');
  const t = mk('div', 'toast' + (ok ? '' : ' bad'), text);
  if (audio) { const b = mk('button', 'snd', '🔊'); b.onclick = () => playSound(audio); t.append(b); }
  box.append(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, audio ? 5000 : 3000);
}

function notifyLog(g) {
  const top = g.log.reduce((m, l) => Math.max(m, l.n), 0);
  if (lastLog >= 0) {
    for (const l of g.log) if (l.n > lastLog && l.by !== myName) toast(`${l.by}: ${l.text}`, true, l.audio);
  }
  lastLog = Math.max(lastLog, top);
}

function playSound(path) {
  if (!path) return;
  if (sound) sound.pause();
  sound = new Audio(url(path));
  sound.play().catch(() => toast('🔇 صدا پخش نشد', false));
}

// ---- full-screen picture (action "show") ---------------------------------------------------------
const viewerOpen = () => !$('viewer').hidden;

function openViewer(path) {
  const img = $('viewerImg');
  img.onerror = () => { closeViewer(); toast('🖼 تصویر پیدا نشد', false); };
  img.src = url(path);
  $('viewer').hidden = false;
  try { tg.BackButton.show(); } catch {}
}

function closeViewer() {
  $('viewer').hidden = true;
  $('viewerImg').removeAttribute('src');
  if (G) render();
}
$('viewer').onclick = closeViewer;

function apply(g) {
  if (!g || g.unchanged || g.notReady || g.seq < seq) return;
  G = g;
  seq = g.seq;
  notifyLog(g);
  if (!G.scenes[where] && !G.rooms[where]) where = 'lobby';
  render();
}

function render() {
  const room = G.rooms[where];
  $('title').textContent = room ? room.name : (G.scenes[where]?.name_fa || '');
  $('digits').textContent = Array.from({ length: G.lockLength }, (_, i) => G.found[i] ?? '•').join(' ');
  const atRoot = where === 'lobby' && (!room || !curView[room.id] || curView[room.id] === room.start);
  try { atRoot && !viewerOpen() ? tg.BackButton.hide() : tg.BackButton.show(); } catch {}
  if (room) renderRoom(room); else renderScene(G.scenes[where]);
  renderInv();
  renderBanner();
}

// ---- legacy hotspot scenes -----------------------------------------------------------------------
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
  else if (h.type === 'clue') toast(h.content?.text_fa || '…');
  else toast('🔐 قفل در خروج — ورود رمز به‌زودی اضافه می‌شه');
}

// ---- interactive rooms (and the lobby) -----------------------------------------------------------
function renderRoom(room) {
  const view = (curView[room.id] ||= room.start);
  const st = $('stage');
  st.replaceChildren();
  st.className = '';
  st.style.background = '';
  const img = pic(room.views[view].image);
  img.addEventListener('error', () => st.classList.add('noimg'));
  st.append(img);

  const here = room.objects.filter((o) => o.view === view);
  const picOf = (o) => (o.images && o.images[o.state]) || o.image;
  // Layers first (below the click areas): a state image written as { image, x, y, w, h }
  // is drawn at its own rectangle (default: the whole view) instead of inside the click area.
  for (const o of here) {
    const p = picOf(o);
    if (p && typeof p === 'object') {
      const i = pic(p.image, 'layer');
      i.style.cssText = `left:${p.x ?? 0}%;top:${p.y ?? 0}%;width:${p.w ?? 100}%;height:${p.h ?? 100}%`;
      st.append(i);
    }
  }
  for (const o of here) {
    const b = mk('button', 'obj');
    b.style.cssText = `left:${o.x}%;top:${o.y}%;width:${o.w}%;height:${o.h}%`;
    if (o.poly) {
      const pts = o.poly.map(([px, py]) =>
        `${((px - o.x) / Math.max(o.w, 0.01) * 100).toFixed(2)}% ${((py - o.y) / Math.max(o.h, 0.01) * 100).toFixed(2)}%`).join(',');
      b.style.clipPath = `polygon(${pts})`;
    }
    const p = picOf(o);
    if (typeof p === 'string') b.append(pic(p));
    const label = o.labels && o.labels[o.state];
    if (label) b.append(mk('span', '', label));
    b.onclick = () => onObj(room, o);
    st.append(b);
  }
}

async function onObj(room, o) {
  if (o.action === 'goto') { curView[room.id] = o.to; render(); return; }
  if (o.action === 'show') { if (o.popup) openViewer(o.popup); return; }
  if (o.action === 'door' && !o.gated) { where = o.to; render(); return; }
  if (o.action === 'lock') { toast('🔐 قفل در خروج — ورود رمز به‌زودی اضافه می‌شه'); return; }
  if (busy) return;
  busy = true;
  try {
    const r = await call('act', { room: room.id, object: o.id, with: sel });
    if (r.result.text) toast(r.result.text, r.result.ok);
    if (r.result.ok) playSound(r.result.audio);
    if (r.result.ok && o.action === 'place') sel = null;
    apply(r.game);
    if (r.result.ok && o.action === 'door') { where = o.to; render(); }
  } catch (e) {
    toast(e.message || 'خطا', false);
  } finally {
    busy = false;
  }
}

// ---- inventory: closed, opens with the bag button -------------------------------------------------
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

  $('bagN').hidden = !G.inv.length;
  $('bagN').textContent = G.inv.length;
  if (!types.length) box.textContent = '🎒 کوله خالیه';
  for (const t of types) {
    const def = itemDef(t);
    const b = mk('button', 'item' + (t === sel ? ' sel' : ''));
    if (def.image) b.append(pic(def.image));
    b.append((def.name || t) + (counts[t] > 1 ? ` ×${counts[t]}` : ''));
    b.onclick = () => { sel = sel === t ? null : t; $('invPanel').hidden = true; renderInv(); };
    box.append(b);
  }

  const chip = $('selchip');
  chip.hidden = !sel;
  if (sel) chip.textContent = `✋ ${itemDef(sel).name || sel} ✕`;
}

$('bag').onclick = () => { $('invPanel').hidden = !$('invPanel').hidden; };
$('selchip').onclick = () => { sel = null; renderInv(); };
document.addEventListener('click', (e) => {
  if (!e.target.closest('#bag, #invPanel')) $('invPanel').hidden = true;
});

// ---- room solved ----------------------------------------------------------------------------------
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

// ---- back: Telegram's own BackButton -------------------------------------------------------------
function goBack() {
  if (viewerOpen()) { closeViewer(); return; }
  const room = G && G.rooms[where];
  if (room && curView[room.id] && curView[room.id] !== room.start) curView[room.id] = room.start;
  else where = 'lobby';
  render();
}
try { tg.BackButton.onClick(goBack); } catch {}

async function poll() {
  try {
    apply(await call('getGame', { seq }));
  } catch (e) {
    if (!G) $('stage').textContent = e.message || 'خطا در اتصال';
  }
  setTimeout(poll, 2500);
}
poll();