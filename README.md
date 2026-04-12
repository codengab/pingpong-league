# Liga Pingpong NIC — Setup Guide

## Tech Stack

| Layer    | Tech                    | Peran                          |
|----------|-------------------------|--------------------------------|
| Frontend | HTML + Vanilla JS (ESM) | UI, logika render              |
| Styles   | Tailwind CSS v3 (npm)   | Utility-first CSS              |
| Icons    | Font Awesome 6.5        | Icons (offline setelah setup)  |
| Database | Supabase PostgreSQL      | Data match, sesi, pemain       |
| Auth     | Supabase Email+Password  | Login admin                    |
| Hosting  | Cloudflare Pages        | Static hosting gratis          |

---

## Setup Pertama Kali

### 1. Clone & Install

```bash
git clone <repo-url>
cd pingpong

# Setup otomatis: install npm deps + download Font Awesome
chmod +x setup.sh && ./setup.sh
```

Script ini akan:
- Install semua npm packages: `vite`, `tailwindcss`, `@supabase/supabase-js`
- Buat file `.env` dari template
- Download Font Awesome 6.5 ke `public/assets/fontawesome/` (offline)

### 2. Setup Supabase

1. Buat project di https://supabase.com
2. Buka **SQL Editor**, jalankan berurutan:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_seed.sql`
   - `supabase/migrations/003_features.sql`
3. Tambah admin pertama:
   ```sql
   insert into admin_list (email) values ('kamu@email.com');
   ```
4. Di **Authentication > Settings**: matikan "Confirm email" (opsional, untuk langsung bisa login)

### 3. Konfigurasi Environment

Edit `.env` di root project (dibuat otomatis oleh setup.sh):
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```
Nilai ini diambil dari **Supabase Dashboard → Project Settings → API**.

### 4. Jalankan

```bash
# Development — Vite dev server dengan HMR (Hot Module Replacement)
# CSS, JS, imports semua otomatis dihandle
npm run dev
# Buka http://localhost:3000 (otomatis terbuka di browser)
```

---

## Development Workflow

```
index.html  ──────────────────────────────────────────────────────┐
src/main.js  ─[Vite bundles]──► dev server (localhost:3000)        │
src/input.css ─[Tailwind via PostCSS]──► CSS terinject otomatis   │
@supabase/supabase-js ─[npm]──► di-import langsung via Vite       ┘
```

**Cara kerja:**
- `npm run dev` → Vite start dev server, watch semua file
- Edit HTML/JS/CSS → browser langsung update tanpa refresh (HMR)
- Supabase client dari npm, tidak perlu CDN
- Tailwind diproses via PostCSS, scan semua file untuk class yang dipakai

**Tambah class dinamis di JS?** → tambahkan ke `safelist` di `tailwind.config.js`

**Build untuk production:**
```bash
npm run build   # output ke dist/
npm run preview # preview hasil build
```

---

## Struktur File

```
pingpong/
├── index.html                      ← Entry point + semua UI
├── src/
│   ├── input.css                   ← Source Tailwind (edit ini)
│   ├── lib/
│   │   ├── supabase.js             ← Supabase client
│   │   ├── appState.js             ← Global state
│   │   ├── klasemenCalculator.js   ← Kalkulasi klasemen (pure)
│   │   └── scheduleGenerator.js   ← Generate round robin (pure)
│   ├── services/
│   │   ├── authService.js          ← Login/logout/isAdmin
│   │   ├── matchService.js         ← CRUD pertandingan + realtime
│   │   ├── sesiService.js          ← Sesi, pemain, hari libur
│   │   ├── pemainService.js        ← CRUD master pemain
│   │   └── logService.js           ← Activity log
│   ├── components/
│   │    └── renderer.js            ← Pure render functions
│   └── utils/
│       └── date.js                 ← Helper tanggal
│  
├── public/
│   ├── assets/
│   │   ├── tailwind.css            ← Generated (jangan edit manual!)
│   │   └── fontawesome/            ← Downloaded oleh setup.sh
│   ├── _worker.js                  ← Cloudflare Worker (inject env)
│   └── env.js                      ← Template (jangan commit!)
├── supabase/
│   └── migrations/
│       ├── 001_schema.sql          ← Tabel + RLS
│       ├── 002_seed.sql            ← Data awal
│       └── 003_features.sql        ← Activity log, kolom baru
├── tailwind.config.js              ← Konfigurasi Tailwind
├── package.json                    ← npm scripts
├── setup.sh                        ← Setup otomatis
└── env.js                          ← Kredensial Supabase (JANGAN commit!)
```

---

## Deploy ke Cloudflare Pages

1. Push ke GitHub (pastikan `env.js` dan `node_modules/` ada di `.gitignore`)
2. Di Cloudflare Pages > Settings > Build:
   - **Build command**: `npm run build`
   - **Output directory**: `/` (root)
3. Di **Environment Variables** tambahkan:
   ```
   SUPABASE_URL      = https://xxxxx.supabase.co
   SUPABASE_ANON_KEY = eyJ...
   ```
4. `public/_worker.js` otomatis inject env vars ke `/env.js` saat runtime

---

## Fitur

| Fitur | Keterangan |
|-------|-----------|
| Klasemen | Auto-kalkulasi poin, rasio set, rasio skor, form 5 match terakhir |
| Jadwal | Grouped by date, admin bisa ubah/hapus |
| Hasil | Grouped by date, admin bisa edit/hapus skor |
| Podium | Top 3 + statistik liga (most set win, most WO, dll) |
| Live Update | Realtime via Supabase — klasemen update tanpa refresh |
| Dark Mode | Toggle, disimpan ke localStorage |
| Detail Pemain | Stats, H2H, riwayat, jadwal, winrate per set |
| Generate Jadwal | Round robin otomatis (single/home&away), distribusi merata |
| Input Skor | Form dengan WO support |
| Edit Skor | Koreksi skor yang sudah terinput |
| Ubah Jadwal | Ubah tanggal/pemain jadwal pending |
| Manajemen Pemain | Tambah/edit/aktif/nonaktif pemain |
| Log Aktivitas | Semua aksi admin tercatat (siapa, kapan, apa) |
| Register Admin | Admin bisa daftarkan admin baru dari UI |

