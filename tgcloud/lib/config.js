// Add admin Telegram user ids here, then `npx tgcloud push`.
export const ADMIN_IDS = [123456, 789012];
export const isAdmin = (id) => ADMIN_IDS.includes(id);
