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

## 🏆 Modul Turnamen (Fase Grup + Babak Gugur)

Selain liga reguler ("Sesi"), aplikasi ini punya **modul terpisah** untuk turnamen tahunan
(fase grup + babak gugur, seperti format Piala Dunia), diakses di **`/tournament/`**.

### Kenapa terpisah dari liga reguler?
- Liga reguler jalan 4x setahun lewat sistem **Sesi** (`master_sesi`, tabel `match`).
- Turnamen adalah event berbeda (format grup+gugur, bukan round robin murni), jadi dipisah
  ke tabel sendiri dengan prefix **`tournament_`** supaya datanya tidak tercampur dengan liga.
- Admin yang sama (dari `admin_list`) otomatis bisa login & kelola kedua-duanya — tidak perlu akun terpisah.

### Setup tambahan
1. Setelah menjalankan `001_schema.sql`, `002_seed.sql`, `003_features.sql`, jalankan juga:
   ```
   supabase/migrations/004_tournament_schema.sql
   ```
   di Supabase SQL Editor. Ini membuat tabel `tournament_event`, `tournament_grup`,
   `tournament_pemain`, `tournament_match`, `tournament_activity_log` — semuanya pakai RLS
   yang reuse fungsi `is_admin()` yang sudah ada.
2. Tidak perlu env/dependency tambahan — modul ini pakai Supabase client & auth yang sama
   (`src/lib/supabase.js`, `src/services/authService.js`).
3. `npm run dev` / `npm run build` otomatis meng-cover halaman turnamen juga, karena
   `vite.config.js` sudah dikonfigurasi **multi-page**:
   - `index.html` → halaman liga reguler (`/`)
   - `tournament/index.html` → halaman turnamen (`/tournament/`)
4. Link ke halaman turnamen sudah ditambahkan di header halaman utama (ikon 🏆 "Turnamen").

### Struktur file baru
```
tournament/
└── index.html                          ← entry point halaman turnamen (Vite multi-page)
src/tournament/
├── main.js                             ← tab switching, auth, event handlers
├── lib/
│   ├── klasemenCalculator.js           ← klasemen grup, tiebreaker, ranking runner-up, H2H
│   └── bracketHelper.js                ← urutan ronde bracket, format tanggal
├── services/
│   └── tournamentService.js            ← CRUD event/grup/pemain/match + realtime + log
└── components/
    └── renderer.js                     ← render klasemen, jadwal, bracket, H2H, admin
supabase/migrations/
└── 004_tournament_schema.sql           ← skema tabel tournament_* + RLS
```

### Soal hapus data (penting!)
- **Pemain tidak bisa di-hard-delete** dari UI — hanya bisa **dinonaktifkan** (tombol "Nonaktifkan"/"Aktifkan"
  di tab Kelola), persis seperti pola `master_pemain` di liga reguler. Ini disengaja: karena
  `tournament_match` menyimpan `pemain1_id`/`pemain2_id`, hard-delete akan membuat riwayat
  pertandingan yang sudah selesai kehilangan identitas pemainnya. Pemain non-aktif tetap
  muncul di klasemen & riwayat, tapi tidak lagi muncul di dropdown saat membuat jadwal baru.
- **Grup bisa dihapus**, tapi ada guard: kalau grup masih punya pemain atau pertandingan
  terkait, penghapusan akan ditolak dengan pesan jelas — pindahkan/nonaktifkan pemainnya
  dulu, atau hapus pertandingannya lewat tab Jadwal & Hasil, baru grup kosong bisa dihapus.
- **Pertandingan (match)** boleh di-hard-delete kapan saja (tidak ada data lain yang bergantung padanya).

### Cara pakai (dipakai berulang tiap tahun)
1. Login admin di `/tournament/` (akun sama dengan liga).
2. Tab **Kelola** → **Turnamen (musim)** → **+ Baru**: buat event baru, mis. "Turnamen 2027".
   Set status jadi **AKTIF** — event lama otomatis jadi arsip (biarkan statusnya **SELESAI**),
   datanya tetap tersimpan dan bisa dilihat lagi lewat dropdown musim di header.
3. Tab **Kelola** → tambah **Grup** (mis. Grup A, Grup B) lalu tambah **Pemain** ke tiap grup.
4. Tab **Jadwal & Hasil** → **+ Jadwal Grup**: buat jadwal round-robin antar pemain satu grup.
5. Setelah pertandingan main, klik **✏️ Skor** pada baris match untuk input skor per set
   (mis. 11-7, 9-11, 11-8). Poin menang = 3, kalah = 0 — dihitung otomatis.
6. Tab **Fase Grup** menampilkan klasemen tiap grup (tiebreaker: Poin → Selisih Set →
   Selisih Skor → Head-to-head) plus ranking **2 terbaik (runner-up)** lintas grup.
7. Setelah fase grup selesai, tab **Jadwal & Hasil** → **+ Jadwal Gugur**: buat pertandingan
   babak gugur (pilih ronde: 16 Besar/Perempat Final/Semi Final/Final), pilih dua pemain yang lolos.
8. Tab **Bracket** otomatis menampilkan bagan babak gugur lengkap dengan **skeleton 4 ronde**
   (16 Besar → Perempat Final → Semi Final → Final — kolom yang belum diisi tampil "TBD vs TBD"),
   **garis penghubung** antar ronde (asumsi urutan: slot ke-1&2 → slot ke-1 ronde berikutnya, dst,
   berdasarkan field "Urutan Bracket"), dan kolom **Perebutan Peringkat 3** terpisah di ujung
   (tanpa garis penghubung). Tanggal main ditampilkan di tiap kartu.
   - Boleh isi salah satu pemain saja saat bikin jadwal (lawannya "TBD") kalau belum tahu siapa
     yang lolos dari ronde sebelumnya — nanti diisi belakangan lewat tombol **✏️/Edit Pemain**.
   - Input Skor otomatis diblokir selama masih ada slot TBD di match itu.
   - Field "Urutan Bracket" sudah ada saran angka otomatis (angka berikutnya yang belum
     dipakai di ronde itu), tapi tetap bisa diedit manual.
9. Tab **Head to Head** kapan saja bisa dipakai untuk melihat rekap pertandingan dua pemain.
10. **Tahun depan**, tinggal ulangi dari langkah 2: buat event baru, isi grup & pemain baru —
    data turnamen tahun-tahun sebelumnya tetap aman sebagai arsip.

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

