const ALLOWED = [2, 3, 4, 5];

// A capacity is offered only if the pack defines a variant (rooms + timer) for it.
export const validCapacities = (pack) =>
  ALLOWED.filter((n) => n >= pack.min_players && n <= pack.max_players && pack.variants?.[n]);

export const computeStatus = (joined, max) => (joined >= max ? 'full' : 'open');
