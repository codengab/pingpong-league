// src/services/sesiService.js
// Single Responsibility: operasi master sesi dan pemain

import { supabase } from '../lib/supabase.js';

export const sesiService = {
  /**
   * Ambil semua sesi, diurutkan AKTIF dulu
   */
  async getAllSesi() {
    const { data, error } = await supabase
      .from('master_sesi')
      .select('*')
      .order('status', { ascending: true }); // AKTIF < DRAFT < SELESAI alphabetically — handle di client

    if (error) throw error;

    // Urutkan: AKTIF → DRAFT → SELESAI
    const order = { AKTIF: 0, DRAFT: 1, SELESAI: 2 };
    return data.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  },

  /**
   * Ambil pemain aktif berdasarkan sesi
   */
  async getPemainBySesi(sesiId) {
    const { data, error } = await supabase
      .from('master_pemain')
      .select('id, nama')
      .eq('sesi_id', sesiId)
      .eq('status', 'AKTIF')
      .order('nama');

    if (error) throw error;
    return data.map(p => p.nama);
  },

  /**
   * Ambil hari libur sebagai Set<string>
   */
  async getHariLibur() {
    const { data, error } = await supabase
      .from('master_libur')
      .select('tanggal');

    if (error) throw error;
    return new Set(data.map(r => r.tanggal));
  },
};
