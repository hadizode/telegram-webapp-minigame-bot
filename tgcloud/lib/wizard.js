import { rid, escapeHtml } from './core.js';
import { sendRich, editRich, richBlocks } from './tg.js';
import { fsmKey, loadState, saveState, clearState } from './fsm.js';
import { listPacks, getPack, getVariant } from './packLoader.js';
import { validCapacities } from './capacity.js';
import { createMatch, findOpenByGroup } from './matches.js';
import { postMatchCard } from './cards.js';
import { isChatAdmin } from './gate.js';

const cancelBtn = (sid) => ({ text: '❌ انصراف', callback_data: `nm:cancel:${sid}` });

function packStep(sid) {
  const packs = listPacks();
  const rows = packs.map((p) => [{ text: p.name, callback_data: `nm:pack:${p.id}:${sid}` }]);
  rows.push([{ text: '🔄 رفرش', callback_data: `nm:refresh:${sid}` }, cancelBtn(sid)]);
  return { text: packs.length ? '📦 <b>یه پک انتخاب کن:</b>' : '😕 هیچ پکی پیدا نشد.', rows };
}

// Entry: /newmatch message
export async function begin(message) {
  const state = { sid: rid(), step: 'pack' };
  await saveState(fsmKey(message.chat.id, message.from.id), state);
  const { text, rows } = packStep(state.sid);
  return sendRich(message.chat.id, richBlocks(text, rows), {
    reply_parameters: { message_id: message.message_id },
  });
}

async function onPack(c, s, packId) {
  const pack = getPack(packId);
  Object.assign(s, { step: 'cap', packId });
  await saveState(c.key, s);
  // NOTE: pack thumbnail skipped (not part of required pack fields).
  const caps = validCapacities(pack).map((n) => ({ text: String(n), callback_data: `nm:cap:${n}:${s.sid}` }));
  const packText = `"'📦 <b>${escapeHtml(pack.name)}</b>'\n\n👥 <b>ظرفیت مچ رو انتخاب کن:</b>'`;
}

async function onCap(c, s, n) {
  const pack = getPack(s.packId);
  if (!validCapacities(pack).includes(n)) return;
  const variant = getVariant(pack, n);
  Object.assign(s, { step: 'confirm', capacity: n });
  await saveState(c.key, s);
  const text = [
    '📋 <b>خلاصه‌ی مچ</b>',
    '━━━━━━━━━━━━━━',
    `📦 پک: ${escapeHtml(pack.name)}`,
    `🎭 تم: ${escapeHtml(pack.theme_fa || pack.theme)}`,
    `👥 ظرفیت: ${n} نفر`,
    `🚪 تعداد اتاق: ${variant.rooms.length}`,
    `🔢 طول رمز: ${n} رقم`,
    `⏱ زمان: ${variant.minutes} دقیقه`,
  ].join('\n');
  return editRich(c.chatId, c.messageId, richBlocks(text, [[
    { text: '✅ شروع ثبت‌نام', callback_data: `nm:confirm:${s.sid}` }, cancelBtn(s.sid),
  ]]));
}

async function onConfirm(c, s) {
  const warnText = '⚠️ یه مچ باز داری؛ اول اون رو تموم یا لغو کن';
  const okText = '🎉 مچ ساخته شد! ثبت‌نام رو توی پیام پین‌شده ببین';
  if (await findOpenByGroup(c.chatId)) {
    try {
      return await editRich(c.chatId, c.messageId, richBlocks(warnText, []));
    } catch {
      return send(c.chatId, warnText, { parse_mode: 'HTML' });
    }
  }
  try {
    const match = await createMatch({
      groupId: c.chatId, packId: s.packId, maxPlayers: s.capacity, createdBy: c.from.id,
    });
    await postMatchCard(match.id);
    await clearState(c.key);
    try {
      return await editRich(c.chatId, c.messageId, richBlocks(okText, []));
    } catch {
      return send(c.chatId, okText, { parse_mode: 'HTML' });
    }
  } catch (e) {
    console.error('onConfirm create/post failed', e);
    return send(c.chatId, '⚠️ خطا در ساخت مچ؛ دوباره تلاش کن', { parse_mode: 'HTML' });
  }
}

// c = { chatId, messageId, from }; parts = data.split(':') => nm:<action>:<args...>:<sid>
export async function handleWizard(c, parts) {
  if (!(await isChatAdmin(c.chatId, c.from.id))) return;
  const [, action, ...rest] = parts;
  const sid = rest.pop();
  c.key = fsmKey(c.chatId, c.from.id);
  const s = await loadState(c.key);
  if (!s || s.sid !== sid) {
    return editRich(c.chatId, c.messageId, richBlocks('⌛ زمان این مرحله تموم شد؛ دوباره /newmatch بزن', []));
  }
  await saveState(c.key, s); // refresh TTL
  if (action === 'cancel') { await clearState(c.key); return editRich(c.chatId, c.messageId, richBlocks('❌ لغو شد', [])); }
  if (action === 'refresh') {
    const { text, rows } = packStep(sid);
    return editRich(c.chatId, c.messageId, richBlocks(text, rows));
  }
  if (action === 'pack') return onPack(c, s, rest[0]);
  if (action === 'cap') return onCap(c, s, Number(rest[0]));
  if (action === 'confirm') return onConfirm(c, s);
}
