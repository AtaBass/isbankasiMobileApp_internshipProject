# İş Bankası Genç — Mobil Bankacılık (FinTech)

Gençlere yönelik, İş Bankası lacivert (#003399) temalı mobil bankacılık uygulaması.  
**Frontend:** React Native (Expo) • **Backend:** Node.js (Express) • **Veritabanı:** PostgreSQL.

## Özellikler

- **Ana Sayfa:** Bakiye, son işlemler, aktif hedef özeti, günün tavsiyesi, puan/seri.
- **Hedefler:** Otomatik dağıtım (Automatic Splitter), hedef CRUD.
- **Sosyal:** Ortak kumbara, harcama grupları, Splitwise tarzı borç takibi.
- **Reels & Görevler:** Finansal okuryazarlık videoları (Reels), izleyince puan; görevler (Task) ile ek puan; Streak; Ödüller (cashback, sinema, konser).

## Kurulum

### 1. PostgreSQL

Veritabanını oluşturun:

```bash
createdb isb_bank
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# .env içinde DATABASE_URL ve JWT_SECRET düzenleyin
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

API: `http://localhost:4000`

### 3. Mobil (Expo)

```bash
cd mobile
npm install
```

`mobile/lib/api.js` içinde `API_BASE` adresini kullanacağınız ortama göre ayarlayın (ör. Android emulator için `http://10.0.2.2:4000/api`).

```bash
npx expo start
```

Ardından iOS/Android emulator veya cihazda açın.

### Demo hesap (seed sonrası)

- **E-posta:** demo@isb.com  
- **Şifre:** demo123  

## Proje yapısı

```
IsB/
├── backend/
│   ├── src/
│   │   ├── db/          # schema, pool, migrate, seed
│   │   ├── middleware/  # auth, error
│   │   └── routes/      # auth, goals, social, transactions, reels, tasks, rewards, dashboard
│   └── package.json
├── mobile/
│   ├── app/
│   │   ├── _layout.js   # root layout, auth yönlendirme
│   │   ├── index.js     # giriş / kayıt
│   │   └── (tabs)/      # Ana Sayfa, Hedefler, Sosyal, Reels & Görevler
│   ├── constants/theme.js
│   └── lib/api.js
└── README.md
```

## API özeti

| Bölüm        | Örnek uç noktalar |
|-------------|-------------------|
| Auth        | `POST /api/auth/login`, `POST /api/auth/register` |
| Dashboard   | `GET /api/dashboard` |
| Goals       | `GET/POST /api/goals`, `GET/POST /api/goals/splits` |
| Social      | `GET/POST /api/social/groups`, `POST /api/social/groups/:id/expenses`, `GET /api/social/groups/:id/debts` |
| Transactions| `GET /api/transactions`, `POST /api/transactions/income`, `POST /api/transactions/expense` |
| Reels       | `GET /api/reels`, `POST /api/reels/:id/watch` |
| Tasks       | `GET /api/tasks`, `POST /api/tasks/:id/complete` |
| Rewards     | `GET /api/rewards`, `GET /api/rewards/my-points`, `POST /api/rewards/redeem` |

Tüm ilgili route’lar (reels listesi hariç) JWT ile korunur; isteklerde `Authorization: Bearer <token>` gönderin.
