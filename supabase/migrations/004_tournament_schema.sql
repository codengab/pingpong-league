-- ============================================================
-- MIGRATION 004 - MODUL TURNAMEN (Fase Grup + Babak Gugur)
-- Prefix "tournament_" agar tidak tercampur dengan tabel liga
-- reguler (master_sesi, master_pemain, match, dst).
--
-- Jalankan SETELAH 001_schema.sql (butuh fungsi is_admin() &
-- function update_updated_at() yang sudah dibuat di sana).
-- ============================================================

-- ============================================================
-- TABLE: tournament_event
-- Satu baris = satu penyelenggaraan turnamen (bisa dipakai
-- berulang tiap tahun, mis. "Turnamen 2026 Q1", "Turnamen 2026 Q2").
-- ============================================================
create table if not exists tournament_event (
  id          serial primary key,
  nama        text not null,               -- "Turnamen Tahunan NIC 2026"
  tahun       integer not null,
  tgl_mulai   date,
  tgl_selesai date,
  status      text not null default 'DRAFT' check (status in ('DRAFT','AKTIF','SELESAI')),
  keterangan  text,
  created_at  timestamptz default now()
);

-- ============================================================
-- TABLE: tournament_grup
-- Grup pada fase grup, milik satu event tertentu.
-- ============================================================
create table if not exists tournament_grup (
  id         serial primary key,
  event_id   integer not null references tournament_event(id) on delete cascade,
  nama       text not null,                -- "Grup A"
  created_at timestamptz default now(),
  unique (event_id, nama)
);

-- ============================================================
-- TABLE: tournament_pemain
-- Peserta turnamen. Terikat ke satu event (tidak otomatis
-- terhubung ke master_pemain liga reguler — nama boleh sama).
-- ============================================================
create table if not exists tournament_pemain (
  id         serial primary key,
  event_id   integer not null references tournament_event(id) on delete cascade,
  grup_id    integer references tournament_grup(id) on delete set null,
  nama       text not null,
  status     text not null default 'AKTIF' check (status in ('AKTIF','NON-AKTIF')),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: tournament_match
-- fase: 'GRUP' | 'GUGUR'
-- ronde (khusus GUGUR): 'Babak 16 Besar' | 'Perempat Final' | 'Semi Final' | 'Final'
-- set_skor: jsonb array skor tiap set, mis:
--   [{"p1":11,"p2":7},{"p1":9,"p2":11},{"p1":11,"p2":8}]
-- (dipakai jsonb -bukan kolom s1..s5 seperti tabel "match" liga-
--  karena jumlah set per match turnamen bisa fleksibel best-of-N)
-- ============================================================
create table if not exists tournament_match (
  id             serial primary key,
  event_id       integer not null references tournament_event(id) on delete cascade,
  fase           text not null check (fase in ('GRUP','GUGUR')),
  grup_id        integer references tournament_grup(id) on delete set null,
  ronde          text,
  urutan_bracket integer default 0,
  pemain1_id     integer references tournament_pemain(id) on delete set null,
  pemain2_id     integer references tournament_pemain(id) on delete set null,
  set_skor       jsonb not null default '[]'::jsonb,
  status         text not null default 'TERJADWAL' check (status in ('TERJADWAL','SELESAI')),
  pemenang_id    integer references tournament_pemain(id) on delete set null,
  tanggal        timestamptz,
  tempat         text,
  updated_by     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- TABLE: tournament_activity_log
-- Log aksi admin khusus modul turnamen (terpisah dari activity_log liga)
-- ============================================================
create table if not exists tournament_activity_log (
  id          serial primary key,
  admin_email text not null,
  action      text not null,   -- 'tambah_grup','tambah_pemain','input_skor','edit_skor','hapus_match', dst
  detail      jsonb,
  event_id    integer references tournament_event(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_t_grup_event      on tournament_grup(event_id);
create index if not exists idx_t_pemain_event     on tournament_pemain(event_id);
create index if not exists idx_t_pemain_grup      on tournament_pemain(grup_id);
create index if not exists idx_t_match_event      on tournament_match(event_id);
create index if not exists idx_t_match_grup       on tournament_match(grup_id);
create index if not exists idx_t_match_fase       on tournament_match(fase);
create index if not exists idx_t_log_event        on tournament_activity_log(event_id);

-- ============================================================
-- TRIGGER updated_at (reuse function update_updated_at() dari 001_schema.sql)
-- ============================================================
create trigger tournament_match_updated_at
  before update on tournament_match
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- Publik: hanya SELECT. Admin (reuse is_admin() dari 001_schema.sql): full akses.
-- ============================================================
alter table tournament_event         enable row level security;
alter table tournament_grup          enable row level security;
alter table tournament_pemain        enable row level security;
alter table tournament_match         enable row level security;
alter table tournament_activity_log  enable row level security;

create policy "public_read_tournament_event"  on tournament_event  for select using (true);
create policy "public_read_tournament_grup"   on tournament_grup   for select using (true);
create policy "public_read_tournament_pemain" on tournament_pemain for select using (true);
create policy "public_read_tournament_match"  on tournament_match  for select using (true);

create policy "admin_manage_tournament_event"  on tournament_event  for all using (is_admin()) with check (is_admin());
create policy "admin_manage_tournament_grup"   on tournament_grup   for all using (is_admin()) with check (is_admin());
create policy "admin_manage_tournament_pemain" on tournament_pemain for all using (is_admin()) with check (is_admin());
create policy "admin_manage_tournament_match"  on tournament_match  for all using (is_admin()) with check (is_admin());

create policy "admin_read_tournament_log"   on tournament_activity_log for select using (is_admin());
create policy "admin_insert_tournament_log" on tournament_activity_log for insert with check (is_admin());

-- ============================================================
-- CONTOH: membuat event turnamen baru (dijalankan admin dari UI,
-- ditinggalkan di sini sebagai referensi manual jika perlu lewat SQL)
-- ============================================================
-- insert into tournament_event (nama, tahun, status) values ('Turnamen 2026 Q1', 2026, 'DRAFT');
