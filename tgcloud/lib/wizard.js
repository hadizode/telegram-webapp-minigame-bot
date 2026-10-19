import { rid, escapeHtml } from './util.js';
import { send, editText, EMPTY_KB } from './tg.js';
import { fsmKey, loadState, saveState, clearState } from './fsm.js';
import { listPacks, getPack } from './packLoader.js';
import { validCapacities } from './capacity.js';
import { createMatch, findOpenByGroup } from './matches.js';
import { postMatchCard } from './cards.js';

const kb = (rows) => ({ inline_keyboard: rows });
const cancelBtn = (sid) => ({ text: '❌ انصراف', callback_data: `nm:cancel:${sid}` });

function packStep(sid) {
  const packs = listPacks();
  const rows = packs.map((p) => [{ text: p.name, callback_data: `nm:pack:${p.id}:${sid}` }]);
  rows.push([{ text: '🔄 رفرش', callback_data: `nm:refresh:${sid}` }, cancelBtn(sid)]);
  return { text: packs.length ? '📦 <b>یه پک انتخاب کن:</b>' : '😕 هیچ پکی پیدا نشد.', reply_markup: kb(rows) };
}

// Entry: /newmatch message
export async function begin(message) {
  const state = { sid: rid(), step: 'pack' };
  await saveState(fsmKey(message.chat.id, message.from.id), state);
  const { text, reply_markup } = packStep(state.sid);
  return send(message.chat.id, text, { reply_markup });
}

async function onPack(c, s, packId) {
  const pack = getPack(packId);
  Object.assign(s, { step: 'cap', packId });
  await saveState(c.key, s);
  // NOTE: pack thumbnail skipped (not part of required pack fields).
  const caps = validCapacities(pack).map((n) => ({ text: String(n), callback_data: `nm:cap:${n}:${s.sid}` }));
  return editText(c.chatId, c.messageId, `📦 <b>${escapeHtml(pack.name)}</b>\n\n👥 <b>ظرفیت مچ رو انتخاب کن:</b>`, kb([caps, [cancelBtn(s.sid)]]));
}

async function onCap(c, s, n) {
  const pack = getPack(s.packId);
  if (!validCapacities(pack).includes(n)) return;
  Object.assign(s, { step: 'confirm', capacity: n });
  await saveState(c.key, s);
  const text = [
    '📋 <b>خلاصه‌ی مچ</b>',
    '━━━━━━━━━━━━━━',
    `📦 پک: ${escapeHtml(pack.name)}`,
    `🎭 تم: ${escapeHtml(pack.theme_fa || pack.theme)}`,
    `👥 ظرفیت: ${n} نفر`,
    `🚪 تعداد اتاق: ${pack.rooms.length}`,
  ].join('\n');
  return editText(c.chatId, c.messageId, text, kb([[
    { text: '✅ شروع ثبت‌نام', callback_data: `nm:confirm:${s.sid}` }, cancelBtn(s.sid),
  ]]));
}

async function onConfirm(c, s) {
  if (await findOpenByGroup(c.chatId)) {
    return editText(c.chatId, c.messageId, '⚠️ یه مچ باز داری؛ اول اون رو تموم یا لغو کن', EMPTY_KB);
  }
  const match = await createMatch({
    groupId: c.chatId, packId: s.packId, maxPlayers: s.capacity, createdBy: c.from.id,
  });
  await postMatchCard(match.id);
  await clearState(c.key);
  return editText(c.chatId, c.messageId, '🎉 مچ ساخته شد! ثبت‌نام رو توی پیام پین‌شده ببین', EMPTY_KB);
}

// c = { chatId, messageId, from }; parts = data.split(':') => nm:<action>:<args...>:<sid>
export async function handleWizard(c, parts) {
  const [, action, ...rest] = parts;
  const sid = rest.pop();
  c.key = fsmKey(c.chatId, c.from.id);
  const s = await loadState(c.key);
  if (!s || s.sid !== sid) {
    return editText(c.chatId, c.messageId, '⌛ زمان این مرحله تموم شد؛ دوباره /newmatch بزن', EMPTY_KB);
  }
  await saveState(c.key, s); // refresh TTL
  if (action === 'cancel') { await clearState(c.key); return editText(c.chatId, c.messageId, '❌ لغو شد', EMPTY_KB); }
  if (action === 'refresh') {
    const { text, reply_markup } = packStep(sid);
    return editText(c.chatId, c.messageId, text, reply_markup);
  }
  if (action === 'pack') return onPack(c, s, rest[0]);
  if (action === 'cap') return onCap(c, s, Number(rest[0]));
  if (action === 'confirm') return onConfirm(c, s);
}
