const ALLOWED = [2, 3, 4, 5];

export const validCapacities = (pack) =>
  ALLOWED.filter((n) => n >= pack.min_players && n <= pack.max_players);

export const computeStatus = (joined, max) => (joined >= max ? 'full' : 'open');
