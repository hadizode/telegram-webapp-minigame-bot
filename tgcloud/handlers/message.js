import { api } from 'sdk';
import { COMMANDS } from '../lib/commands.js';
import { send, tryApi } from '../lib/tg.js';
import { isChannelMember, JOIN_TEXT, joinKeyboard } from '../lib/channel.js';
import { isAnonymousAdmin } from '../lib/admin.js';

export default async function (message) {
  const PUBLIC = new Set(['start', 'help']);
  const m = (message.text || '').match(/^\/(\w+)(?:@(\w+))?(?:\s|$)/);
  if (!m) return;
  const cmd = COMMANDS[m[1].toLowerCase()];
  if (!cmd) return;
  try {
    // In groups the command must be addressed to this bot (/cmd@botname).
    if (message.chat.type !== 'private') {
      if (!m[2]) return;
      const me = await api.getMe();
      if (me.username.toLowerCase() !== m[2].toLowerCase()) return;
    }
    if (!isAnonymousAdmin(message) && !(await isChannelMember(message.from.id))) {
      return await send(message.chat.id, JOIN_TEXT, { reply_markup: joinKeyboard() });
    }
    await cmd(message);
  } catch (e) {
    console.error('command failed', m[1], e);
    await tryApi(() => send(message.chat.id, '⚠️ مشکلی پیش اومد، دوباره امتحان کن'), 'error reply');
  }
  if (!PUBLIC.has(m[1].toLowerCase()) &&
  !isAnonymousAdmin(message) &&
  !(await isChannelMember(message.from.id))) {
    return await send(message.chat.id, JOIN_TEXT, { reply_markup: joinKeyboard() });
  }
}