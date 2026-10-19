# 🔐 Escape Room Bot

ربات بازی گروهی «اتاق فرار» برای تلگرام، ساخته‌شده روی پلتفرم **Telegram Serverless (tgcloud)**.
ادمین گروه یک مچ می‌سازد، بازیکن‌ها ثبت‌نام می‌کنند و بعد تیمی وارد اتاق‌ها می‌شوند تا معماها را حل کنند.

> **وضعیت پروژه:** پایه‌ی ربات (دستورات، ویزارد ساخت مچ، ثبت‌نام، پروفایل و رتبه‌بندی) آماده است.
> موتور بازی (`gameEngine`) و Mini App هنوز پیاده‌سازی نشده‌اند.

---

## ✨ امکانات

- ساخت مچ با ویزارد مرحله‌ای (انتخاب پک ← ظرفیت ← تأیید)
- کارت مچ پین‌شده در گروه با دکمه‌های ورود / خروج / شروع
- قفل (lock) روی عملیات هر مچ برای جلوگیری از race condition
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

> ⚠️ در **گروه‌ها** دستور باید با نام ربات بیاید: `/newmatch@your_bot`. در چت خصوصی نیازی نیست.
> «ادمین» یعنی creator/administrator گروه (از طریق `getChatMember` چک می‌شود؛ ادمین‌های anonymous هم پشتیبانی می‌شوند). فایل `ADMIN_IDS` یا config جداگانه‌ای وجود ندارد.

## 🧱 ساختار پروژه

```
tgcloud/
├── schema.js              # جدول‌ها: users, matches, match_players, fsm_sessions, locks
├── handlers/
│   ├── message.js         # پارس و اجرای دستورات
│   └── callback_query.js  # مسیریابی دکمه‌های اینلاین (nm:*, match:*, profile:*)
└── lib/
    ├── commands.js        # پیاده‌سازی دستورات + guard (group/admin)
    ├── wizard.js          # ویزارد /newmatch
    ├── matchActions.js    # join / leave / start (با lock)
    ├── cards.js           # ساخت، پین و بروزرسانی کارت مچ
    ├── matches.js         # دسترسی به جدول matches
    ├── players.js         # دسترسی به match_players
    ├── users.js           # کاربران، XP و لقب‌ها
    ├── capacity.js        # ظرفیت‌های مجاز و وضعیت پر/باز
    ├── fsm.js             # state ویزارد در DB (TTL پنج دقیقه)
    ├── lock.js            # قفل مبتنی بر DB
    ├── admin.js           # تشخیص ادمین
    ├── tg.js              # wrapperهای Bot API (send, editText, tryApi)
    ├── util.js            # escapeHtml, formatDate, rid, ...
    ├── packLoader.js      # اعتبارسنجی و لود پک‌ها
    ├── gameEngine.js      # ⚠️ placeholder — فاز بعدی
    └── packs/
        ├── index.js       # ثبت پک‌ها
        └── demo.js        # پک نمونه
docs/tgcloud-sdk.md        # مرجع SDK پلتفرم
AGENTS.md                  # راهنمای دستیارهای هوش مصنوعی/توسعه‌دهنده‌ها
tgcloud.jsonc              # تنظیمات پروژه (بخش static برای Mini App فعلاً غیرفعال)
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
open ──(پر شدن ظرفیت)──▶ full ──(شروع)──▶ running ──▶ finished
  │                         │
  └────────(/cancelmatch)───┴──▶ cancelled
```

- هر گروه در هر لحظه فقط **یک** مچ `open` یا `full` می‌تواند داشته باشد.
- ورود/خروج فقط تا زمانی که مچ `open` است ممکن است.
- شروع مچ هم از دکمه‌ی «▶️ شروع بازی» (فقط ادمین، وقتی `full`) و هم از `/forcematch` ممکن است.

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

- [ ] پیاده‌سازی `gameEngine.onMatchStart` (Mini App session، تایمر، موتور اتاق‌ها)
- [ ] Mini App و endpointها (`tgcloud/endpoints/`) + فعال‌سازی `static` در `tgcloud.jsonc`
- [ ] ثبت نتیجه‌ی مچ: `rank`، `score`، XP، `matchesPlayed` و `matchesWon`
- [ ] تصویر/thumbnail برای پک‌ها
- [ ] پاک‌سازی دوره‌ای ردیف‌های منقضی `fsm_sessions` و `locks`

## 📚 مراجع

- [AGENTS.md](AGENTS.md) — قواعد پروژه و پلتفرم
- [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md) — مرجع کامل SDK (db، Bot API، fetch)