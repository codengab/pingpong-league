// src/lib/scheduleGenerator.js
// Pure functions untuk generate jadwal round robin
// No side effects — mudah di-test dan di-reuse

/**
 * Generate pasangan round robin
 * @param {string[]} pemain - array nama pemain
 * @param {'single'|'double'} mode
 * @returns {Array<{p1, p2}>}
 */
export function generatePasangan(pemain, mode = 'single') {
  const pasangan = [];
  for (let i = 0; i < pemain.length; i++) {
    for (let j = i + 1; j < pemain.length; j++) {
      pasangan.push({ p1: pemain[i], p2: pemain[j] });
    }
  }
  if (mode === 'double') {
    const away = pasangan.map(p => ({ p1: p.p2, p2: p.p1 }));
    return [...pasangan, ...away];
  }
  return pasangan;
}

/**
 * Distribusikan pertandingan ke hari kerja secara merata
 * @param {Array}   pasangan     - output dari generatePasangan()
 * @param {Date}    tglMulai
 * @param {Date}    tglSelesai
 * @param {Set}     hariLibur    - Set<'yyyy-MM-dd'>
 * @param {number}  matchPerHari - maks pertandingan per hari
 * @param {number}  maxPerPlayer - maks 1 pemain main per hari (default 2)
 * @returns {Array<{p1, p2, tanggal}>}
 */
export function distribusiTanggal(pasangan, tglMulai, tglSelesai, hariLibur, matchPerHari = 2, maxPerPlayer = 2) {
  const MS_PER_DAY = 86_400_000;
  const MAX_ITER   = pasangan.length * 10; // safety limit anti infinite-loop

  // Kumpulkan hari kerja (Senin–Jumat, bukan libur)
  const hariKerja = [];
  for (let d = new Date(tglMulai); d <= tglSelesai; d = new Date(d.getTime() + MS_PER_DAY)) {
    const dayOfWeek = d.getDay();
    const tglStr    = _toDateStr(d);
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !hariLibur.has(tglStr)) {
      hariKerja.push(tglStr);
    }
  }

  if (hariKerja.length === 0) {
    throw new Error('Tidak ada hari kerja tersedia dalam periode sesi ini.');
  }

  // Shuffle pasangan agar distribusi acak
  const shuffled = _shuffle([...pasangan]);
  const hasil    = [];
  let iHari      = 0;
  let iMatch     = 0;
  let iterations = 0;

  while (iMatch < shuffled.length) {
    if (iterations++ > MAX_ITER) {
      throw new Error('Tidak cukup hari kerja untuk mendistribusikan semua pertandingan. Kurangi peserta atau perbesar periode sesi.');
    }

    if (iHari >= hariKerja.length) {
      // Wrap around — bagi ke hari berikutnya dari awal
      iHari = 0;
    }

    const tanggal      = hariKerja[iHari];
    const matchHariIni = hasil.filter(m => m.tanggal.startsWith(tanggal));
    const pemainHariIni = {};
    matchHariIni.forEach(m => {
      pemainHariIni[m.p1] = (pemainHariIni[m.p1] || 0) + 1;
      pemainHariIni[m.p2] = (pemainHariIni[m.p2] || 0) + 1;
    });

    if (matchHariIni.length >= matchPerHari) {
      iHari++;
      continue;
    }

    const { p1, p2 } = shuffled[iMatch];
    const mainP1 = pemainHariIni[p1] || 0;
    const mainP2 = pemainHariIni[p2] || 0;

    if (mainP1 < maxPerPlayer && mainP2 < maxPerPlayer) {
      hasil.push({ p1, p2, tanggal: `${tanggal} 08:00:00` });
      iMatch++;
    } else {
      iHari++;
    }
  }

  return hasil;
}

/**
 * Konversi hari kerja ke row siap insert ke DB
 */
export function toDbRows(jadwal, sesiId, legLabel = 'Leg 1') {
  return jadwal.map(j => ({
    sesi_id:  sesiId,
    tanggal:  new Date(j.tanggal).toISOString(),
    pemain_1: j.p1,
    pemain_2: j.p2,
    leg:      legLabel,
  }));
}

// ── Private ──────────────────────────────────────────────────
function _toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
