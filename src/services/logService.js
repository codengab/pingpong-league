// src/services/logService.js
// Single Responsibility: activity log operations

import { supabase } from '../lib/supabase.js';

export const logService = {
  /**
   * Catat aktivitas admin
   * @param {string} action - nama aksi
   * @param {object} detail - data konteks (before/after, match info, dll)
   * @param {number} sesiId
   */
  async log(action, detail = {}, sesiId = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return; // tidak log jika tidak ada sesi

    await supabase.from('activity_log').insert({
      admin_email: user.email,
      action,
      detail,
      sesi_id: sesiId,
    });
    // Tidak throw error — log gagal tidak boleh ganggu operasi utama
  },

  /**
   * Ambil log terbaru
   * @param {number} limit
   */
  async getLogs(limit = 50) {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  /** Format action ke label yang readable */
  formatAction(action) {
    const labels = {
      input_skor:       '🏓 Input Skor',
      edit_skor:        '✏️ Edit Skor',
      hapus_match:      '🗑️ Hapus Match',
      generate_jadwal:  '📅 Generate Jadwal',
      ubah_jadwal:      '🔄 Ubah Jadwal',
      tambah_pemain:    '👤 Tambah Pemain',
      edit_pemain:      '✏️ Edit Pemain',
      nonaktif_pemain:  '🚫 Nonaktifkan Pemain',
      aktif_pemain:     '✅ Aktifkan Pemain',
    };
    return labels[action] || action;
  },
};
