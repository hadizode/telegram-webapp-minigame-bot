import { EndpointError } from 'sdk';
import { requirePlayer } from '../lib/gameApi.js';
import { playerAct, snapshot } from '../lib/game.js';

export default async function (input, ctx) {
  const { match, user } = await requirePlayer(ctx);
  const object = typeof input.object === 'string' ? input.object : '';
  const withItem = typeof input.with === 'string' ? input.with : null;
  const out = await playerAct(match, user, object, withItem);
  if (out.busy) throw new EndpointError('⏳ یه لحظه صبر کن و دوباره بزن', { code: 'BUSY' });
  return { result: out.result, room: await snapshot(match) };
}
