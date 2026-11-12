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

// ---- inline keyboards -> rich messages --------------------------------

// Text block carrying the old message body. Inline HTML (<b>, <code>, <i>,
// <a href>) is converted to RichText so bold/code/link markup survives the
// switch from parse_mode: 'HTML' to rich messages.
// https://core.telegram.org/bots/api/types/richtext.md
//         https://core.telegram.org/bots/api/types/richtextbold.md
//         https://core.telegram.org/bots/api/types/richtextcode.md
//         https://core.telegram.org/bots/api/types/richtexturl.md
//         https://core.telegram.org/bots/api/types/inputrichblockparagraph.md
const htmlToRich = (text) => {
  // Builds a tree of { type, children: [] } nodes, then collapses to RichText.
  // RichTextBold/RichTextCode/RichTextItalic/RichTextUrl expose a single `text`
  // field (RichText). We keep it as a plain string when possible so Telegram's
  // parser never sees an unsupported nested array type.
  // https://core.telegram.org/bots/api/types/richtext.md
  const root = { children: [] };
  const stack = [root];
  let buf = '';
  const flush = () => {
    if (buf) {
      stack[stack.length - 1].children.push(buf);
      buf = '';
    }
  };
  const re = /<(b|strong|code|i|em)\b[^>]*>|<\/(b|strong|code|i|em)>|(<a\s+href="([^"]*)"[^>]*>)|<\/a>/gi;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    buf += text.slice(last, m.index);
    last = re.lastIndex;
    if (m[1]) {
      flush();
      const type = m[1] === 'strong' ? 'bold' : m[1] === 'em' ? 'italic' : m[1];
      const node = { type, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (m[2]) {
      flush();
      if (stack.length > 1) stack.pop();
    } else if (m[4] !== undefined) {
      flush();
      const node = { type: 'url', url: m[4], children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else {
      flush();
      if (stack.length > 1) stack.pop();
    }
  }
  buf += text.slice(last);
  flush();

  const toRich = (node) => {
    if (typeof node === 'string') return node;
    const kids = node.children;
    if (kids.length === 0) return '';
    const converted = kids.map((k) => (typeof k === 'string' ? k : toRich(k)));
    if (converted.length === 1 && typeof converted[0] === 'string') return converted[0];
    if (node.type === 'url')
      return { type: 'url', url: node.url, text: converted.length === 1 ? converted[0] : converted };
    return { type: node.type, text: converted.length === 1 ? converted[0] : converted };
  };

  const kids = root.children;
  if (kids.length === 0) return '';
  const converted = kids.map((k) => (typeof k === 'string' ? k : toRich(k)));
  if (converted.length === 1 && typeof converted[0] === 'string') return converted[0];
  return converted;
};

const paragraph = (text) => ({ type: 'paragraph', text: htmlToRich(text) });

// One old keyboard row becomes one buttons block (1-8 buttons).
// Source: https://core.telegram.org/bots/api/types/inputrichblockbuttons.md
const buttonsBlock = (row, align = 'center') => ({
  type: 'buttons',
  align,
  buttons: row.map((b) => {
    const { text, ...action } = b;
    return { text, ...action };
  }),
});

// Build rich-message blocks: one paragraph block + one buttons block per
// old keyboard row. Each button keeps exactly one action (url / callback_data / …)
// with its original value; no style is added because the old buttons implied none.
// Source: https://core.telegram.org/bots/api/types/inputrichmessage.md
//         https://core.telegram.org/bots/api/types/richmessagebutton.md
export const richBlocks = (text, rows) => [
  paragraph(text),
  ...rows.filter((row) => row.length).map((row) => buttonsBlock(row)),
];

export const sendRich = async (chat_id, blocks, extra = {}) => {
  try {
    return await api.sendRichMessage({ chat_id, rich_message: { blocks }, ...extra });
  } catch (e) {
    console.error('sendRich failed', { chat_id, blocks, extra, error: String(e) });
    throw e;
  }
};

export const editRich = async (chat_id, message_id, blocks) => {
  try {
    return await api.editMessageText({ chat_id, message_id, rich_message: { blocks } });
  } catch (e) {
    console.error('editRich failed', { chat_id, message_id, blocks, error: String(e) });
    throw e;
  }
};
