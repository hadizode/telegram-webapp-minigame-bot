import { api } from 'sdk';
import { escapeHtml } from './util.js';
import { send, editText, tryApi, EMPTY_KB } from './tg.js';
import { getMatch, setMessageId } from './matches.js';
import { listActive } from './players.js';
import { getPack } from './packLoader.js';

const statusFa = (s, joined, max) => ({
  open: `🟡 در انتظار بازیکن (${joined}/${max})`,
  full: '🟢 همه حاضرن — منتظر شروع',
  running: '🎮 در حال بازی',
  finished: '🏁 تموم شد',
  cancelled: '🚫 لغو شد',
})[s];

const name = (p) => (p.username ? `@${escapeHtml(p.username)}` : escapeHtml(p.firstName));

export function buildCard(match, pack, players) {
  const joined = players.length;
  const list = joined ? players.map((p, i) => `${i + 1}. ${name(p)}`).join('\n') : 'هنوز کسی جوین نشده';
  const text = [
    `🏥 <b>${escapeHtml(pack.name)}</b>`,
    '━━━━━━━━━━━━━━',
    `🎭 تم: ${escapeHtml(pack.theme_fa || pack.theme)}`,
    `👥 ظرفیت: <b>${joined}/${match.maxPlayers}</b>`,
    `⏳ وضعیت: ${statusFa(match.status, joined, match.maxPlayers)}`,
    '',
    '📌 <b>قبل از شروع</b>',
    `• حداقل ${pack.min_players} نفر لازمه`,
    '• یه وویس کال بزنید یا همین‌جا چت کنید',
    '• اولین کسی که کد درست رو بزنه، رتبه ۱ می‌شه',
    '',
    '🧑‍🤝‍🧑 <b>بازیکن‌ها</b>',
    list,
  ].join('\n');

  const leaveBtn = { text: '❌ خروج', callback_data: `match:leave:${match.id}` };
  let reply_markup = EMPTY_KB;
  if (match.status === 'open') {
    reply_markup = { inline_keyboard: [[
      { text: '🚪 ورود', callback_data: `match:join:${match.id}` },
      leaveBtn,
    ]] };
  } else if (match.status === 'full') {
    // Leaving a full match reopens registration (see matchActions.leave).
    reply_markup = { inline_keyboard: [[
      { text: '▶️ شروع بازی', callback_data: `match:start:${match.id}` },
      leaveBtn,
    ]] };
  }
  return { text, reply_markup };
}

export const pinCard = (match) =>
  match.messageId
    ? tryApi(() => api.pinChatMessage({
      chat_id: match.groupId, message_id: match.messageId, disable_notification: true,
    }), 'pin')
    : undefined;

export async function postMatchCard(matchId) {
  const match = await getMatch(matchId);
  const { text, reply_markup } = buildCard(match, getPack(match.packId), await listActive(matchId));
  const msg = await send(match.groupId, text, { reply_markup });
  await setMessageId(matchId, msg.message_id);
  await pinCard({ ...match, messageId: msg.message_id });
}

export async function refreshCard(matchId) {
  const match = await getMatch(matchId);
  if (!match?.messageId) return;
  const { text, reply_markup } = buildCard(match, getPack(match.packId), await listActive(matchId));
  await editText(match.groupId, match.messageId, text, reply_markup);
}

export const unpinCard = (match) =>
  tryApi(() => api.unpinChatMessage({ chat_id: match.groupId, message_id: match.messageId }), 'unpin');