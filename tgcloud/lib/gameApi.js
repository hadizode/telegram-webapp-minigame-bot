import { EndpointError } from 'sdk';
import { getMatch } from './matches.js';
import { getUserByTgId } from './users.js';
import { getActive, touch } from './players.js';

// The Mini App is opened with ?startapp=m<matchId>; the platform verifies initData, we verify membership.
// `touch` keeps the presence record alive (presence.closeAbandoned watches it).
export async function requirePlayer(ctx) {
  const tg = ctx.initData?.user;
  const m = /^m(\d+)$/.exec(ctx.initData?.start_param || '');
  if (!tg || !m) throw new EndpointError('بازی رو از دکمه‌ی توی گروه باز کن', { code: 'NO_MATCH' });
  const match = await getMatch(Number(m[1]));
  if (!match || match.status !== 'running') throw new EndpointError('این مچ در حال اجرا نیست', { code: 'NOT_RUNNING' });
  const user = await getUserByTgId(tg.id);
  if (!user || !(await getActive(match.id, user.id))) {
    throw new EndpointError('تو توی این مچ نیستی', { code: 'NOT_PLAYER' });
  }
  await touch(match.id, user.id);
  return { match, user };
}

// Same as requirePlayer but also lets a FINISHED match through: players whose client is
// still polling must receive the end screen instead of an error. No touch() — presence
// no longer matters once the match is over.
export async function requireAnyPlayer(ctx) {
  const tg = ctx.initData?.user;
  const m = /^m(\d+)$/.exec(ctx.initData?.start_param || '');
  if (!tg || !m) throw new EndpointError('بازی رو از دکمه‌ی توی گروه باز کن', { code: 'NO_MATCH' });
  const match = await getMatch(Number(m[1]));
  if (!match || !['running', 'finished'].includes(match.status)) {
    throw new EndpointError('این مچ در حال اجرا نیست', { code: 'NOT_RUNNING' });
  }
  const user = await getUserByTgId(tg.id);
  if (!user || !(await getActive(match.id, user.id))) {
    throw new EndpointError('تو توی این مچ نیستی', { code: 'NOT_PLAYER' });
  }
  if (match.status === 'running') await touch(match.id, user.id);
  return { match, user };
}
