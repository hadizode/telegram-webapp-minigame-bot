import { requirePlayer } from '../lib/gameApi.js';
import { snapshot } from '../lib/game.js';
import { touch } from '../lib/players.js';

export default async function (input, ctx) {
  const { match, user } = await requirePlayer(ctx);
  await touch(match.id, user.id)
  const snap = await snapshot(match,user);
  if (!snap) return { notReady: true };
  if (Number.isInteger(input.seq) && input.seq === snap.seq) return { unchanged: true };
  return snap;
}
