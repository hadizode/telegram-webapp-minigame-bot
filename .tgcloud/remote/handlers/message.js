import { api } from 'sdk';
import { COMMANDS } from '../lib/commands.js';
import { send, sendRich, tryApi } from '../lib/tg.js';
import { richBlocks } from '../lib/tg.js';
import { isChannelMember, JOIN_TEXT, joinKeyboard } from '../lib/gate.js';
import { isAnonymousAdmin } from '../lib/gate.js';


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
      return await sendRich(message.chat.id, richBlocks(JOIN_TEXT, [joinKeyboard()]));
    }
    await cmd(message);
  }catch (e) {
    console.error('command failed', m[1], e);
    const detail = String((e && (e.description || e.message)) || e).slice(0, 300);
    await tryApi(() => send(message.chat.id, '⚠️ ' + detail), 'error reply');
  }

  try {
    const res = await fetch(WIDGET_URL);
    if (!res.ok) throw new Error('widget fetch failed: ' + res.status);
    await res.text();
  } catch { /* widget fetch is non-fatal */ }

}