-- ============================================================
-- PINGPONG LIGA NIC - DATABASE SCHEMA
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: master_sesi (Sesi / Season)
-- ============================================================
create table if not exists master_sesi (
  id          serial primary key,
  nama        text not null,
  tgl_mulai   date not null,
  tgl_selesai date not null,
  status      text not null default 'DRAFT' check (status in ('AKTIF','DRAFT','SELESAI')),
  keterangan  text,
  created_at  timestamptz default now()
);

-- ============================================================
-- TABLE: master_pemain (Players)
-- ============================================================
create table if not exists master_pemain (
  id         serial primary key,
  nama       text not null,
  sesi_id    integer references master_sesi(id) on delete cascade,
  status     text not null default 'AKTIF' check (status in ('AKTIF','NON-AKTIF')),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: master_libur (Public Holidays)
-- ============================================================
create table if not exists master_libur (
  id          serial primary key,
  tanggal     date not null unique,
  keterangan  text not null,
  created_at  timestamptz default now()
);

-- ============================================================
-- TABLE: match (Match Results & Schedule)
-- ============================================================
create table if not exists match (
  id          serial primary key,
  sesi_id     integer references master_sesi(id) on delete cascade,
  tanggal     timestamptz,
  pemain_1    text not null,
  pemain_2    text not null,
  s1          text default '',
  s2          text default '',
  s3          text default '',
  s4          text default '',
  s5          text default '',
  skor_akhir  text default '',
  pemenang    text default '',
  kalah       text default '',
  leg         text default 'Leg 1',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- TABLE: admin_list (Admin emails managed by super admin)
-- ============================================================
create table if not exists admin_list (
  id         serial primary key,
  email      text not null unique,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index if not exists idx_match_sesi_id    on match(sesi_id);
create index if not exists idx_match_pemain_1   on match(pemain_1);
create index if not exists idx_match_pemain_2   on match(pemain_2);
create index if not exists idx_match_skor_akhir on match(skor_akhir);
create index if not exists idx_pemain_sesi      on master_pemain(sesi_id);

-- ============================================================
-- AUTO-UPDATE updated_at trigger
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger match_updated_at
  before update on match
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table master_sesi   enable row level security;
alter table master_pemain enable row level security;
alter table master_libur  enable row level security;
alter table match         enable row level security;
alter table admin_list    enable row level security;

-- PUBLIC: Read-only for everyone (klasemen, jadwal, hasil are public)
create policy "public_read_sesi"    on master_sesi   for select using (true);
create policy "public_read_pemain"  on master_pemain for select using (true);
create policy "public_read_libur"   on master_libur  for select using (true);
create policy "public_read_match"   on match         for select using (true);

-- ADMIN: Write access only for authenticated admins
-- We use a helper function to check admin status
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from admin_list
    where email = auth.email()
  );
$$ language sql security definer;

create policy "admin_insert_match"  on match for insert with check (is_admin());
create policy "admin_update_match"  on match for update using (is_admin());
create policy "admin_delete_match"  on match for delete using (is_admin());
create policy "admin_manage_sesi"   on master_sesi   for all using (is_admin());
create policy "admin_manage_pemain" on master_pemain for all using (is_admin());
create policy "admin_manage_libur"  on master_libur  for all using (is_admin());
create policy "admin_read_adminlist" on admin_list   for select using (is_admin());
create policy "admin_manage_adminlist" on admin_list for all using (is_admin());
