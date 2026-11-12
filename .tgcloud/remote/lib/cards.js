import { api } from 'sdk';
import { escapeHtml } from './core.js';
import { sendRich, editRich, tryApi } from './tg.js';
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
  const rows = match.status === 'open'
    ? [[{ text: '🚪 ورود', callback_data: `match:join:${match.id}` }, leaveBtn]]
    : match.status === 'full'
      ? [[{ text: '▶️ شروع بازی', callback_data: `match:start:${match.id}` }, leaveBtn]]
      : [];
  return { text, rows };
}

export const pinCard = (match) =>
  match.messageId
    ? tryApi(() => api.pinChatMessage({
      chat_id: match.groupId, message_id: match.messageId, disable_notification: true,
    }), 'pin')
    : undefined;

export async function postMatchCard(matchId) {
  const match = await getMatch(matchId);
  const { text, rows } = buildCard(match, getPack(match.packId), await listActive(matchId));
  const msg = await sendRich(match.groupId, richBlocks(text, rows));
  await setMessageId(matchId, msg.message_id);
  await pinCard({ ...match, messageId: msg.message_id });
}

export async function refreshCard(matchId) {
  const match = await getMatch(matchId);
  if (!match?.messageId) return;
  const { text, rows } = buildCard(match, getPack(match.packId), await listActive(matchId));
  try {
    await editRich(match.groupId, match.messageId, richBlocks(text, rows));
  } catch (e) {
    // Rich-message edit may not be supported for this message/chat — fall back to plain text.
    await send(match.groupId, text, { parse_mode: 'HTML' });
  }
}

export const unpinCard = (match) =>
  tryApi(() => api.unpinChatMessage({ chat_id: match.groupId, message_id: match.messageId }), 'unpin');