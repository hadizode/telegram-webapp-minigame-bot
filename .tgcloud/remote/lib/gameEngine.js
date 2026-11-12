import { api } from 'sdk';
import { getMatch } from './matches.js';
import { getPack } from './packLoader.js';
import { sendRich } from './tg.js';
import { startGame } from './game.js';
import { escapeHtml } from './core.js';
import { urlBtn, row } from './rich.js';

// Called by startMatch (/forcematch and the start button) after status = running.
export async function onMatchStart(matchId) {
  const match = await getMatch(matchId);
  const pack = getPack(match.packId);
  await startGame(match);

  const me = await api.getMe();
  const lobbyUrl = `https://t.me/${me.username}?startapp=m${matchId}&mode=fullscreen`;

  const html = [
    '<h2>🔐 بازی شروع شد!</h2>',
    '<hr>',
    `<p>${escapeHtml(pack.intro_fa || 'وارد لابی بشید، اتاق‌ها رو بگردید و رقم‌های قفل خروج رو پیدا کنید.')}</p>`,
    row([urlBtn('🚪 ورود به لابی', lobbyUrl, 'success')]),
  ].join('\n');

  await sendRich(match.groupId, html);
}