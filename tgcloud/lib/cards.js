import { api } from 'sdk';
import { escapeHtml } from './core.js';
import { sendRich, editRich, tryApi } from './tg.js';
import { getMatch, setMessageId } from './matches.js';
import { listActive } from './players.js';
import { getPack } from './packLoader.js';
import { btn, row } from './rich.js';

const statusFa = (s) => ({
  open: '🟡 در انتظار بازیکن',
  full: '🟢 همه حاضرن — منتظر شروع',
  running: '🎮 در حال بازی',
  finished: '🏁 تموم شد',
  cancelled: '🚫 لغو شد',
})[s];

const name = (p) =>
  p.username ? `@${escapeHtml(p.username)}` : escapeHtml(p.firstName);

// ساخت HTML کارت + دکمه‌های ریچ
export function buildCard(match, pack, players) {
  const joined = players.length;

  const listItems = joined
    ? players.map((p) => `<li>${name(p)}</li>`).join('')
    : '<li><i>هنوز کسی جوین نشده</i></li>';

  const html = [
    `<h2>🏥 ${escapeHtml(pack.name)}</h2>`,
    '<hr>',
    `<p>🎭 تم: ${escapeHtml(pack.theme_fa || pack.theme)}</p>`,
    `<p>👥 ظرفیت: <b>${joined}/${match.maxPlayers}</b></p>`,
    `<p>⏳ وضعیت: ${statusFa(match.status)}</p>`,
    '<p><b>📌 قبل از شروع</b></p>',
    '<ul>',
    `<li>حداقل ${pack.min_players} نفر لازمه</li>`,
    '<li>یه وویس کال بزنید یا همین‌جا چت کنید</li>',
    '<li>اولین کسی که کد درست رو بزنه، رتبه ۱ می‌شه</li>',
    '</ul>',
    '<p><b>🧑‍🤝‍🧑 بازیکن‌ها</b></p>',
    `<ul>${listItems}</ul>`,
  ].join('\n');

  const leaveBtn = btn('❌ خروج', `match:leave:${match.id}`, 'danger');

  let actions = '';
  if (match.status === 'open') {
    actions = row([
      btn('🚪 ورود', `match:join:${match.id}`, 'success'),
      leaveBtn,
    ]);
  } else if (match.status === 'full') {
    actions = row([
      btn('▶️ شروع بازی', `match:start:${match.id}`, 'primary'),
      leaveBtn,
    ]);
  }

  return { html: actions ? `${html}\n${actions}` : html };
}

export const pinCard = (match) =>
  match.messageId
    ? tryApi(() => api.pinChatMessage({
      chat_id: match.groupId, message_id: match.messageId, disable_notification: true,
    }), 'pin')
    : undefined;

export async function postMatchCard(matchId) {
  const match = await getMatch(matchId);
  const { html } = buildCard(match, getPack(match.packId), await listActive(matchId));

  const msg = await sendRich(match.groupId, html);
  await setMessageId(matchId, msg.message_id);
  await pinCard({ ...match, messageId: msg.message_id });
}

export async function refreshCard(matchId) {
  const match = await getMatch(matchId);
  if (!match?.messageId) return;

  const { html } = buildCard(match, getPack(match.packId), await listActive(matchId));
  await editRich(match.groupId, match.messageId, html);
}

export const unpinCard = (match) =>
  tryApi(() => api.unpinChatMessage({ chat_id: match.groupId, message_id: match.messageId }), 'unpin');