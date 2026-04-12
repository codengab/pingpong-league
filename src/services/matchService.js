// src/services/matchService.js
// Single Responsibility: operasi CRUD pertandingan

import { supabase } from '../lib/supabase.js';

const TABLE = 'match';

export const matchService = {
  /**
   * Ambil semua pertandingan berdasarkan sesi
   */
  async getMatchesBySesi(sesiId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('sesi_id', sesiId)
      .order('tanggal', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Ambil jadwal (belum ada skor) berdasarkan sesi
   */
  async getJadwal(sesiId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('sesi_id', sesiId)
      .or('skor_akhir.is.null,skor_akhir.eq.')
      .order('tanggal', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Ambil hasil (sudah ada skor) berdasarkan sesi
   */
  async getHasil(sesiId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('sesi_id', sesiId)
      .not('skor_akhir', 'is', null)
      .neq('skor_akhir', '')
      .order('tanggal', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Ambil pending matches (belum ada skor) untuk dropdown input
   */
  async getPendingMatches(sesiId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, pemain_1, pemain_2')
      .eq('sesi_id', sesiId)
      .or('skor_akhir.is.null,skor_akhir.eq.')
      .order('tanggal', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Update hasil pertandingan (admin only - dilindungi RLS)
   */
  async updateMatch(matchId, payload) {
    const { tanggal, wo, s1, s2, s3, s4, s5 } = payload;

    // Tentukan skor akhir dan pemenang
    const woValue = (wo || '').trim().toUpperCase();
    let skor_akhir, pemenang, kalah, sets;

    if (['W-0', '0-W', 'W-W'].includes(woValue)) {
      // Ambil nama pemain dulu
      const { data: match } = await supabase
        .from(TABLE).select('pemain_1, pemain_2').eq('id', matchId).single();

      sets = { s1: '', s2: '', s3: '', s4: '', s5: '' };
      skor_akhir = woValue;

      if (woValue === 'W-0')        { pemenang = match.pemain_1; kalah = match.pemain_2; }
      else if (woValue === '0-W')   { pemenang = match.pemain_2; kalah = match.pemain_1; }
      else                          { pemenang = 'DOUBLE WO'; kalah = 'DOUBLE WO'; }

    } else {
      // Normal match — hitung dari set scores
      const rawSets = [s1, s2, s3, s4, s5];
      const validSets = rawSets.filter(s => s && String(s).trim().includes('-'));

      if (validSets.length === 0) {
        throw new Error('Minimal 1 set harus diisi.');
      }

      let p1W = 0, p2W = 0;
      validSets.forEach(s => {
        const pts = String(s).trim().split('-').map(Number);
        if (pts.length === 2 && !isNaN(pts[0]) && !isNaN(pts[1])) {
          if (pts[0] > pts[1]) p1W++; else p2W++;
        }
      });

      const { data: match } = await supabase
        .from(TABLE).select('pemain_1, pemain_2').eq('id', matchId).single();

      sets = { s1: s1||'', s2: s2||'', s3: s3||'', s4: s4||'', s5: s5||'' };
      skor_akhir = `${p1W}-${p2W}`;
      pemenang = p1W > p2W ? match.pemain_1 : match.pemain_2;
      kalah    = p1W > p2W ? match.pemain_2 : match.pemain_1;
    }

    const updateData = {
      ...sets,
      skor_akhir,
      pemenang,
      kalah,
      ...(tanggal ? { tanggal: new Date(tanggal+':00').toISOString() } : {}),
    };

    const { error } = await supabase
      .from(TABLE)
      .update(updateData)
      .eq('id', matchId);

    if (error) throw error;
    return { message: `Berhasil! Skor ${skor_akhir} tersimpan.` };
  },

  /**
   * Bulk insert jadwal (generate round robin)
   */
  async bulkInsertJadwal(rows) {
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) throw error;
  },

  /**
   * Hapus jadwal pending (sebelum overwrite)
   */
  async deletePendingBySesi(sesiId) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('sesi_id', sesiId)
      .or('skor_akhir.is.null,skor_akhir.eq.');

    if (error) throw error;
  },

  /**
   * Ambil semua match raw (untuk kalkulasi H2H, multi-sesi)
   */
  async getAllMatchesRaw(sesiFilter = null) {
    // Ambil SEMUA kolom termasuk s1-s5 untuk kalkulasi winrate per set
    let query = supabase
      .from(TABLE)
      .select('id, sesi_id, tanggal, pemain_1, pemain_2, skor_akhir, s1, s2, s3, s4, s5')
      .not('skor_akhir', 'is', null)
      .neq('skor_akhir', '');

    if (sesiFilter) {
      query = query.eq('sesi_id', sesiFilter);
    }

    const { data, error } = await query.order('tanggal');
    if (error) throw error;
    return data;
  },
};

// ── Tambahan: Edit, Hapus, Ubah Jadwal ───────────────────────

/** Hapus pertandingan (admin only) */
export const deleteMatch = async (id) => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

/** Edit tanggal jadwal */
export const updateJadwal = async (id, { tanggal, pemain1, pemain2 }) => {
  const updates = {};
  if (tanggal)  updates.tanggal  = new Date(tanggal).toISOString();
  if (pemain1)  updates.pemain_1 = pemain1;
  if (pemain2)  updates.pemain_2 = pemain2;

  const { data, error } = await supabase
    .from(TABLE).update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

/** Reset skor (kembalikan ke pending) */
export const resetSkor = async (id) => {
  const { error } = await supabase.from(TABLE).update({
    s1: '', s2: '', s3: '', s4: '', s5: '',
    skor_akhir: '', pemenang: '', kalah: '', updated_by: null,
  }).eq('id', id);
  if (error) throw error;
};

/** Realtime subscription ke tabel match */
export const subscribeMatch = (sesiId, callback) => {
  return supabase
    .channel(`match-sesi-${sesiId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'match',
      filter: `sesi_id=eq.${sesiId}`,
    }, callback)
    .subscribe();
};

// export { matchService };
