import { api } from 'sdk';

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
    inline_keyboard: [[{text: '📢 عضویت در کانال', url:CHANNEL_URL}]],
});