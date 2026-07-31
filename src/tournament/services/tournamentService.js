// src/tournament/services/tournamentService.js
// Single Responsibility: operasi CRUD data turnamen (event/grup/pemain/match)

import { supabase } from "../../lib/supabase.js";

// ── EVENT (musim turnamen — bisa dipakai berulang tiap tahun) ──
export const eventService = {
  async getAll() {
    const { data, error } = await supabase
      .from("tournament_event")
      .select("*")
      .order("tahun", { ascending: false })
      .order("id", { ascending: false });
    if (error) throw error;
    return data;
  },

  async create({ nama, tahun, tgl_mulai, tgl_selesai, keterangan }) {
    const { data, error } = await supabase
      .from("tournament_event")
      .insert({
        nama,
        tahun,
        tgl_mulai: tgl_mulai || null,
        tgl_selesai: tgl_selesai || null,
        keterangan: keterangan || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStatus(id, status) {
    const { error } = await supabase
      .from("tournament_event")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  },

  async remove(id) {
    const { error } = await supabase
      .from("tournament_event")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

// ── GRUP ──
export const grupService = {
  async getByEvent(eventId) {
    const { data, error } = await supabase
      .from("tournament_grup")
      .select("*")
      .eq("event_id", eventId)
      .order("nama");
    if (error) throw error;
    return data;
  },

  async create(eventId, nama) {
    const { data, error } = await supabase
      .from("tournament_grup")
      .insert({ event_id: eventId, nama })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Cek apakah grup masih "kosong" (aman dihapus tanpa merusak data historis) */
  async checkDependents(id) {
    const [{ count: pemainCount }, { count: matchCount }] = await Promise.all([
      supabase
        .from("tournament_pemain")
        .select("id", { count: "exact", head: true })
        .eq("grup_id", id),
      supabase
        .from("tournament_match")
        .select("id", { count: "exact", head: true })
        .eq("grup_id", id),
    ]);
    return { pemainCount: pemainCount || 0, matchCount: matchCount || 0 };
  },

  async remove(id) {
    const { error } = await supabase
      .from("tournament_grup")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

// ── PEMAIN ──
// Catatan: pemain TIDAK di-hard-delete (mengikuti pola master_pemain di liga reguler),
// karena tournament_match menyimpan pemain1_id/pemain2_id — kalau di-hard-delete,
// riwayat pertandingan yang sudah selesai akan kehilangan identitas pemainnya.
// Sebagai gantinya, pemain di-nonaktifkan (status AKTIF/NON-AKTIF), tetap tampil di
// klasemen & riwayat, tapi tidak muncul lagi di dropdown saat bikin jadwal match baru.
export const pemainService = {
  async getByEvent(eventId) {
    const { data, error } = await supabase
      .from("tournament_pemain")
      .select("*")
      .eq("event_id", eventId)
      .order("nama");
    if (error) throw error;
    return data;
  },

  async create(eventId, { nama, grup_id }) {
    const { data, error } = await supabase
      .from("tournament_pemain")
      .insert({ event_id: eventId, nama, grup_id: grup_id || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateGrup(id, grup_id) {
    const { error } = await supabase
      .from("tournament_pemain")
      .update({ grup_id })
      .eq("id", id);
    if (error) throw error;
  },

  /** Toggle status AKTIF / NON-AKTIF — pengganti hapus */
  async toggleStatus(id, statusBaru) {
    const { data, error } = await supabase
      .from("tournament_pemain")
      .update({ status: statusBaru })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Cek apakah pemain punya riwayat match (dipakai sebelum izinkan hard-delete) */
  async checkDependents(id) {
    const { count } = await supabase
      .from("tournament_match")
      .select("id", { count: "exact", head: true })
      .or(`pemain1_id.eq.${id},pemain2_id.eq.${id}`);
    return { matchCount: count || 0 };
  },

  /** Hard delete — hanya aman dipanggil kalau checkDependents().matchCount === 0 */
  async remove(id) {
    const { error } = await supabase
      .from("tournament_pemain")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};

// ── MATCH ──
const TABLE = "tournament_match";

export const matchService = {
  async getByEvent(eventId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("event_id", eventId)
      .order("tanggal", { ascending: true });
    if (error) throw error;
    return data;
  },

  /** Buat jadwal match fase grup */
  async createGroupMatch(
    eventId,
    { grup_id, pemain1_id, pemain2_id, tanggal, tempat },
  ) {
    const { error } = await supabase.from(TABLE).insert({
      event_id: eventId,
      fase: "GRUP",
      grup_id,
      pemain1_id,
      pemain2_id,
      tanggal: tanggal ? new Date(tanggal).toISOString() : null,
      tempat: tempat || null,
    });
    if (error) throw error;
  },

  /** Buat jadwal match babak gugur */
  async createKnockoutMatch(
    eventId,
    { ronde, urutan_bracket, pemain1_id, pemain2_id, tanggal, tempat },
  ) {
    const { error } = await supabase.from(TABLE).insert({
      event_id: eventId,
      fase: "GUGUR",
      ronde,
      urutan_bracket: urutan_bracket || 0,
      pemain1_id,
      pemain2_id,
      tanggal: tanggal ? new Date(tanggal).toISOString() : null,
      tempat: tempat || null,
    });
    if (error) throw error;
  },

  /** Simpan hasil skor per set. sets: [{p1,p2}, ...] */
  async saveScore(matchId, sets, adminEmail) {
    let p1Sets = 0,
      p2Sets = 0;
    sets.forEach((s) => {
      if (Number(s.p1) > Number(s.p2)) p1Sets++;
      else if (Number(s.p2) > Number(s.p1)) p2Sets++;
    });
    if (p1Sets === p2Sets)
      throw new Error("Skor set tidak boleh imbang, pastikan ada pemenang.");

    const { data: match, error: getErr } = await supabase
      .from(TABLE)
      .select("pemain1_id, pemain2_id")
      .eq("id", matchId)
      .single();
    if (getErr) throw getErr;
    if (!match.pemain1_id || !match.pemain2_id) {
      throw new Error(
        "Lengkapi kedua pemain dulu (masih ada slot TBD) sebelum input skor.",
      );
    }

    const pemenang_id = p1Sets > p2Sets ? match.pemain1_id : match.pemain2_id;

    const { error } = await supabase
      .from(TABLE)
      .update({
        set_skor: sets,
        status: "SELESAI",
        pemenang_id,
        updated_by: adminEmail || null,
      })
      .eq("id", matchId);
    if (error) throw error;
  },

  /** Kembalikan match ke status terjadwal (reset skor) */
  async resetScore(matchId) {
    const { error } = await supabase
      .from(TABLE)
      .update({ set_skor: [], status: "TERJADWAL", pemenang_id: null })
      .eq("id", matchId);
    if (error) throw error;
  },

  async remove(matchId) {
    const { error } = await supabase.from(TABLE).delete().eq("id", matchId);
    if (error) throw error;
  },

  /** Saran angka urutan_bracket berikutnya untuk ronde tertentu (masih bisa diedit manual) */
  async getNextUrutanBracket(eventId, ronde) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("urutan_bracket")
      .eq("event_id", eventId)
      .eq("fase", "GUGUR")
      .eq("ronde", ronde)
      .order("urutan_bracket", { ascending: false })
      .limit(1);
    if (error) throw error;
    const max = data?.[0]?.urutan_bracket || 0;
    return max + 1;
  },

  /** Isi/ganti pemain di slot TBD, atau koreksi pemain yang salah input */
  async updatePemain(matchId, { pemain1_id, pemain2_id }) {
    const { error } = await supabase
      .from(TABLE)
      .update({
        pemain1_id: pemain1_id || null,
        pemain2_id: pemain2_id || null,
      })
      .eq("id", matchId);
    if (error) throw error;
  },

  /**
   * Edit jadwal match yang sudah ada (bukan skor): tanggal & tempat untuk
   * semua fase, plus grup_id khusus fase GRUP atau ronde/urutan_bracket
   * khusus fase GUGUR. Field yang tidak dikirim (undefined) tidak disentuh.
   */
  async updateJadwal(
    matchId,
    { tanggal, tempat, grup_id, ronde, urutan_bracket } = {},
  ) {
    const payload = {
      tanggal: tanggal ? new Date(tanggal).toISOString() : null,
      tempat: tempat || null,
    };
    if (grup_id !== undefined) payload.grup_id = grup_id;
    if (ronde !== undefined) payload.ronde = ronde;
    if (urutan_bracket !== undefined) payload.urutan_bracket = urutan_bracket;

    const { error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", matchId);
    if (error) throw error;
  },

  /** Realtime subscription per event, mirip subscribeMatch() liga */
  subscribe(eventId, callback) {
    return supabase
      .channel(`tournament-match-event-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLE,
          filter: `event_id=eq.${eventId}`,
        },
        callback,
      )
      .subscribe();
  },
};

// ── ACTIVITY LOG ──
export const logService = {
  async record(adminEmail, action, detail, eventId) {
    const { error } = await supabase
      .from("tournament_activity_log")
      .insert({
        admin_email: adminEmail,
        action,
        detail: detail || null,
        event_id: eventId || null,
      });
    if (error) console.error("[tournament_activity_log]", error.message);
  },

  async getByEvent(eventId) {
    const { data, error } = await supabase
      .from("tournament_activity_log")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  },
};
