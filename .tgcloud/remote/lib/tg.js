import { api, BotApiError } from 'sdk';

export const send = (chat_id, text, extra = {}) =>
  api.sendMessage({ chat_id, text, parse_mode: 'HTML', ...extra });

export async function tryApi(fn, label) {
  try {
    return await fn();
  } catch (e) {
    const desc = e instanceof BotApiError ? e.description : e.message;
    if (!/not modified/i.test(desc)) console.warn(label, desc);
  }
}

export const editText = (chat_id, message_id, text, reply_markup) =>
  tryApi(() => api.editMessageText({ chat_id, message_id, text, parse_mode: 'HTML', reply_markup }), 'edit');

export const EMPTY_KB = { inline_keyboard: [] };
