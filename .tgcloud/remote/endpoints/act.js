import { EndpointError } from 'sdk';
import { requireAnyPlayer } from '../lib/gameApi.js';
import { playerAct } from '../lib/game.js';
import { snapshotWithEnd, settle } from '../lib/finish.js';

export default async function (input, ctx) {
  const { match, user } = await requireAnyPlayer(ctx);
  if (match.status !== 'running') throw new EndpointError('🏁 بازی تموم شده!', { code: 'FINISHED' });
  // Lazy deadline check before mutating state.
  await settle(match);
  const room = typeof input.room === 'string' ? input.room : '';
  const object = typeof input.object === 'string' ? input.object : '';
  const withItem = typeof input.with === 'string' ? input.with : null;
  const out = await playerAct(match, user, room, object, withItem);
  if (out.busy) throw new EndpointError('⏳ یه لحظه صبر کن و دوباره بزن', { code: 'BUSY' });
  return { result: out.result, game: await snapshotWithEnd(match, user) };
}
