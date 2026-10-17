import { api } from 'sdk';
import { isAdmin } from './config.js';
import { escapeHtml, formatDate } from './util.js';
import { send, editText, tryApi, EMPTY_KB } from './tg.js';
import { upsertUser, getUserByTgId, topUsers, titleFor } from './users.js';
import { findOpenByGroup, setStatus } from './matches.js';
import { countActive } from './players.js';
import { getPack } from './packLoader.js';
import { unpinCard } from './cards.js';
import { startMatch } from './matchActions.js';
import { begin } from './wizard.js';

// Middleware equivalents: groupOnly -> adminOnly.
const guard = ({ group, admin }, fn) => async (msg) => {
  if (group && !['group', 'supergroup'].includes(msg.chat.type)) return send(msg.chat.id, 'فقط توی گروه');
  if (admin && !isAdmin(msg.from.id)) return send(msg.chat.id, 'اجازه نداری');
  return fn(msg);
};

async function start(msg) {
  if (msg.chat.type === 'private') {
    const me = await api.getMe();
    return send(msg.chat.id, `سلام! 👋 من ربات اتاق فرار گروهی‌ام و فقط توی گروه کار می‌کنم.\nمنو به گروهت اضافه کن:\nhttps://t.me/${me.username}?startgroup=true`);
  }
  return send(msg.chat.id, 'سلام! 🔐 آماده‌ی فرار؟\n/profile — پروفایل\n/ranklist — رتبه‌بندی\n/help — راهنما');
}

async function help(msg) {
  let text = '<b>دستورات کاربران:</b>\n/start\n/help\n/profile\n/ranklist';
  if (isAdmin(msg.from.id)) {
    text += '\n\n<b>دستورات ادمین:</b>\n/newmatch — ساخت مچ\n/cancelmatch — لغو مچ\n/forcematch — شروع اجباری';
  }
  return send(msg.chat.id, text);
}

export function renderProfile(u) {
  return [
    `👤 <b>${escapeHtml(u.firstName)}</b>`,
    `🔗 ${u.username ? '@' + escapeHtml(u.username) : '—'}`,
    `⭐ XP: ${u.totalXp}`,
    `🎮 بازی‌ها: ${u.matchesPlayed}`,
    `🏆 بردها: ${u.matchesWon}`,
    `🎖 لقب: ${titleFor(u.totalXp)}`,
    `📅 عضویت: ${formatDate((u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt * 1000)))}`,
  ].join('\n');
}

export async function sendProfileByTgId(chatId, tgId) {
  const u = await getUserByTgId(tgId);
  return send(chatId, u ? renderProfile(u) : 'کاربر پیدا نشد');
}

async function profile(msg) {
  const u = await upsertUser(msg.from);
  return send(msg.chat.id, renderProfile(u));
}

async function ranklist(msg) {
  const list = await topUsers(20);
  if (!list.length) return send(msg.chat.id, 'هنوز کسی توی رتبه‌بندی نیست');
  const lines = list.map((u, i) => `${i + 1}. ${escapeHtml(u.firstName || u.username)} — ${u.totalXp} XP — ${titleFor(u.totalXp)}`);
  return send(msg.chat.id, `🏆 <b>رتبه‌بندی</b>\n\n${lines.join('\n')}`);
}

async function cancelmatch(msg) {
  const match = await findOpenByGroup(msg.chat.id);
  if (!match) return send(msg.chat.id, 'مچ بازی وجود نداره');
  await setStatus(match.id, 'cancelled');
  if (match.messageId) await editText(match.groupId, match.messageId, '❌ لغو شد', EMPTY_KB);
  await unpinCard(match);
  return send(msg.chat.id, '✅ مچ لغو شد');
}

async function forcematch(msg) {
  const match = await findOpenByGroup(msg.chat.id);
  if (!match) return send(msg.chat.id, 'مچ بازی وجود نداره');
  const pack = getPack(match.packId);
  if ((await countActive(match.id)) < pack.min_players) {
    return send(msg.chat.id, `حداقل ${pack.min_players} نفر لازمه`);
  }
  return startMatch(match, 'موتور بازی هنوز وصل نشده (فاز بعدی)');
}

export const COMMANDS = {
  start, help, profile, ranklist,
  newmatch: guard({ group: true, admin: true }, begin),
  cancelmatch: guard({ group: true, admin: true }, cancelmatch),
  forcematch: guard({ group: true, admin: true }, forcematch),
};
