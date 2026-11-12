import { rid, escapeHtml } from './core.js';
import { sendRich, editRich } from './tg.js';
import { fsmKey, loadState, saveState, clearState } from './fsm.js';
import { listPacks, getPack, getVariant } from './packLoader.js';
import { validCapacities } from './capacity.js';
import { createMatch, findOpenByGroup } from './matches.js';
import { postMatchCard } from './cards.js';
import { isChatAdmin } from './gate.js';

// ---- helpers برای ساخت HTML و دکمه‌های ریچ ----

const escAttr = (v = '') =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const richBtn = (label, data, style = 'primary') =>
  `<tg-button type="callback_data" style="${style}" data="${escAttr(data)}">${escapeHtml(label)}</tg-button>`;

const richRow = (buttons, align = 'center') =>
  `<tg-button-row align="${align}">${buttons.join('')}</tg-button-row>`;

const cancelRow = (sid) =>
  richRow([richBtn('❌ انصراف', `nm:cancel:${sid}`, 'danger')]);

function packStep(sid) {
  const packs = listPacks();

  let html = packs.length
    ? '<p><b>📦 یه پک انتخاب کن:</b></p>'
    : '<p>😕 هیچ پکی پیدا نشد.</p>';

  for (const p of packs) {
    html += richRow([richBtn(p.name, `nm:pack:${p.id}:${sid}`)]);
  }

  html += richRow([
    richBtn('🔄 رفرش', `nm:refresh:${sid}`),
    richBtn('❌ انصراف', `nm:cancel:${sid}`, 'danger'),
  ]);

  return { html };
}

// Entry: /newmatch message
export async function begin(message) {
  const state = { sid: rid(), step: 'pack' };
  await saveState(fsmKey(message.chat.id, message.from.id), state);

  const { html } = packStep(state.sid);

  return sendRich(message.chat.id, html, {
    reply_to_message_id: message.message_id,
  });
}

async function onPack(c, s, packId) {
  const pack = getPack(packId);
  Object.assign(s, { step: 'cap', packId });
  await saveState(c.key, s);

  const capButtons = validCapacities(pack).map((n) =>
    richBtn(String(n), `nm:cap:${n}:${s.sid}`)
  );

  const html =
    `<h2>📦 ${escapeHtml(pack.name)}</h2>` +
    `<p><b>👥 ظرفیت مچ رو انتخاب کن:</b></p>` +
    richRow(capButtons) +
    cancelRow(s.sid);

  return editRich(c.chatId, c.messageId, html);
}

async function onCap(c, s, n) {
  const pack = getPack(s.packId);
  if (!validCapacities(pack).includes(n)) return;

  const variant = getVariant(pack, n);
  Object.assign(s, { step: 'confirm', capacity: n });
  await saveState(c.key, s);

  const html =
    `<h1>📋 خلاصه‌ی مچ</h1>` +
    `<hr>` +
    `<ul>` +
    `<li>📦 پک: <b>${escapeHtml(pack.name)}</b></li>` +
    `<li>🎭 تم: ${escapeHtml(pack.theme_fa || pack.theme)}</li>` +
    `<li>👥 ظرفیت: ${n} نفر</li>` +
    `<li>🚪 تعداد اتاق: ${variant.rooms.length}</li>` +
    `<li>🔢 طول رمز: ${n} رقم</li>` +
    `<li>⏱ زمان: ${variant.minutes} دقیقه</li>` +
    `</ul>` +
    richRow([
      richBtn('✅ شروع ثبت‌نام', `nm:confirm:${s.sid}`, 'success'),
      richBtn('❌ انصراف', `nm:cancel:${s.sid}`, 'danger'),
    ]);

  return editRich(c.chatId, c.messageId, html);
}

async function onConfirm(c, s) {
  if (await findOpenByGroup(c.chatId)) {
    return editRich(
      c.chatId,
      c.messageId,
      '<p>⚠️ یه مچ باز داری؛ اول اون رو تموم یا لغو کن</p>'
    );
  }

  const match = await createMatch({
    groupId: c.chatId,
    packId: s.packId,
    maxPlayers: s.capacity,
    createdBy: c.from.id,
  });

  await postMatchCard(match.id);
  await clearState(c.key);

  return editRich(
    c.chatId,
    c.messageId,
    '<p>🎉 <b>مچ ساخته شد!</b> ثبت‌نام رو توی پیام پین‌شده ببین</p>'
  );
}

// c = { chatId, messageId, from }; parts = data.split(':') => nm:<action>:<args...>:<sid>
export async function handleWizard(c, parts) {
  if (!(await isChatAdmin(c.chatId, c.from.id))) return;

  const [, action, ...rest] = parts;
  const sid = rest.pop();

  c.key = fsmKey(c.chatId, c.from.id);
  const s = await loadState(c.key);

  if (!s || s.sid !== sid) {
    return editRich(
      c.chatId,
      c.messageId,
      '<p>⌛ زمان این مرحله تموم شد؛ دوباره <code>/newmatch</code> بزن</p>'
    );
  }

  await saveState(c.key, s); // refresh TTL

  if (action === 'cancel') {
    await clearState(c.key);
    return editRich(c.chatId, c.messageId, '<p>❌ لغو شد</p>');
  }

  if (action === 'refresh') {
    const { html } = packStep(sid);
    return editRich(c.chatId, c.messageId, html);
  }

  if (action === 'pack') return onPack(c, s, rest[0]);
  if (action === 'cap') return onCap(c, s, Number(rest[0]));
  if (action === 'confirm') return onConfirm(c, s);
}