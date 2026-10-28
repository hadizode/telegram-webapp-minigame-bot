// End-of-match cycle: the exit-lock code, the countdown timer, win/lose settlement,
// per-player ranking (from match_events), XP rewards and the group announcement.
//
// There is no cron on this platform, so everything is lazy: getGame / act / submitCode
// call settle() first — if the variant's minutes elapsed, the match is finished before
// answering that request. The game_state row stays alive after finishing: it carries the
// end screen (gs.finished) which snapshot() merges into every response.

import { db } from 'sdk';
import { eq, and, asc, sql } from 'sdk/db';
import { matchEvents, matchPlayers, users } from '../schema.js';
import { acquireLock } from './core.js';
import { getMatch, setStatus } from './matches.js';
import { getPack, getVariant } from './packLoader.js';
import { getGame, saveGame } from './core.js';
import { buildSnapshot } from './snapshot.js';
import { listActive } from './players.js';
import { refreshCard } from './cards.js';
import { send, tryApi } from './tg.js';
import { escapeHtml } from './core.js';

const FA = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export const faDigits = (str) => String(str).replace(/\d/g, (d) => FA[+d]);

// Persian/French digits, spaces, dashes → plain ASCII digit string.
export const parseCode = (raw) => {
  let out = '';
  for (const ch of String(raw ?? '')) {
    if (ch >= '0' && ch <= '9') out += ch;
    else {
      const i = FA.indexOf(ch);
      if (i >= 0) out += i;
    }
  }
  return out;
};

// Wrong-code cooldown, computed from the event log itself (no extra state): a player who
// made ≥3 wrong attempts in the last minute must wait until the oldest one ages out.
const COOLDOWN_MS = 60 * 1000; // 60s
const MAX_WRONG = 3;

// ---- scoring ---------------------------------------------------------------------------
// rank 1..n by the time of the player's FIRST correct code (players with none rank last,
// ordered by join time). score = 1000 + 150*(n-rank) + 5*correct − 2*wrong, floored at 0.
// xp = score (win) or floor(score/4) (loss).
export function computeRanks(rows, events) {
  const n = rows.length || 1;
  const ok = new Map(); // userId -> first correct ts
  const bad = new Map(); // userId -> wrong count
  for (const e of events) {
    if (e.type === 'digit_ok') {
      const t = e.createdAt.getTime();
      const cur = ok.get(e.userId);
      if (cur === undefined || t < cur) ok.set(e.userId, t);
    } else if (e.type === 'digit_wrong') {
      bad.set(e.userId, (bad.get(e.userId) || 0) + 1);
    }
  }
  const ranked = [...rows].sort((a, b) => {
    const ta = ok.has(a.userId) ? ok.get(a.userId) : Infinity;
    const tb = ok.has(b.userId) ? ok.get(b.userId) : Infinity;
    if (ta !== tb) return ta - tb;
    return new Date(a.joinedAt) - new Date(b.joinedAt);
  });
  return ranked.map((row, i) => {
    const rank = i + 1;
    const good = events.filter((e) => e.userId === row.userId && e.type === 'digit_ok').length;
    const wrong = bad.get(row.userId) || 0;
    const score = Math.max(0, 1000 + 150 * (n - rank) + 5 * good - 2 * wrong);
    return { ...row, rank, score };
  });
}

// PURE (no sdk/DB): the exit-lock keypad state the Mini App renders. `found` are the
// digits the team has discovered (already in the snapshot — public); `slots` shows which
// cells the log has filled (first-correct-wins per cell); `cooldownMs` is how long this
// player must still wait after ≥3 recent wrong attempts.
export function lockState(variantDigits, found, events, userId, now) {
  const len = variantDigits.length;
  const slots = Array(len).fill(null);
  let myWrong = [];
  for (const e of events) {
    // The keypad logs the whole submitted code in `digit` and which lock cell it filled
    // in `slot`. A correct code is a permutation of the digits, so each single-digit
    // event fills its own cell (the cell order carries no meaning — any order wins).
    if (e.type === 'digit_ok' && e.slot !== null && e.slot !== undefined && e.slot < len && slots[e.slot] === null) {
      const s = String(e.digit ?? '');
      slots[e.slot] = faDigits(s.length === 1 ? s : s.slice(-len));
    } else if (e.type === 'digit_wrong' && e.userId === userId) {
      myWrong.push(e.createdAt.getTime());
    }
  }
  myWrong.sort((a, b) => a - b);
  let cooldownMs = 0;
  if (myWrong.length >= MAX_WRONG) {
    const cutoff = now - COOLDOWN_MS;
    myWrong = myWrong.filter((t) => t >= cutoff);
    if (myWrong.length >= MAX_WRONG) cooldownMs = myWrong[0] + COOLDOWN_MS - now;
  }
  return { lockLength: len, slots, found: found.map(faDigits), cooldownMs: Math.max(0, cooldownMs) };
}

async function writeResults(ranked, won) {
  for (const p of ranked) {
    const xp = won ? p.score : Math.floor(p.score / 4);
    await db.update(matchPlayers).set({ rank: p.rank, score: p.score })
      .where(eq(matchPlayers.id, p.id)).run();
    // Incremental update via the sql template (column refs interpolate as identifiers).
    await db.update(users)
      .set({
        totalXp: sql`${users.totalXp} + ${xp}`,
        matchesPlayed: sql`${users.matchesPlayed} + 1`,
        matchesWon: sql`${users.matchesWon} + ${won ? 1 : 0}`,
      })
      .where(eq(users.id, p.userId)).run();
  }
}

// Announce + end screen + DB close-out. Runs under the match lock, exactly once.
async function conclude(match, won, reasonText) {
  const pack = getPack(match.packId);
  // listActive returns users (with usernames) ordered by join time, already joined
  // against match_players — we add the row ids from a parallel raw query.
  const rows = await db.select().from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.isActive, true)))
    .orderBy(asc(matchPlayers.joinedAt), asc(matchPlayers.id)).all();
  const people = await listActive(match.id);
  const byUserId = new Map(people.map((u) => [u.id, u]));
  const events = await db.select().from(matchEvents).where(eq(matchEvents.matchId, match.id)).all();
  const ranked = computeRanks(rows, events).map((p) => {
    const u = byUserId.get(p.userId);
    return { ...p, name: u ? (u.username ? `@${u.username}` : u.firstName || 'بازیکن') : 'بازیکن' };
  });
  await writeResults(ranked, won);
  await setStatus(match.id, 'finished');

  const digits = getVariant(pack, match.maxPlayers).digits.join('');
  const lines = [
    won ? '🎉 <b>فرار موفق!</b>' : '💀 <b>وقت تموم شد — فرار ناموفق</b>',
    `🔑 رمز قفل: <b>${escapeHtml(faDigits(digits))}</b>`,
    '',
    '🏆 <b>رتبه‌بندی</b>',
    ...ranked.map((p) => `${FA[p.rank] ?? p.rank}. ${escapeHtml(p.name)} — +${p.score} XP`),
  ];
  await tryApi(() => send(match.groupId, lines.join('\n')), 'finish announce');
  await tryApi(() => refreshCard(match.id), 'finish card');

  const end = {
    won,
    title: won ? '🎉 فرار موفق!' : '⏰ وقت تموم شد',
    subtitle: reasonText || (won ? 'با هم فرار کردید!' : 'رمز درست را نزديد.'),
    digits: faDigits(digits),
    players: ranked.map((p) => ({ rank: p.rank, name: p.name, score: p.score })),
  };
  await saveGame(match.id, { finished: JSON.stringify(end) });
  return end;
}

// Lazy deadline check, called (after requirePlayer) by getGame/act/submitCode.
// Returns the end screen if it just concluded, else null. Cheap when not expired.
export async function settle(match) {
  const g = await getGame(match.id);
  if (!g) return null;
  const started = match.startedAt ? new Date(match.startedAt).getTime() : 0;
  const minutes = getVariant(getPack(match.packId), match.maxPlayers).minutes;
  if (!started || Date.now() - started < minutes * 60_000) return null;
  let release;
  try { release = await acquireLock(`match:${match.id}`, 5000); } catch { return null; }
  try {
    const fresh = await getMatch(match.id);
    if (fresh.status !== 'running') return null;
    return conclude(fresh, false, 'زمان بازی تمام شد.');
  } finally { await release(); }
}

// The Mini App's exit-lock keypad. A correct submission must contain ALL the team's
// digits in any order (the lock cells show no order hint). Wrong attempts are logged
// and rate-limited per player; a correct one concludes the match exactly once.
export async function submitCode(match, user, rawCode) {
  const code = parseCode(rawCode);
  if (!code) return { result: { ok: false, text: '🔢 اول رقم‌ها رو وارد کن' } };

  const pack = getPack(match.packId);
  const variant = getVariant(pack, match.maxPlayers);
  const now = Date.now();

  // Cooldown lives on the whole TEAM (one shared lock): ≥3 wrong attempts by anyone
  // within the last minute → everyone waits until the oldest of them ages out.
  const allEvents = await db.select().from(matchEvents).where(eq(matchEvents.matchId, match.id)).all();
  const st = lockState(variant.digits, [], allEvents, user.id, now);
  const myWrong = allEvents
    .filter((e) => e.type === 'digit_wrong')
    .map((e) => e.createdAt.getTime())
    .sort((a, b) => a - b)
    .filter((t) => now - t < COOLDOWN_MS);
  if (myWrong.length >= MAX_WRONG) {
    const wait = Math.ceil((COOLDOWN_MS - (now - myWrong[0])) / 1000);
    return { result: { ok: false, text: `🚫 زیاد اشتباه زدید! ${wait} ثانیه صبر کن` } };
  }

  const sorted = (s) => [...s].sort().join('');
  const correct = code.length === variant.digits.length
    && sorted(code) === sorted(variant.digits.join(''));

  // Log the attempt. A correct one fills the first still-empty lock cell; the unique
  // (match_id, slot) index settles simultaneous winners (the loser logs without a slot).
  const usedSlots = new Set(allEvents
    .filter((e) => e.type === 'digit_ok' && e.slot !== null && e.slot !== undefined)
    .map((e) => e.slot));
  let slot = null;
  if (correct) {
    for (let i = 0; i < variant.digits.length; i++) if (!usedSlots.has(i)) { slot = i; break; }
  }
  try {
    await db.insert(matchEvents)
      .values({
        matchId: match.id, userId: user.id,
        type: correct ? 'digit_ok' : 'digit_wrong',
        digit: Number(code), slot, createdAt: new Date(),
      }).run();
  } catch { /* lost the slot race — the attempt still counts as logged */ }

  if (!correct) {
    return { result: { ok: false, text: '❌ رمز اشتباهه! رقم‌ها رو با هم چک کن و دوباره بزن' } };
  }

  // Correct code → finish under the match lock (conclude runs exactly once).
  let release;
  try { release = await acquireLock(`match:${match.id}`, 5000); } catch { release = async () => {}; }
  let end;
  try {
    const fresh = await getMatch(match.id);
    if (fresh.status !== 'running') {
      const g = await getGame(match.id);
      end = g?.finished ? JSON.parse(g.finished) : null;
    } else {
      end = await conclude(fresh, true, `${user.firstName || 'یکی از بازیکن‌ها'} رمز درست رو زد!`);
    }
  } finally { await release(); }

  return { result: { ok: true, text: '🔓 قفل باز شد!' }, end };
}

// Snapshot that tolerates a finished match: the game_state row keeps the end screen,
// so players who still poll see the result instead of an error. Also carries the
// countdown (`deadline`) and the exit-lock keypad state (`lock`).
export async function snapshotWithEnd(match, user) {
  const g = await getGame(match.id);
  if (!g) return null;
  const pack = getPack(match.packId);
  const variant = getVariant(pack, match.maxPlayers);
  const gs = JSON.parse(g.state);
  const snap = buildSnapshot(pack, variant.rooms, gs, match.maxPlayers);
  if (g.finished) {
    snap.end = JSON.parse(g.finished);
    return snap;
  }
  const started = match.startedAt ? new Date(match.startedAt).getTime() : Date.now();
  snap.deadline = started + variant.minutes * 60_000;
  const events = await db.select().from(matchEvents).where(eq(matchEvents.matchId, match.id)).all();
  snap.lock = lockState(variant.digits, snap.found, events, user.id, Date.now());
  return snap;
}
