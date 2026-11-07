import { api } from 'sdk';
import { getMatch } from './matches.js';
import { getPack } from './packLoader.js';
import { send } from './tg.js';
import { startGame } from './game.js';
import { escapeHtml } from './core.js';

// Called by startMatch (/forcematch and the start button) after status = running.
export async function onMatchStart(matchId) {
  const match = await getMatch(matchId);
  const pack = getPack(match.packId);
  await startGame(match);
  const me = await api.getMe();
  await send(match.groupId, [
    '🔐 <b>بازی شروع شد!</b>',
    '━━━━━━━━━━━━━━',
    escapeHtml(pack.intro_fa || 'وارد لابی بشید، اتاق‌ها رو بگردید و رقم‌های قفل خروج رو پیدا کنید.'),
  ].join('\n'), {
    reply_markup: { inline_keyboard: [[{ text: '🚪 ورود به لابی',url: `https://t.me/${me.username}?startapp=m${matchId}&mode=fullscreen` }]] },
  });
}
