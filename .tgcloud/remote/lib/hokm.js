import { api, fetch } from 'sdk';
import { sendRich } from './tg.js';
import { HOKM_HTML } from './hokm-html.js';


const CAPTION = '♠♥ بازی حکم — برای شروع کارت‌ها را لمس کنید';

export async function hokm(message) {
  if (message.chat.type !== 'private') {
    const me = await api.getMe();
    return sendRich(message.chat.id, richBlocks('بازی حکم فقط در چت خصوصی با ربات اجرا می‌شود 👇', [[
      { text: '🃏 شروع بازی', url: `https://t.me/${me.username}?start=hokm` },
    ]]));
  }
  await api.sendWidget({
    chat_id: message.chat.id,
    html: HOKM_HTML,
    caption: CAPTION,
  });
}