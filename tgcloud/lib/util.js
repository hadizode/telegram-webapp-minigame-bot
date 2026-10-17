const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

export const formatDate = (d) =>
  new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(d));

export const rid = () => Math.random().toString(36).slice(2, 10);

// NOTE: docs show both array and {rows} shapes for .returning().run(); handle both.
export const first = (res) => (Array.isArray(res) ? res[0] : res?.rows?.[0]);
