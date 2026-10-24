import { requirePlayer } from '../lib/gameApi.js';
import { snapshot } from '../lib/game.js';

export default async function (input, ctx) {
  const { match } = await requirePlayer(ctx);
  const snap = await snapshot(match);
  if (!snap) return { notReady: true };
  if (Number.isInteger(input.seq) && input.seq === snap.seq) return { unchanged: true };
  return snap;
}
