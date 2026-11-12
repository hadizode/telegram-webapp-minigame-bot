// tgcloud/lib/rich.js
import { escapeHtml } from './core.js';

export const escAttr = (v = '') =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// دکمهٔ callback_data
export const btn = (label, data, style = 'primary') =>
  `<tg-button type="callback_data" style="${style}" data="${escAttr(data)}">${escapeHtml(label)}</tg-button>`;

// دکمهٔ لینک
export const urlBtn = (label, url, style = 'link') =>
  `<tg-button type="url" style="${style}" url="${escAttr(url)}">${escapeHtml(label)}</tg-button>`;

// دکمهٔ مینی‌اپ (فقط چت خصوصی)
export const webAppBtn = (label, url, style = 'primary') =>
  `<tg-button type="web_app" style="${style}" url="${escAttr(url)}">${escapeHtml(label)}</tg-button>`;

// دکمهٔ ورود
export const loginBtn = (label, url, options = {}) => {
  let attrs = `type="login_url" url="${escAttr(url)}"`;
  if (options.forwardText) attrs += ` forward-text="${escAttr(options.forwardText)}"`;
  if (options.requestWriteAccess) attrs += ' request-write-access';
  if (options.style) attrs += ` style="${escAttr(options.style)}"`;
  return `<tg-button ${attrs}>${escapeHtml(label)}</tg-button>`;
};

// دکمهٔ کپی متن
export const copyBtn = (label, text, style = 'primary') =>
  `<tg-button type="copy_text" style="${style}" text="${escAttr(text)}">${escapeHtml(label)}</tg-button>`;

// دکمهٔ اینلاین کوئری
export const switchInlineBtn = (label, query, style = 'primary') =>
  `<tg-button type="switch_inline_query" style="${style}" query="${escAttr(query)}">${escapeHtml(label)}</tg-button>`;

// دکمهٔ غیرفعال
export const disabledBtn = (label) =>
  `<tg-button type="disabled">${escapeHtml(label)}</tg-button>`;

// ردیف دکمه‌ها
export const row = (buttons, align = 'center') =>
  `<tg-button-row align="${align}">${buttons.join('')}</tg-button-row>`;