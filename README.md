# Escape Room Bot — Telegram Serverless (tgcloud) foundation

## Setup
1. In @BotFather: your bot → Serverless → turn on.
2. `npm create @tgcloud/bot escape_bot && cd escape_bot`
3. Replace the scaffolded `tgcloud/` folder with the one from this archive.
4. Edit `tgcloud/lib/config.js` and set `ADMIN_IDS`.
5. `npx tgcloud login` (CLI token from BotFather → Serverless → CLI Access)
6. `npx tgcloud push` then `npx tgcloud migrate`
7. Add the bot to a group and make it admin (needed for pinning). Send /newmatch.

## Smoke test (no deploy)
`npx tgcloud run handlers/message '{ chat: { id: 1, type: "private" }, from: { id: 1, first_name: "A" }, text: "/help" }'`

## Add a pack
Create `tgcloud/lib/packs/<id>.js` (copy `demo.js`) and register it in `tgcloud/lib/packs/index.js`.
Required: `name, theme, min_players, max_players, rooms, map_positions` (optional `theme_fa`). Then push.

## Add an admin
Add the Telegram id to `ADMIN_IDS` in `tgcloud/lib/config.js`, then `npx tgcloud push`.

## Commands
| Command | Who | Where | Description |
|---|---|---|---|
| /start | all | any | greeting |
| /help | all | any | command list |
| /profile | all | any | your stats |
| /ranklist | all | any | top 20 by XP |
| /newmatch | admin | group | create match wizard |
| /cancelmatch | admin | group | cancel open match |
| /forcematch | admin | group | force start (needs min players) |

Game engine is a placeholder: `tgcloud/lib/gameEngine.js`.
