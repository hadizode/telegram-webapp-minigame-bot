import { api } from 'sdk';
import { getMatch } from './matches.js';
import { getPack } from './packLoader.js';
import { send } from './tg.js';
import { startGame } from './game.js';
import { escapeHtml } from './util.js';

// Called by startMatch (/forcematch and the start button) after status = running.
export async function onMatchStart(matchId) {
  const match = await getMatch(matchId);
  const first = getPack(match.packId).rooms[0];
  await startGame(match);
  const me = await api.getMe();
  await send(match.groupId, [
    '🔐 <b>بازی شروع شد!</b>',
    '━━━━━━━━━━━━━━',
    escapeHtml(first.intro || 'وارد اتاق اول بشید و با هم معما رو حل کنید.'),
  ].join('\n'), {
    reply_markup: { inline_keyboard: [[{ text: '🚪 ورود به اتاق', url: `https://t.me/${me.username}?startapp=m${matchId}` }]] },
  });
}
