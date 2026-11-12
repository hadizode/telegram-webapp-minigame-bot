// Everything about WHO may act: channel gate, chat-admin checks, Mini App link config.
// (Merged from the old lib/channel.js + lib/admin.js + lib/config.js.)
import { api } from 'sdk';

// Short name of the Mini App as registered in @BotFather (/newapp).
// Leave '' to use the bot's *main* Mini App link: https://t.me/<bot>?startapp=...
export const MINIAPP_SHORT_NAME = 'escapist';

// ---- channel gate -------------------------------------------------------------------------------
export const CHANNEL = '@escapist1b';
export const CHANNEL_URL = 'https://t.me/escapist1b';

const OK = ['creator', 'administrator', 'member'];

export async function isChannelMember(userId) {
  try {
    const m = await api.getChatMember({ chat_id: CHANNEL, user_id: userId });
    return OK.includes(m.status) || (m.status === 'restricted' && m.is_member === true);
  } catch (e) {
    const d = String(e.description || e.message || '');
    if (/user not found/i.test(d)) return false;
    console.error('channel check failed (check CHANNEL & bot admin):', d);
    return true;
  }
}

export const JOIN_TEXT = '📢 برای استفاده از ربات اول باید عضو کانال ما بشی، بعد دوباره امتحان کن';
export const joinKeyboard = () => ({
  inline_keyboard: [[{ text: '📢 عضویت در کانال', url: CHANNEL_URL }]],
});

// ---- admins -------------------------------------------------------------------------------------
// True if the user is creator/administrator of the chat.
export async function isChatAdmin(chatId, userId) {
  try {
    const m = await api.getChatMember({ chat_id: chatId, user_id: userId });
    return ['creator', 'administrator'].includes(m.status);
  } catch (e) {
    console.warn('getChatMember failed', e.description || e.message);
    return false;
  }
}

// Anonymous admins post as the group itself (sender_chat.id === chat.id).
export const isAnonymousAdmin = (msg) => msg.sender_chat?.id === msg.chat.id;

export const isGroup = (chat) => ['group', 'supergroup'].includes(chat.type);

export async function isAdminMessage(msg) {
  return isAnonymousAdmin(msg) || (await isChatAdmin(msg.chat.id, msg.from.id));
}
