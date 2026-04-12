-- ============================================================
-- SEED DATA - Run after 001_schema.sql
-- ============================================================

-- Sesi data
insert into master_sesi (id, nama, tgl_mulai, tgl_selesai, status, keterangan) values
  (1, 'Sesi 1', '2026-01-01', '2026-02-18', 'SELESAI', 'Jan - Feb 2026'),
  (2, 'Sesi 2', '2026-04-01', '2026-05-30', 'AKTIF',   'April - Mei 2026')
on conflict (id) do nothing;

-- Update sequence
select setval('master_sesi_id_seq', 2);

-- Pemain Sesi 2
insert into master_pemain (nama, sesi_id, status) values
  ('Faiq',   2, 'AKTIF'),
  ('Nur',    2, 'AKTIF'),
  ('Indra',  2, 'AKTIF'),
  ('Afri',   2, 'AKTIF'),
  ('Amri',   2, 'AKTIF'),
  ('Muha',   2, 'AKTIF'),
  ('Rony',   2, 'AKTIF'),
  ('Ikhsan', 2, 'AKTIF'),
  ('Dimas',  2, 'AKTIF'),
  ('Dwi',    2, 'AKTIF'),
  ('Eko',    2, 'AKTIF'),
  ('Riky',   2, 'AKTIF'),
  ('Alim',   2, 'AKTIF')
on conflict do nothing;

-- Hari Libur Nasional 2026
insert into master_libur (tanggal, keterangan) values
  ('2026-01-01', 'Tahun Baru 2026 Masehi'),
  ('2026-01-16', 'Isra Mikraj Nabi Muhammad SAW'),
  ('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'),
  ('2026-03-20', 'Hari Suci Nyepi & Idulfitri 1447 H'),
  ('2026-03-21', 'Hari Raya Idulfitri 1447 H'),
  ('2026-04-03', 'Wafat Yesus Kristus'),
  ('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)'),
  ('2026-05-01', 'Hari Buruh Internasional'),
  ('2026-05-14', 'Kenaikan Yesus Kristus'),
  ('2026-05-22', 'Hari Raya Waisak 2570 BE'),
  ('2026-05-27', 'Hari Raya Iduladha 1447 H'),
  ('2026-06-01', 'Hari Lahir Pancasila'),
  ('2026-06-16', 'Tahun Baru Islam 1448 H'),
  ('2026-08-17', 'Hari Kemerdekaan RI'),
  ('2026-08-25', 'Maulid Nabi Muhammad SAW'),
  ('2026-12-25', 'Hari Raya Natal')
on conflict (tanggal) do nothing;

-- NOTE: Daftarkan email admin pertama kali manual via Supabase Dashboard:
-- insert into admin_list (email) values ('admin@gmail.com');
-- insert into admin_list (email) values ('officer@gmail.com');
