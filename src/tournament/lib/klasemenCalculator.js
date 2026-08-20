// src/tournament/lib/klasemenCalculator.js
// Pure functions — no side effects. Input: array row tournament_match & tournament_pemain.

/** Ringkas 1 match: berapa set & poin(skor) tiap pemain */
export function ringkasSet(setSkor) {
  let p1Set = 0,
    p2Set = 0,
    p1Poin = 0,
    p2Poin = 0;
  (setSkor || []).forEach((s) => {
    const a = Number(s.p1) || 0;
    const b = Number(s.p2) || 0;
    p1Poin += a;
    p2Poin += b;
    if (a > b) p1Set++;
    else if (b > a) p2Set++;
  });
  return { p1Set, p2Set, p1Poin, p2Poin };
}

/** Tentukan pemenang dari mayoritas set (fallback jika pemenang_id kosong) */
export function tentukanPemenang(match) {
  const { p1Set, p2Set } = ringkasSet(match.set_skor);
  if (p1Set === p2Set) return null;
  return p1Set > p2Set ? match.pemain1_id : match.pemain2_id;
}

/**
 * Hitung klasemen 1 grup.
 * @param {Array} pemainList - tournament_pemain milik grup ini
 * @param {Array} matchList  - tournament_match fase GRUP milik grup ini
 * Urutan: Poin(menang=3,kalah=0) → Selisih Set → Selisih Skor → Head-to-head
 */
export function hitungKlasemenGrup(pemainList, matchList) {
  const table = {};
  pemainList.forEach((p) => {
    table[p.id] = {
      pemain: p,
      main: 0,
      menang: 0,
      kalah: 0,
      setM: 0,
      setK: 0,
      skorM: 0,
      skorK: 0,
      poin: 0,
    };
  });

  const selesai = matchList.filter((m) => m.status === "SELESAI");

  selesai.forEach((m) => {
    const r1 = table[m.pemain1_id];
    const r2 = table[m.pemain2_id];
    if (!r1 || !r2) return;

    const sum = ringkasSet(m.set_skor);
    const pemenangId = m.pemenang_id || tentukanPemenang(m);

    r1.main++;
    r2.main++;
    r1.setM += sum.p1Set;
    r1.setK += sum.p2Set;
    r2.setM += sum.p2Set;
    r2.setK += sum.p1Set;
    r1.skorM += sum.p1Poin;
    r1.skorK += sum.p2Poin;
    r2.skorM += sum.p2Poin;
    r2.skorK += sum.p1Poin;

    if (pemenangId === m.pemain1_id) {
      r1.menang++;
      r1.poin += m.is_wo ? 2 : 3;
      r2.kalah++;
    } else if (pemenangId === m.pemain2_id) {
      r2.menang++;
      r2.poin += m.is_wo ? 2 : 3;
      r1.kalah++;
    } else if (m.is_wo) {
      // Double WO — tidak ada pemenang, keduanya dihitung kalah (0 poin)
      r1.kalah++;
      r2.kalah++;
    }
  });

  const rows = Object.values(table).map((r) => ({
    ...r,
    selisihSet: r.setM - r.setK,
    selisihSkor: r.skorM - r.skorK,
  }));

  function h2h(idA, idB) {
    const m = selesai.find(
      (x) =>
        (x.pemain1_id === idA && x.pemain2_id === idB) ||
        (x.pemain1_id === idB && x.pemain2_id === idA),
    );
    if (!m) return 0;
    const w = m.pemenang_id || tentukanPemenang(m);
    if (w === idA) return -1;
    if (w === idB) return 1;
    return 0;
  }

  rows.sort((a, b) => {
    if (b.poin !== a.poin) return b.poin - a.poin;
    if (b.selisihSet !== a.selisihSet) return b.selisihSet - a.selisihSet;
    if (b.selisihSkor !== a.selisihSkor) return b.selisihSkor - a.selisihSkor;
    return h2h(a.pemain.id, b.pemain.id);
  });

  return rows;
}

/**
 * Ranking peringkat-3-terbaik lintas grup — dipakai kalau slot babak gugur masih
 * kurang setelah juara grup (peringkat 1) DAN runner-up (peringkat 2) otomatis lolos.
 * @param {Object} standingsPerGrup - { grupId: rows[] } hasil hitungKlasemenGrup
 * @param {number[]} posisi - index peringkat yang diambil dari tiap grup (0-based).
 *   Default [2] = cuma ambil peringkat ke-3 tiap grup (karena 1 & 2 sudah pasti lolos).
 */
export function rankingRunnerUp(standingsPerGrup, posisi = [2]) {
  const runnerUps = [];
  Object.values(standingsPerGrup).forEach((rows) => {
    posisi.forEach((idx) => {
      if (rows[idx]) runnerUps.push({ ...rows[idx], posisiAsli: idx + 1 }); // 1-based, akan selalu 3
    });
  });
  runnerUps.sort((a, b) => {
    if (b.poin !== a.poin) return b.poin - a.poin;
    if (b.selisihSet !== a.selisihSet) return b.selisihSet - a.selisihSet;
    return b.selisihSkor - a.selisihSkor;
  });
  return runnerUps;
}

/** Rekap head-to-head dua pemain dari seluruh match (grup + gugur) dalam satu event */
export function headToHead(pemainAId, pemainBId, allMatches) {
  const riwayat = allMatches.filter(
    (m) =>
      m.status === "SELESAI" &&
      ((m.pemain1_id === pemainAId && m.pemain2_id === pemainBId) ||
        (m.pemain1_id === pemainBId && m.pemain2_id === pemainAId)),
  );

  let aMenang = 0,
    bMenang = 0;
  const detail = riwayat.map((m) => {
    const sum = ringkasSet(m.set_skor);
    const pemenangId = m.pemenang_id || tentukanPemenang(m);
    if (pemenangId === pemainAId) aMenang++;
    else if (pemenangId === pemainBId) bMenang++;
    const aIsP1 = m.pemain1_id === pemainAId;
    return {
      match: m,
      setA: aIsP1 ? sum.p1Set : sum.p2Set,
      setB: aIsP1 ? sum.p2Set : sum.p1Set,
      skorA: aIsP1 ? sum.p1Poin : sum.p2Poin,
      skorB: aIsP1 ? sum.p2Poin : sum.p1Poin,
      pemenangId,
    };
  });

  return { aMenang, bMenang, total: riwayat.length, detail };
}
