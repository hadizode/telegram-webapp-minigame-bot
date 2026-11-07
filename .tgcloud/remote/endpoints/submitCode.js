import { requireAnyPlayer } from '../lib/gameApi.js';
import { submitCode, snapshotWithEnd } from '../lib/finish.js';

// The exit-lock keypad in the Mini App. `code` is the raw string from the pad
// (Persian or Latin digits, any order); a correct one ends the match for everyone.
export default async function (input, ctx) {
  const { match, user } = await requireAnyPlayer(ctx);
  if (match.status !== 'running') return { result: { ok: false, text: '🏁 بازی تمام شده' }, game: await snapshotWithEnd(match, user) };
  const code = typeof input.code === 'string' ? input.code : '';
  const out = await submitCode(match, user, code);
  return { result: out.result, game: await snapshotWithEnd(match, user) };
}
