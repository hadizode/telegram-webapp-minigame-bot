import { api } from 'sdk';
import { handleWizard } from '../lib/wizard.js';
import { handleMatchAction } from '../lib/matchActions.js';
import { sendProfileByTgId } from '../lib/commands.js';
import { tryApi } from '../lib/tg.js';
import { isChannelMember, JOIN_TEXT } from '../lib/channel.js';

const ROUTES = [
  [/^nm:(pack|cap|confirm|cancel|refresh):/, (c, d) => handleWizard(c, d.split(':'))],
  [/^match:(join|leave|start):(\d+)$/, (c, d, m) => handleMatchAction(c, m[1], Number(m[2]))],
  [/^profile:view:(\d+)$/, (c, d, m) => sendProfileByTgId(c.chatId, Number(m[1]))],
];

export default async function (cq) {
  if (!(isChannelMember(cq.from.id))){
    return tryApi(() => api.answerCallbackQuery({
      callback_query_id: cq.id, text:JOIN_TEXT, show_alert:true,
    }), 'gate alert');
  }
  await tryApi(() => api.answerCallbackQuery({ callback_query_id: cq.id}), 'answer');
  const data = cq.data || '';
  const c = { chatId: cq.message?.chat?.id, messageId: cq.message?.message_id, from: cq.from };
  for (const [re, handler] of ROUTES) {
    const m = data.match(re);
    if (!m) continue;
    try {
      return await handler(c, data, m);
    } catch (e) {
      console.error('callback failed', data, e);
      // NOTE: query already answered, so this alert may be ignored by Telegram.
      return tryApi(() => api.answerCallbackQuery({
        callback_query_id: cq.id, text: 'خطا، دوباره تلاش کن', show_alert: true,
      }), 'error alert');
    }
  }
}
