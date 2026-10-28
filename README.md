# 🔐 Escape Room Bot

ربات بازی گروهی «اتاق فرار» برای تلگرام، ساخته‌شده روی پلتفرم **Telegram Serverless (tgcloud)**.
ادمین گروه یک مچ می‌سازد، بازیکن‌ها ثبت‌نام می‌کنند و بعد تیمی وارد اتاق‌ها می‌شوند تا معماها را حل کنند.

> **وضعیت پروژه:** پایه‌ی ربات، موتور بازی (`engine/rules/game`)، Mini App و چرخه‌ی پایان بازی
> (تایمر، قفل خروج با keypad، ثبت نتیجه/XP) پیاده‌سازی شده‌اند.
> فعلاً فقط اتاق «برق» پک بیمارستان کامل است؛ اتاق‌های دیگر سناریو در دست ساخت‌اند.

---

## ✨ امکانات

- ساخت مچ با ویزارد مرحله‌ای (انتخاب پک ← ظرفیت ← تأیید)
- کارت مچ پین‌شده در گروه با دکمه‌های ورود / خروج / شروع
- قفل (lock) روی عملیات هر مچ برای جلوگیری از race condition
- موتور بازی data-driven: قواعد اتاق‌ها داخل فایل پک، ارقام و رمز هیچ‌وقت به کلاینت نمی‌روند
- Mini App (بدون build): نقشه، اتاق‌ها، inventory، شمارش معکوس و keypad قفل خروج
- چرخه‌ی پایان بازی: تایمر lazy، برد با زدن رمز کامل، باخت با پایان وقت یا `/finish`
- ثبت نتیجه: رتبه/اسکور هر بازیکن، XP، برد/باخت و اعلام نتیجه در گروه
- گیت عضویت کانال قبل از اجرای دستورات
- پروفایل بازیکن: XP، لقب، تعداد بازی و برد
- جدول ۲۰ نفر برتر
- سیستم پک (Pack) برای افزودن سناریوهای جدید بدون تغییر منطق ربات
- تمام پیام‌ها فارسی و با `parse_mode: HTML`

## 🎮 دستورات

| دستور | چه کسی | کجا | توضیح |
|---|---|---|---|
| `/start` | همه | هرجا | معرفی ربات |
| `/help` | همه | هرجا | لیست دستورات (ادمین‌ها بخش اضافه می‌بینند) |
| `/profile` | همه | هرجا | آمار و لقب من |
| `/ranklist` | همه | هرجا | ۲۰ نفر برتر بر اساس XP |
| `/newmatch` | ادمین | گروه | ویزارد ساخت مچ |
| `/cancelmatch` | ادمین | گروه | لغو مچ باز |
| `/forcematch` | ادمین | گروه | شروع اجباری (حداقل تعداد بازیکن لازم است) |
| `/finish` | ادمین | گروه | پایان فوری مچ در حال اجرا (ثبت نتیجه + اعلام در گروه) |

> ⚠️ در **گروه‌ها** دستور باید با نام ربات بیاید: `/newmatch@your_bot`. در چت خصوصی نیازی نیست.
> «ادمین» یعنی creator/administrator گروه (از طریق `getChatMember` چک می‌شود؛ ادمین‌های anonymous هم پشتیبانی می‌شوند). فایل `ADMIN_IDS` یا config جداگانه‌ای وجود ندارد.

## 🧱 ساختار پروژه

```
tgcloud/
├── schema.js              # جدول‌ها: users, matches, match_players, fsm_sessions, locks, match_events, game_state
├── handlers/
│   ├── message.js         # پارس و اجرای دستورات (گیت عضویت کانال)
│   └── callback_query.js  # مسیریابی دکمه‌های اینلاین (nm:*, match:*, profile:*)
├── endpoints/             # API مینی‌اپ (احراز هویت با initData)
│   ├── getGame.js         # poll با seq + settle تایمر + presence
│   ├── act.js             # تعامل با اشیای اتاق (زیر lock)
│   └── submitCode.js      # keypad قفل خروج → پایان بازی
└── lib/
    ├── core.js            # util + game_state + DB lock + cleanup (ادغام‌شده)
    ├── gate.js            # کانال گیت + تشخیص ادمین + config (ادغام‌شده)
    ├── commands.js        # پیاده‌سازی دستورات + guard (group/admin)
    ├── wizard.js          # ویزارد /newmatch
    ├── matchActions.js    # join / leave / start (با lock)
    ├── cards.js           # ساخت، پین و بروزرسانی کارت مچ
    ├── matches.js         # دسترسی به جدول matches
    ├── players.js         # دسترسی به match_players
    ├── users.js           # کاربران، XP و لقب‌ها
    ├── capacity.js        # ظرفیت‌های مجاز و وضعیت پر/باز
    ├── presence.js        # lastSeen بازیکن‌ها + بستن مچ رهاشده
    ├── fsm.js             # state ویزارد در DB (TTL پنج دقیقه)
    ├── tg.js              # wrapperهای Bot API (send, editText, tryApi)
    ├── packLoader.js      # اعتبارسنجی و لود پک‌ها
    ├── engine.js          # اجرای قواعد (triggers/effects) روی state
    ├── rules.js           # مفسر data-only قواعد اتاق‌ها
    ├── game.js            # createGame/playerAct (state در game_state)
    ├── gameEngine.js      # اتصال موتور به چرخه‌ی مچ (onMatchStart)
    ├── gameApi.js         # requirePlayer / requireAnyPlayer برای endpointها
    ├── snapshot.js        # نمای state برای کلاینت (بدون ارقام/رمز)
    ├── finish.js          # ⭐ چرخه‌ی پایان: settle/submitCode/conclude/finishMatch
    ├── testapp.js         # /testapp — لینک مینی‌اپ برای تست
    └── packs/
        ├── index.js       # ثبت پک‌ها (filesystem در runtime نیست)
        ├── demo.js        # پک نمونه
        └── hospital/      # سناریوی بیمارستان (power کامل، بقیه در دست ساخت)
public/                    # Mini App استاتیک (index.html + game.js + style.css)
room-editor.html           # ادیتور بصری پک‌ها با playtest
puzzles/                   # طرح معماها
docs/tgcloud-sdk.md        # مرجع SDK پلتفرم
AGENTS.md                  # راهنمای دستیارهای هوش مصنوعی/توسعه‌دهنده‌ها
tgcloud.jsonc              # تنظیمات پروژه (static برای Mini App فعال)
```

## 🚀 راه‌اندازی

پیش‌نیاز: Node.js ‏18 یا بالاتر.

1. در @BotFather: ربات خود ← **Serverless** ← فعال کنید.
2. وابستگی‌ها را نصب کنید:
   ```bash
   npm install
   ```
3. ربات را به پروژه وصل کنید (توکن CLI از BotFather ← Serverless ← CLI Access):
   ```bash
   npx tgcloud login
   ```
4. کد را deploy کنید و **سپس** دیتابیس را migrate کنید (این دو مرحله جدا هستند):
   ```bash
   npx tgcloud push
   npx tgcloud migrate
   ```
5. ربات را به گروه اضافه کنید و **ادمین** کنید (برای پین کردن پیام لازم است)، سپس `/newmatch@your_bot` را بفرستید.

### دستورات CLI

```bash
npx tgcloud status    # تفاوت لوکال با کلود
npx tgcloud push      # deploy ماژول‌ها (دیتابیس را تغییر نمی‌دهد)
npx tgcloud migrate   # اعمال تغییرات schema.js روی دیتابیس
npx tgcloud webhook   # وضعیت webhook (و sync برای تعمیر)
npx tgcloud run <module> '<json>'   # اجرای هندلر سمت سرور
```

میانبر: `npm run deploy` (معادل `tgcloud push`).

### تست سریع (بدون deploy)

```bash
npx tgcloud run handlers/message '{ "chat": { "id": 1, "type": "private" }, "from": { "id": 1, "first_name": "A" }, "text": "/help" }'
```

## 📦 افزودن پک جدید

1. فایل `tgcloud/lib/packs/<id>.js` را از روی `demo.js` بسازید.
2. آن را در `tgcloud/lib/packs/index.js` ثبت کنید (چون filesystem در runtime وجود ندارد):
   ```js
   import demo from './demo.js';
   import hospital from './hospital.js';
   export const PACKS = { demo, hospital };
   ```
3. `npx tgcloud push`

فیلدهای **اجباری**: `name`، `theme`، `min_players`، `max_players`، `rooms`، `map_positions`
فیلد اختیاری: `theme_fa`

پک‌های ناقص هنگام لیست‌شدن نادیده گرفته می‌شوند و در لاگ هشدار می‌دهند.
ظرفیت‌های قابل انتخاب در ویزارد، اشتراک بازه‌ی `min_players..max_players` پک با `[2, 3, 4, 5]` است.

## 🔄 چرخه‌ی عمر مچ

```
open ──(پر شدن ظرفیت)──▶ full ──(شروع)──▶ running ──(رمز درست / پایان وقت / /finish)──▶ finished
  │                         │
  └────────(/cancelmatch)───┴──▶ cancelled
```

- هر گروه در هر لحظه فقط **یک** مچ `open` یا `full` می‌تواند داشته باشد.
- ورود/خروج فقط تا زمانی که مچ `open` است ممکن است.
- شروع مچ هم از دکمه‌ی «▶️ شروع بازی» (فقط ادمین، وقتی `full`) و هم از `/forcematch` ممکن است.
- مچ رهاشده (بازیکنی دو دقیقه poll نکند) خودکار `cancelled` می‌شود (`presence.closeAbandoned`).

## 🔚 چرخه‌ی پایان بازی (`lib/finish.js`)

- **تایمر:** cron در پلتفرم نیست؛ `getGame`/`act` قبل از پاسخ، `settle()` را صدا می‌زنند — اگر `variants.minutes` گذشته باشد، مچ همان‌جا `finished` (باخت) می‌شود.
- **قفل خروج:** در Mini App یک keypad باز می‌شود؛ رمز = تمام رقم‌های variant در هر ترتیبی. هر تلاش در `match_events` لاگ می‌شود؛ ≥۳ تلاش غلط در یک دقیقه → cooldown برای همه.
- **بردی/نتیجه:** اولین کد درست زیر lock مچ، `conclude()` را دقیقاً یک‌بار اجرا می‌کند: رتبه‌بندی بر اساس زمان اولین کد درست، اسکور `1000 + 150×(n−rank) + 5×correct − 2×wrong`، نوشتن `rank/score` در `match_players` و XP/برد در `users`.
- **اعلام:** پیام نتیجه در گروه + بروزرسانی کارت + end-screen داخل `game_state.finished` که `snapshotWithEnd` به همه‌ی بازیکن‌های polling می‌رساند.
- **`/finish` (ادمین، گروه):** پایان فوری مچ running با همان مسیر conclude (نتیجه = فرار ناموفق). مناسب تست و موقعی که تیم گیر کرده.

## 🏅 لقب‌ها

| XP | لقب |
|---|---|
| ۰ تا ۱۰۰ | تازه‌وارد |
| ۱۰۱ تا ۵۰۰ | کاوشگر |
| ۵۰۱ تا ۲۰۰۰ | استاد قفل |
| بالاتر از ۲۰۰۰ | افسانه فرار |

## ⚠️ نکات پلتفرم

- **بدون Foreign Key:** `.references()` پشتیبانی نمی‌شود؛ یکپارچگی داده در کد اپلیکیشن تضمین می‌شود.
- **بدون npm / filesystem** در runtime؛ فقط `sdk` و ماژول‌های خود پروژه.
- ایمپورت‌های نسبی **حتماً با پسوند `.js`** باشند.
- تمام فراخوانی‌های دیتابیس async هستند و باید `await` شوند.
- حذف ستون/جدول فقط با `.deprecated('reason')` انجام می‌شود، نه با پاک کردن تعریف.
- `deploy` هرگز دیتابیس را تغییر نمی‌دهد؛ بعد از تغییر `schema.js` حتماً `migrate` بزنید.

## 🗺 نقشه‌ی راه

- [x] موتور بازی (`engine` + `rules` + `game`) و endpointها (`getGame`, `act`, `submitCode`)
- [x] Mini App استاتیک + فعال‌سازی `static` در `tgcloud.jsonc`
- [x] چرخه‌ی پایان بازی: تایمر lazy، keypad قفل خروج، `/finish`
- [x] ثبت نتیجه‌ی مچ: `rank`، `score`، XP، `matchesPlayed` و `matchesWon`
- [ ] تکمیل پک بیمارستان: فایل `hospital.js` (لابی تعاملی + variants معتبر) و اتاق‌های دیگر (سردخانه، داروخانه، آرشیو…)
- [ ] تصاویر/صداها زیر `public/pack1/…` (فعلاً بخشی از assetها ساخته نشده)
- [ ] تصویر/thumbnail برای پک‌ها
- [ ] بالانس زمان/رقم‌ها بعد از تست end-to-end با گروه واقعی

## 📚 مراجع

- [AGENTS.md](AGENTS.md) — قواعد پروژه و پلتفرم
- [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md) — مرجع کامل SDK (db، Bot API، fetch)