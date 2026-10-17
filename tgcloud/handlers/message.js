import { api } from 'sdk';
import { COMMANDS } from '../lib/commands.js';
import { send, tryApi } from '../lib/tg.js';

export default async function (message) {
  const m = (message.text || '').match(/^\/(\w+)(?:@(\w+))?(?:\s|$)/);
  if (!m) return;
  const cmd = COMMANDS[m[1].toLowerCase()];
  if (!cmd) return;
  try {
    if (m[2]) {
      const me = await api.getMe();
      if (me.username.toLowerCase() !== m[2].toLowerCase()) return; // addressed to another bot
    }
    await cmd(message);
  } catch (e) {
    console.error('command failed', m[1], e);
    await tryApi(() => send(message.chat.id, 'خطایی رخ داد'), 'error reply');
  }
}
