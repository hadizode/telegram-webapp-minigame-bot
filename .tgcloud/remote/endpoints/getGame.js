import { EndpointError } from 'sdk';
import { requireAnyPlayer } from '../lib/gameApi.js';
import { snapshotWithEnd, settle } from '../lib/finish.js';
import { closeAbandoned } from '../lib/presence.js';

export default async function (input, ctx) {
  const { match, user } = await requireAnyPlayer(ctx);
  // Lazy deadline check: if the timer ran out, this very poll concludes the match.
  if (match.status === 'running') await settle(match);
  closeAbandoned(); // fire-and-forget: no player around for 2 min → cancel the match
  const snap = await snapshotWithEnd(match, user);
  if (!snap) return { notReady: true };
  if (Number.isInteger(input.seq) && input.seq === snap.seq) return { unchanged: true };
  return snap;
}
