import { api } from 'sdk';
import { isAdminMessage, isGroup } from './admin.js';
import { escapeHtml, formatDate } from './util.js';
import { send, editText, EMPTY_KB } from './tg.js';
import { upsertUser, getUserByTgId, topUsers, titleFor, nextTitle } from './users.js';
import { findOpenByGroup, setStatus } from './matches.js';
import { countActive } from './players.js';
import { getPack } from './packLoader.js';
import { unpinCard } from './cards.js';
import { startMatch } from './matchActions.js';
import { begin } from './wizard.js';
import { testapp } from './testapp.js';

const LINE = '━━━━━━━━━━━━━━━━';

// Middleware equivalents: groupOnly -> adminOnly (admin checked via getChatMember).
const guard = ({ group, admin }, fn) => async (msg) => {
  if (group && !isGroup(msg.chat)) return send(msg.chat.id, '👥 این دستور فقط توی گروه کار می‌کنه');
  if (admin && !(await isAdminMessage(msg))) {
    const replyOptions = {reply_to_message_id: msg.message_id,};
    return send(msg.chat.id, '⛔ فقط ادمین‌ها می‌تونن این کار رو بکنن',replyOptions);
  }
  return fn(msg);
};

async function start(msg) {
  const replyOptions = {reply_to_message_id: msg.message_id,};

  if (msg.chat.type === 'private') {
    const me = await api.getMe();
    return send(
      msg.chat.id,
      [
        '🔐 <b>به اتاق فرار خوش اومدی!</b>',
        LINE,
        'من یه ربات بازی گروهی‌ام؛ تیمی وارد اتاق‌ها می‌شید، معماها رو حل می‌کنید و رقابت می‌کنید کی اول خارج بشه.',
        '',
        '⚠️ من فقط توی گروه کار می‌کنم.',
        `➕ <a href="https://t.me/${me.username}?startgroup=true">منو به گروهت اضافه کن</a>`,
        '',
        '📖 برای دیدن دستورات: /help',
      ].join('\n'),
      replyOptions
    );
  }

  return send(
    msg.chat.id,
    [
      '🔐 <b>آماده ماجرا جویی هستی؟؟</b>',
      LINE,
      '👤 /profile — پروفایل من',
      '🏆 /ranklist — جدول برترین‌ها',
      '📖 /help — راهنمای کامل',
    ].join('\n'),
    replyOptions
  );
}

async function help(msg) {
  const replyOptions = { reply_to_message_id: msg.message_id,};

  const lines = [
    '📖 <b>راهنمای دستورات</b>',
    LINE,
    '🔐 /start — معرفی ربات',
    '👤 /profile — پروفایل و امتیازها',
    '🏆 /ranklist — ۲۰ نفر برتر',
  ];
  if (isGroup(msg.chat) && (await isAdminMessage(msg))) {
    lines.push('', '👑 <b>مخصوص ادمین‌ها</b>', LINE,
      '🎮 /newmatch — ساخت مچ جدید',
      '▶️ /forcematch — شروع اجباری مچ',
      '❌ /cancelmatch — لغو مچ باز');
  }
  return send(msg.chat.id, lines.join('\n'),replyOptions);
}

export function renderProfile(u) {
  const created = u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt * 1000);
  const next = nextTitle(u.totalXp);
  const lines = [
    `👤 <b>${escapeHtml(u.firstName)}</b>${u.username ? ` · @${escapeHtml(u.username)}` : ''}`,
    LINE,
    `🎖 لقب: <b>${titleFor(u.totalXp)}</b>`,
    `⭐ امتیاز: <b>${u.totalXp}</b> XP`,
    `🎮 بازی‌ها: <b>${u.matchesPlayed}</b>`,
    `🏆 بردها: <b>${u.matchesWon}</b>`,
    `📅 عضویت: ${formatDate(created)}`,
  ];
  if (next) lines.push('', `🚀 ${next.left} XP تا لقب «${next.title}»`);
  return lines.join('\n');
}

export async function sendProfileByTgId(chatId, tgId,msg) {
  const replyOptions = { reply_to_message_id: msg.message_id,};
  const u = await getUserByTgId(tgId);
  return send(chatId, u ? renderProfile(u) : '🔎 کاربر پیدا نشد',replyOptions);
}

async function profile(msg) {
  const replyOptions = { reply_to_message_id: msg.message_id,};
  const u = await upsertUser(msg.from);
  return send(msg.chat.id, renderProfile(u),replyOptions);
}

async function ranklist(msg) {
  const replyOptions = { reply_to_message_id: msg.message_id,};
  const list = await topUsers(20);
  if (!list.length) return send(msg.chat.id, '🏆 هنوز کسی توی جدول نیست. اولین نفر باش!',replyOptions);
  const medals = ['🥇', '🥈', '🥉'];
  const rows = list.map((u, i) => {
    const mark = medals[i] || `<b>${i + 1}.</b>`;
    const name = escapeHtml(u.firstName || u.username || 'ناشناس');
    return `${mark} ${name} — ${u.totalXp} XP · ${titleFor(u.totalXp)}`;
  });
  return send(msg.chat.id, ['🏆 <b>جدول برترین‌ها</b>', LINE, ...rows].join('\n'),replyOptions);
}

async function cancelmatch(msg) {
  const replyOptions = { reply_to_message_id: msg.message_id,};
  const match = await findOpenByGroup(msg.chat.id);
  if (!match) return send(msg.chat.id, '🔎 الان مچ بازی توی این گروه نیست',replyOptions);
  await setStatus(match.id, 'cancelled');
  if (match.messageId) await editText(match.groupId, match.messageId, '🚫 این مچ لغو شد', EMPTY_KB);
  await unpinCard(match);
  return send(msg.chat.id, '🚫 مچ لغو شد',replyOptions);
}

async function forcematch(msg) {
  const replyOptions = { reply_to_message_id: msg.message_id,};
  const match = await findOpenByGroup(msg.chat.id);
  if (!match) return send(msg.chat.id, '🔎 الان مچ بازی توی این گروه نیست',replyOptions);
  const pack = getPack(match.packId);
  if ((await countActive(match.id)) < pack.min_players) {
    return send(msg.chat.id, `👥 حداقل ${pack.min_players} نفر لازمه`,replyOptions);
  }
  return startMatch(match, '🛠 موتور بازی هنوز وصل نشده (فاز بعدی)');
}

export const COMMANDS = {
  start, help, profile, ranklist,testapp,
  newmatch: guard({ group: true, admin: true }, begin),
  cancelmatch: guard({ group: true, admin: true }, cancelmatch),
  forcematch: guard({ group: true, admin: true }, forcematch),
};
