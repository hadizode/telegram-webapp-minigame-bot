import { EndpointError } from 'sdk';
import { requirePlayer } from '../lib/gameApi.js';
import { advance, snapshot } from '../lib/game.js';

export default async function (input, ctx) {
  const { match } = await requirePlayer(ctx);
  const out = await advance(match);
  if (out.busy) throw new EndpointError('⏳ یه لحظه صبر کن و دوباره بزن', { code: 'BUSY' });
  return { room: await snapshot(match) };
}
