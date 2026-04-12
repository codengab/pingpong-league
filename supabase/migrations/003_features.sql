-- ============================================================
-- MIGRATION 003 - New Features
-- Run after 001 and 002
-- ============================================================

-- ── Activity Log ─────────────────────────────────────────────
create table if not exists activity_log (
  id          serial primary key,
  admin_email text not null,
  action      text not null,  -- 'input_skor', 'edit_skor', 'hapus_match', 'generate_jadwal', 'ubah_jadwal', 'tambah_pemain', 'nonaktif_pemain'
  detail      jsonb,          -- data sebelum/sesudah perubahan
  sesi_id     integer references master_sesi(id),
  created_at  timestamptz default now()
);

create index if not exists idx_log_created on activity_log(created_at desc);
create index if not exists idx_log_admin   on activity_log(admin_email);

-- RLS
alter table activity_log enable row level security;
create policy "admin_read_log"   on activity_log for select using (is_admin());
create policy "admin_insert_log" on activity_log for insert with check (is_admin());

-- ── Allow update & delete on match (for edit/delete feature) ─
-- Policies sudah ada di 001 (admin_update_match, admin_delete_match)
-- Pastikan match punya kolom updated_by untuk audit
alter table match add column if not exists updated_by text;

-- ── Master pemain: allow full CRUD for admins ─────────────────
-- Policy sudah ada di 001 (admin_manage_pemain)
-- Tambah email kolom untuk link ke user auth jika dibutuhkan
alter table master_pemain add column if not exists email text;
