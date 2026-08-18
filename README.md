# 🍽 Restoran — Oldindan Buyurtma Tizimi

Talabalar darslari tugashidan **oldin** ovqat buyurtma qiladi, buyurtma **darhol** restoran egasining Telegram'iga boradi, egasi esa buyurtmani Telegram tugmalari yoki admin panel orqali boshqaradi.

## 📦 Texnologik stack

| Qatlam | Texnologiya |
|---|---|
| Backend | **NestJS 11** (TypeScript), Express |
| Ma'lumotlar bazasi | **PostgreSQL 16** + **Prisma ORM** |
| Navbat (background jobs) | **BullMQ** + **Redis** |
| Telegram bot | **grammY** (webhook / long-polling) |
| Auth | **JWT** (admin uchun) |
| Real-vaqt | **Socket.io** (admin panel) |
| Frontend | **Next.js 16** (App Router), TypeScript, TailwindCSS, TanStack Query |
| PWA | manifest + icon (Home Screen'ga qo'shish) |
| Logging | Pino (strukturaviy JSON loglar) |
| Deploy | Docker + Docker Compose |

## 🚀 Tezkor boshlash — lokal (Docker'siz, SQLite)

Hech narsa o'rnatish shart emas (PostgreSQL/Redis kerak emas):

```bash
# 1) Backend — ma'lumotlar bazasi + menyu (backend/.env allaqachon yaratilgan)
cd backend
npm install
npm run db:dev          # SQLite client + prisma/dev.db + namunaviy menyu
npm run start:dev       # http://localhost:3001

# 2) Frontend (boshqa terminalda)
cd frontend
npm install
npm run dev             # http://localhost:3000
```

- 🖥 Mijoz menyusi: **http://localhost:3000**
- 📋 Admin panel: **http://localhost:3000/admin** (login: `admin` / `admin123`)
- 🔌 Backend API: **http://localhost:3001**

> Izoh: lokal rejimda `backend/.env` da `QUEUE_BACKEND=memory` va `DATABASE_URL=file:./dev.db` (SQLite) ishlatiladi. `npm run db:dev` — SQLite sxemasini yaratib, namunaviy menyuni yuklaydi.

## 🐳 Production (Docker — PostgreSQL + Redis)

```bash
# 1) Backend muhit faylini yarating
cp backend/.env.example backend/.env
#   → .env ichida TELEGRAM_BOT_TOKEN va TELEGRAM_ADMIN_CHAT_ID ni to'ldiring

# 2) Hamma narsani ishga tushiring
docker compose up --build
```

- 🖥 Frontend: **http://localhost:3000**
- 📋 Admin panel: **http://localhost:3000/admin**
- 🔌 Backend API: **http://localhost:3001**
- Admin login/parol: `backend/.env` dagi `ADMIN_USERNAME` / `ADMIN_PASSWORD` (default: `admin` / `change-me-strong-password`)

Backend birinchi marta ishga tushganda DB sxemasini yaratadi (`prisma db push`) va namunaviy menyuni yuklaydi (`prisma:seed`).

## 🛠 Qo'lda ishga tushirish (haqiqiy PostgreSQL bilan)

Talab: Node.js 20+, PostgreSQL 16, Redis 7. SQLite bilan sinash uchun yuqoridagi "lokal" bo'limdan foydalaning.

```bash
# Backend
cd backend
cp .env.example .env          # sozlamalarni to'ldiring (DATABASE_URL → PostgreSQL)
npm install
npx prisma generate
npx prisma db push            # DB sxemasini yaratish
npm run prisma:seed           # namunaviy menyu
npm run start:dev             # http://localhost:3001

# Frontend (boshqa terminalda)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

> 💡 Redis'siz tez sinov: `backend/.env` da `QUEUE_BACKEND=memory` qilib qo'ying — Telegram xabari navbat o'rniga to'g'ridan-to'g'ri yuboriladi. Production'da `redis` qoldiring.

## 🤖 Telegram botni sozlash

1. [@BotFather](https://t.me/BotFather) ga yozing → `/newbot` → bot nomi va username bering → **token** oling.
2. Restoran egasining chat ID sini toping: [@userinfobot](https://t.me/userinfobot) ga xabar yuboring → `Id` qiymati.
3. `backend/.env` faylga yozing:

```env
TELEGRAM_BOT_TOKEN=123456789:AAF...your_token
TELEGRAM_ADMIN_CHAT_ID=123456789
```

4. Rejimni tanlang:
   - **Development** (long-polling): `TELEGRAM_POLLING=true` (webhook shart emas)
   - **Production** (webhook, HTTPS domen talab qilinadi):
     ```env
     TELEGRAM_POLLING=false
     TELEGRAM_WEBHOOK_URL=https://api.example.com/api/telegram/webhook
     ```

Yangi buyurtma tushganda egasiga quyidagi xabar boradi (inline tugmalar bilan — bosish orqali holat o'zgaradi, DB va admin panel real-vaqtda yangilanadi):

```
🆕 YANGI BUYURTMA #1024

👤 Mijoz: Aziza Karimova
📞 Tel: +998 90 123 45 67

🍽 Taomlar:
- Osh (2 porsiya) — 60,000 so'm
- Lag'mon (1 porsiya) — 25,000 so'm

💰 Jami: 85,000 so'm
⏰ Qachon tayyor bo'lishi kerak: 13:30
🕐 Buyurtma tushgan vaqt: 12:47:03

[✅ Qabul qilish]  [❌ Bekor qilish]
```

Holatlar zanjiri: `Kutilmoqda → Tayyorlanmoqda → Tayyor → Yakunlandi` (istalgan bosqichdan bekor qilish mumkin).

## 📚 API endpointlar

| Method | Endpoint | Tavsif | Himoya |
|---|---|---|---|
| `GET` | `/api/menu` | Menyuni olish (mavjud taomlar) | ochiq |
| `POST` | `/api/orders` | Yangi buyurtma yaratish + Telegramga xabar | ochiq, **1 ta / 5 daqiqa / IP** |
| `GET` | `/api/orders/:id` | Buyurtma holatini tekshirish | ochiq |
| `PATCH` | `/api/orders/:id/status` | Holatni o'zgartirish | JWT (admin) |
| `POST` | `/api/telegram/webhook` | Telegram inline tugma bosilishi | ochiq (bot) |
| `POST` | `/api/admin/login` | Admin login → JWT | ochiq |
| `GET` | `/api/admin/stats` | Kunlik/haftalik statistika, eng ko'p buyurtma qilingan taomlar | JWT |
| `GET` | `/api/admin/orders` | Buyurtmalar ro'yxati (holat/sana/qidiruv filtrlari) | JWT |
| `POST` `/PATCH` `/DELETE` | `/api/admin/menu-items[/:id]` | Menyu boshqaruvi | JWT |
| `GET` | `/api/health` | Sog'liqni tekshirish | ochiq |

**Buyurtma yaratish misoli:**

```json
POST /api/orders
{
  "customer": { "name": "Aziza Karimova", "phone": "+998 90 123 45 67", "telegramUsername": "aziza_k" },
  "requiredTime": "13:30",
  "items": [
    { "menuItemId": 1, "quantity": 2 },
    { "menuItemId": 2, "quantity": 1 }
  ]
}
```

## ✨ Asosiy funksiyalar

**Mijoz uchun:**
- Menyu (kategoriyalar bo'yicha), savat, mobil-first buyurtma formasi
- Buyurtma holatini kuzatish sahifasi (`/orders/[id]`, 5 soniyada yangilanadi)
- PWA — Home Screen'ga qo'shish mumkin

**Restoran egasi uchun (admin panel `/admin`):**
- **📊 Dashboard**: bosiladigan KPI kartalar (Bugun/Keclgi tushum, Kutilayotgan, Tayyorlanayotgan, Tayyor, Yakunlangan, Bekor qilingan) + analytics (7/30 kun, AOV, bekor darajasi, eng band vaqtlar, eng ko'p sotilgan/daromad keltirgan taomlar)
- **📦 Buyurtmalar**: debounce qidiruv (#raqam/ism/telefon/taom), holat/sana(hozirgi/kecha/7/30 kun/maxsus)/summa/vaqt filterlari, sort (yangi/eski/summa/vaqt), pagination (20/50/100), **bulk actions** (yakunlash/bekor qilish/o'chirish), **CSV export**
- **Buyurtma detali**: bosilganda drawer — to'liq ma'lumot, **holat tarixi timeline**, Telegram holati, **bekor qilish sababi**, **🖨 print receipt**, o'chirish
- **⚠️ Kechikkan buyurtmalar** avtomatik belgilanadi (kerakli vaqt o'tib ketganlar)
- **🗑 O'chirilganlar arxivi**: soft delete + restore + permanent delete (qo'shimcha confirmation bilan)
- **Real-vaqt**: yangi buyurtma → ovoz + toast + brauzer bildirishnomasi (🔔 tugma), realtime ulanish indikatori 🟢/🔴, `⌨ /` — qidiruvga fokus
- **🍽 Menyu boshqaruvi**: taom qo'shish/tahrirlash/o'chirish, mavjudlikni yoqish-o'chirish

**Telegram (production darajasida):**
- Yangi buyurtma darhol egasiga boradi (inline tugmalar bilan) — **BullMQ navbati + retry**, yuborilish holati (PENDING/SENT/FAILED) order'da kuzatiladi
- **Holat o'zgarishi Telegram xabarida ham aks etadi** — admin panelda holat o'zgartirsangiz, Telegram'dagi xabar tahrirlanadi
- **Xavfsizlik**: faqat ruxsat etilgan admin chat ID si holat o'zgartira oladi (callback tamper himoyasi)

## 🛡 Xavfsizlik va mustahkamlik

- **Audit log** (`AuditLog`): status o'zgarishi, o'chirish, restore, permanent delete, mahsulot o'zgarishlari — admin, action, entity, qiymatlar, IP bilan
- **Soft delete** + **permanent delete** (faqat tasdiqlangan admin, confirmation talab)
- **Idempotency**: `Idempotency-Key` header — takroriy submit 1 ta buyurtra yaratadi
- **Rate limiting**: POST /orders (1/5 daqiqa/IP), login (10/daqiqa/IP), global 100/daqiqa
- **Holat tarixi** (`OrderStatusHistory`): har bir o'zgarish saqlanadi, bekor sababi bilan
- **Telegram callback xavfsizligi**: faqat `TELEGRAM_ADMIN_CHAT_ID` dagi foydalanuvchi holat o'zgartira oladi
- Transaction'lar (buyurtma + taomlar + tarix birga), indekslar, N+1 dan xoli query'lar

## 📂 Loyiha tuzilishi

```
├── backend/                      # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma         # DB sxemasi (customers, menu_items, orders, order_items)
│   │   └── seed.ts               # Namunaviy menyu
│   └── src/
│       ├── main.ts               # Bootstrap: raw webhook, helmet, CORS, validation
│       ├── app.module.ts         # Config, pino, throttler, modullar
│       ├── auth/                 # JWT login + guard
│       ├── menu/                 # GET /api/menu
│       ├── orders/               # Buyurtma yaratish/holat (transaction, socket, queue)
│       ├── telegram/             # grammY bot, format, BullMQ queue, webhook
│       ├── admin/                # Statistika, buyurtmalar ro'yxati, menyu CRUD
│       ├── gateway/              # Socket.io (order.created / order.updated)
│       └── common/               # Serializatsiya yordamchilari
│
├── frontend/                     # Next.js (App Router)
│   ├── app/
│   │   ├── page.tsx              # Mijoz: menyu + savat + buyurtma formasi (mobil-first)
│   │   ├── orders/[id]/          # Buyurtma holatini kuzatish (5s poll)
│   │   ├── admin/                # Login + boshqaruv paneli (socket real-vaqt)
│   │   └── manifest.ts           # PWA manifest
│   ├── components/
│   │   ├── menu/                 # Menyu, savat, forma, muvaffaqiyat ekrani
│   │   └── admin/                # StatsCards, OrdersTable, StatusBadge, WeeklyChart
│   └── lib/                      # API client, socket, types
│
├── docker-compose.yml            # Postgres + Redis + backend + frontend
└── README.md
```

## 🔒 Xavfsizlik

- Barcha admin endpointlar **JWT** bilan himoyalangan (`/api/admin/*`, `PATCH /api/orders/:id/status`).
- Rate limiting: global `100 so'rov/daqiqa/IP` + buyurtma yaratishda **1 ta / 5 daqiqa / IP** (Throttler).
- Input validatsiya: `class-validator` + global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`).
- CORS faqat ruxsat etilgan origin'larga ochiq (`CORS_ORIGINS`).
- `helmet` — HTTP header xavfsizligi.
- Telegram token/chat ID **faqat** `.env` da — `.gitignore`ga kiritilgan, kodda hardcode yo'q.
- Login parollar doimiy-vaqt taqqoslash bilan tekshiriladi.
- Holat o'tishlari qat'iy zanjir bilan cheklangan (masalan, `Kutilmoqda → Tayyor` bo'lishi mumkin emas).

## ⚡ Non-funksional talablar

- **Telegram xabari background job'da** (BullMQ + Redis Worker) — API javobi bloklanmaydi, `< 300ms`.
- Xatoliklar **strukturaviy JSON log** formatida (Pino): `npm run start:dev` da konsolda, production'da stdout.
- Har bir buyurtma **Prisma transaction**'ida yaratiladi (buyurtma + taomlar birga saqlanadi).
- Telegram xabari 3 marta qayta urinish bilan yuboriladi (exponential backoff).
- Docker orqali to'liq deploy (Postgres, Redis, backend, frontend).

## 🧪 Testlar

```bash
cd backend
npm test          # 20 ta unit test: Telegram format (spec bo'yicha), buyurtma servisi, auth
```

## 🗄 Ma'lumotlar bazasi (qisqacha)

- **customers** — ism, telefon (unique), telegram username
- **menu_items** — nomi, tavsifi, narxi, rasm, kategoriya, mavjudligi
- **orders** — mijoz, jami summa, kerakli vaqt (`HH:MM`), holat, `created_at` (buyurtma tushgan aniq vaqt), `telegram_message_id`
- **order_items** — taom, miqdor, narx **snapshot'i** (menyu narxi o'zgarsa ham buyurtma narxi o'zgarmaydi)

## 🖥 Frontend'ni production rejimda ishga tushirish

`next.config.ts` da `output: "standalone"` yoqilgan — production server quyidagicha ishga tushadi:

```bash
cd frontend
npm run build
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/public && cp -r public/. .next/standalone/public/
node .next/standalone/server.js   # http://localhost:3000
```

> `next start` standalone build bilan ishlamaydi — yuqoridagi usuldan foydalaning.

## 🌍 Production uchun eslatmalar

- Webhook rejimini yoqing (`TELEGRAM_WEBHOOK_URL` — HTTPS domen kerak).
- `JWT_SECRET`, `ADMIN_PASSWORD` ni kuchli qiymatlarga almashtiring.
- `QUEUE_BACKEND=redis` (default) qoldiring.
- Frontend'da `NEXT_PUBLIC_API_URL` ni backend domainiga o'rnating.
