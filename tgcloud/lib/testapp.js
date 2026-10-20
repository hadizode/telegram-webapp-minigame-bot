import { api } from 'sdk';
import { send } from './tg.js';
import { MINIAPP_SHORT_NAME } from './config.js';

// TEMPORARY: connectivity test for opening the Mini App from a group.
// Uses a direct t.me link (works in any chat); start_param allows [A-Za-z0-9_-], max 64 chars.
export async function testapp(msg) {
  const me = await api.getMe();

  // Main Mini App link needs the Main Mini App to be configured in @BotFather.
  if (!MINIAPP_SHORT_NAME && !me.has_main_web_app) {
    return send(msg.chat.id, [
      '⚠️ <b>مینی‌اپ اصلی ربات تنظیم نشده</b>',
      'توی @BotFather: ربات ← Bot Settings ← Configure Mini App',
      'و آدرسی که <code>npx tgcloud push</code> چاپ کرد رو بده.',
      'یا با /newapp یه مینی‌اپ بساز و short name رو توی <code>lib/config.js</code> بنویس.',
    ].join('\n'));
  }

  const base = MINIAPP_SHORT_NAME
    ? `https://t.me/${me.username}/${MINIAPP_SHORT_NAME}`
    : `https://t.me/${me.username}`;
  const link = `${base}?startapp=test_${msg.chat.id}`;
  console.log('miniapp link', link);
  return send(msg.chat.id, {
    reply_markup: { inline_keyboard: [[{ text: '🚀 باز کردن مینی‌اپ', url: link }]] },
  });
}