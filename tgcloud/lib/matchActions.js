import { isChatAdmin } from './admin.js';
import { acquireLock } from './lock.js';
import { send } from './tg.js';
import { upsertUser } from './users.js';
import { getMatch, setStatus } from './matches.js';
import { addPlayer, countActive, deactivate, getActive } from './players.js';
import { computeStatus } from './capacity.js';
import { refreshCard, unpinCard, pinCard } from './cards.js';
import { onMatchStart } from './gameEngine.js';
import { api } from 'sdk';

// Shared by /forcematch and the start button.
// If the engine fails to start, the match goes back to its previous registration
// state (open/full) instead of being stuck as "running".
export async function startMatch(match, notReadyText) {
  await setStatus(match.id, 'running');
  try {
    await onMatchStart(match.id);
  } catch (e) {
    console.error('onMatchStart failed', e.message);
    await setStatus(match.id, 'full');
    await refreshCard(match.id);
    await send(match.groupId, notReadyText);
  }
  await unpinCard(match);
  await refreshCard(match.id);
}

// c = { chatId, from }
async function join(c, id) {
  const match = await getMatch(id);
  if (!match || match.status !== 'open') return send(c.chatId, '🚪 ثبت‌نام این مچ بسته شده');
  const member = await api.getChatMember({ chat_id: match.groupId, user_id: c.from.id });
  if (['left', 'kicked'].includes(member.status)) return send(c.chatId, '👥 اول باید عضو گروه باشی');
  const user = await upsertUser(c.from);
  if (await getActive(id, user.id)) return;
  if ((await countActive(id)) >= match.maxPlayers) return send(c.chatId, '😅 ظرفیت پر شده');
  await addPlayer(id, user.id);
  const status = computeStatus(await countActive(id), match.maxPlayers);
  if (status === 'full') await setStatus(id, 'full');
  await refreshCard(id);
  if (status === 'full') await send(match.groupId, '🎉 همه حاضرن! ادمین می‌تونه بازی رو شروع کنه ▶️');
}

// Allowed while open AND full. Leaving a full match reopens registration.
async function leave(c, id) {
  const match = await getMatch(id);
  if (!match || !['open', 'full'].includes(match.status)) return;
  const user = await upsertUser(c.from);
  if (!(await getActive(id, user.id))) return;
  await deactivate(id, user.id);
  if (match.status === 'full') {
    await setStatus(id, 'open');
    await refreshCard(id);
    return send(match.groupId, '🚪 یه نفر خارج شد؛ ثبت‌نام دوباره بازه!');
  }
  await refreshCard(id);
}

async function start(c, id) {
  if (!(await isChatAdmin(c.chatId, c.from.id))) return send(c.chatId, '⛔ فقط ادمین‌ها می‌تونن این کار رو بکنن');
  const match = await getMatch(id);
  if (!match || match.status !== 'full') return;
  return startMatch(match, '🛠 موتور بازی هنوز آماده نیست');
}

const actions = { join, leave, start };

export async function handleMatchAction(c, action, id) {
  let release;
  try {
    release = await acquireLock(`match:${id}`, 3000);
  } catch {
    return send(c.chatId, '⏳ یه لحظه صبر کن و دوباره امتحان کن');
  }
  try {
    return await actions[action](c, id);
  } finally {
    await release();
  }
}