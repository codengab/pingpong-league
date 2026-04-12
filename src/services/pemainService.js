// src/services/pemainService.js
// Single Responsibility: player CRUD operations

import { supabase } from '../lib/supabase.js';

export const pemainService = {
  /** Ambil semua pemain (semua sesi) */
  async getAll() {
    const { data, error } = await supabase
      .from('master_pemain')
      .select('*, master_sesi(nama)')
      .order('sesi_id', { ascending: false })
      .order('nama');
    if (error) throw error;
    return data;
  },

  /** Ambil pemain per sesi */
  async getBySesi(sesiId) {
    const { data, error } = await supabase
      .from('master_pemain')
      .select('*')
      .eq('sesi_id', sesiId)
      .order('nama');
    if (error) throw error;
    return data;
  },

  /** Tambah pemain baru */
  async tambah({ nama, sesiId, email = null }) {
    if (!nama?.trim()) throw new Error('Nama pemain tidak boleh kosong');
    const { data, error } = await supabase
      .from('master_pemain')
      .insert({ nama: nama.trim(), sesi_id: sesiId, status: 'AKTIF', email })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Edit nama / email pemain */
  async edit(id, { nama, email }) {
    const { data, error } = await supabase
      .from('master_pemain')
      .update({ nama: nama?.trim(), email })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Toggle status AKTIF / NON-AKTIF */
  async toggleStatus(id, statusBaru) {
    const { data, error } = await supabase
      .from('master_pemain')
      .update({ status: statusBaru })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
