import {api} from 'sdk';

//channel username 
export const CHANNEL = '@escapist1bot';
export const CHANNEL_URL = 'https://t.me/escapist1bot';

const OK = ['creator', 'administrator', 'member'];

export async function isChannelMember(userId){
    try {
        const m = await api.getChatMember({ chat_id: CHANNEL, user_id:userId});
        return OK.includes(m.status) || (m.status === 'restricted' && m.is_member === true);
    } catch (e) {
        console.error('channel check faild', e.description || e.message);
        return true;
    }
}

export const JOIN_TEXT = '📢 برای استفاده از ربات اول باید عضو کانال ما بشی، بعد دوباره امتحان کن';
export const joinKeyboard = () => ({
    inline_keyboard: [[{text: '📢 عضویت در کانال', url:CHANNEL_URL}]],
});