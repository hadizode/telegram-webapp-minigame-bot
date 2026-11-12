# 🔐 Escape Room Bot

A group **Escape Room** game for Telegram, built on the **Telegram Serverless (tgcloud)** platform. An admin creates a match, players register, then a team enters rooms to solve puzzles.

## ✨ Features
- Step-by-step match wizard (pick pack → capacity → confirm), pinned match card in the group
- Data-driven game engine — room rules live in pack files; digits/codes never reach the client
- Static Mini App (no build): map, rooms, inventory, countdown, exit-lock keypad
- End-game loop: lazy timer, win/loss, rank/score/XP recorded and announced in the group
- Channel membership gate, player profiles, top-20 rank list, extensible pack system

## 🎮 Commands
`/start`, `/help`, `/profile`, `/ranklist`, `/newmatch`, `/cancelmatch`, `/forcematch`, `/finish`

## 🧱 Structure
```
tgcloud/
├── schema.js        # tables: users, matches, match_players, game_state, ...
├── handlers/        # message.js, callback_query.js
├── endpoints/       # getGame.js, act.js, submitCode.js (Mini App API)
└── lib/             # engine, rules, packs, core, fsm, wizard, ...
```

## 🚀 Deploy
```bash
npm run deploy      # tgcloud push (deploy modules + static site)
npx tgcloud migrate # apply schema.js changes to the database
```

See [AGENTS.md](AGENTS.md) and [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md) for platform rules and the full SDK reference.
