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

export async function sendRich(chatId, htmlContent, extra = {}) {
  return api.sendRichMessage({
    chat_id: chatId,
    rich_message: { html: htmlContent }, 
    ...extra,
  });
}

// tg.js — نسخه بهروزرسانیشده editRich
export async function editRich(chatId, messageId, htmlContent, replyMarkup) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    rich_message: { html: htmlContent }, // ← استفاده از html
  };
  if (replyMarkup !== undefined) {
    payload.reply_markup = replyMarkup; // در صورت نیاز به کیبورد جداگانه
  }
  return api.editMessageText(payload);
}