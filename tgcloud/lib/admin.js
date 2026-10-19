import { api } from 'sdk';

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
