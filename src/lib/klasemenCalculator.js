// src/lib/klasemenCalculator.js
// Pure functions — no side effects, fully testable
// Input: array of match rows from DB
// Output: sorted klasemen array

const WO_VALUES = new Set(["W-0", "0-W", "W-W"]);

/**
 * Hitung klasemen dari array match rows.
 * @param {Array} matches - rows dari tabel match
 * @returns {Array} sorted klasemen
 */
export function hitungKlasemen(matches) {
  const klasemen = {};

  for (const row of matches) {
    const {
      pemain_1: p1,
      pemain_2: p2,
      skor_akhir,
      tanggal,
      s1,
      s2,
      s3,
      s4,
      s5,
    } = row;

    _ensurePlayer(klasemen, p1);
    _ensurePlayer(klasemen, p2);

    const skorRaw = String(skor_akhir || "")
      .trim()
      .toUpperCase();
    if (!skorRaw || skorRaw === "0-0") continue; // belum selesai

    const isWO = WO_VALUES.has(skorRaw);
    let p1Poin = 0,
      p2Poin = 0;
    let p1Set = 0,
      p2Set = 0;
    let p1Bola = 0,
      p2Bola = 0;

    if (isWO) {
      if (skorRaw === "W-0") {
        p1Poin = 2;
        p1Set = 3;
        klasemen[p2].wo++;
      } else if (skorRaw === "0-W") {
        p2Poin = 2;
        p2Set = 3;
        klasemen[p1].wo++;
      } else {
        // W-W (double WO)
        klasemen[p1].wo++;
        klasemen[p2].wo++;
      }
    } else {
      const [setP1, setP2] = skorRaw.split("-").map(Number);
      p1Set = setP1;
      p2Set = setP2;
      p1Poin = p1Set > p2Set ? 2 : 1;
      p2Poin = p2Set > p1Set ? 2 : 1;

      // Hitung bola dari setiap set
      for (const sStr of [s1, s2, s3, s4, s5]) {
        const s = String(sStr || "").trim();
        if (!s.includes("-")) continue;
        const [a, b] = s.split("-").map(Number);
        p1Bola += a;
        p2Bola += b;
      }
    }

    const tglTime = tanggal ? new Date(tanggal).getTime() : 0;
    const winner = p1Poin > p2Poin ? p1 : p2Poin > p1Poin ? p2 : null;

    klasemen[p1].main++;
    klasemen[p2].main++;
    klasemen[p1].poin += p1Poin;
    klasemen[p2].poin += p2Poin;
    klasemen[p1].setM += p1Set;
    klasemen[p2].setM += p2Set;
    klasemen[p1].setK += p2Set;
    klasemen[p2].setK += p1Set;
    klasemen[p1].bolaM += p1Bola;
    klasemen[p2].bolaM += p2Bola;
    klasemen[p1].bolaK += p2Bola;
    klasemen[p2].bolaK += p1Bola;

    if (winner === p1) {
      klasemen[p1].menang++;
      klasemen[p2].kalah++;
      klasemen[p1].rawForm.push({ tgl: tglTime, res: "W" });
      klasemen[p2].rawForm.push({ tgl: tglTime, res: "L" });
    } else if (winner === p2) {
      klasemen[p2].menang++;
      klasemen[p1].kalah++;
      klasemen[p2].rawForm.push({ tgl: tglTime, res: "W" });
      klasemen[p1].rawForm.push({ tgl: tglTime, res: "L" });
    }
  }

  return Object.values(klasemen)
    .map((p) => {
      const rasioSet = p.setK === 0 ? p.setM : p.setM / p.setK;
      const rasioBola = p.bolaK === 0 ? p.bolaM : p.bolaM / p.bolaK;
      return {
        ...p,
        rasioSet,
        rasioBola,
        form: p.rawForm
          .sort((a, b) => a.tgl - b.tgl)
          .slice(-5)
          .map((f) => f.res),
      };
    })
    .sort((a, b) => {
      if (b.poin !== a.poin) return b.poin - a.poin;
      if (b.rasioSet !== a.rasioSet) return b.rasioSet - a.rasioSet;
      return b.rasioBola - a.rasioBola;
    });
}

/**
 * Hitung detail stats satu pemain (riwayat, h2h, winrate per set)
 * @param {string} nama - nama pemain
 * @param {Array}  matches - raw match rows
 */
export function hitungDetailPlayer(nama, matches) {
  const hasil = [];
  const jadwal = [];
  const h2hMap = {};
  const setStats = Array.from({ length: 5 }, () => ({
    main: 0,
    menang: 0,
    poinFor: 0,
    poinAgainst: 0,
  }));

  for (const row of matches) {
    const {
      pemain_1,
      pemain_2,
      skor_akhir,
      tanggal,
      s1,
      s2,
      s3,
      s4,
      s5,
      sesi_id,
      leg,
    } = row;
    if (pemain_1 !== nama && pemain_2 !== nama) continue;

    const isP1 = pemain_1 === nama;
    const lawan = isP1 ? pemain_2 : pemain_1;
    const skorRaw = String(skor_akhir || "")
      .trim()
      .toUpperCase();
    const isSelesai = skorRaw && skorRaw !== "0-0";
    const tglRaw = tanggal ? new Date(tanggal) : null;
    const tglIndo = _formatTgl(tglRaw);

    if (isSelesai) {
      // Hitung win
      let isWin = false;
      if (skorRaw === "W-0") isWin = isP1;
      else if (skorRaw === "0-W") isWin = !isP1;
      else if (skorRaw !== "W-W") {
        const [a, b] = skorRaw.split("-").map(Number);
        isWin = isP1 ? a > b : b > a;
      }

      // Normalkan skor dari sudut pandang pemain
      let skorTampil = skorRaw;
      if (!WO_VALUES.has(skorRaw)) {
        const [a, b] = skorRaw.split("-").map(Number);
        skorTampil = isP1 ? `${a}-${b}` : `${b}-${a}`;
      }

      // normalisasi Set
      const normalizeSet = (setStr) => {
        const s = String(setStr || "").trim();
        if (!s.includes("-")) return null;

        const [a, b] = s.split("-").map(Number);
        if (isNaN(a) || isNaN(b)) return null;

        return isP1 ? `${a}-${b}` : `${b}-${a}`;
      };

      // Tampilkan info sesi di tanggal jika data dari multi-sesi
      const tglDisplay = sesi_id
        ? `${tglIndo} <span class="text-[9px] bg-gray-100 text-gray-400 px-1 rounded">Sesi ${sesi_id}</span>`
        : tglIndo;

      hasil.push({
        lawan,
        skor: skor_akhir,
        skorTampil,
        setTampil: [s1, s2, s3, s4, s5].map(normalizeSet).filter(Boolean),
        tgl: tglDisplay,
        tglPlain: tglIndo,
        timestamp: tglRaw?.getTime() ?? 0,
        isP1,
        isWin,
        sesi_id,
        leg,
      });

      // H2H
      if (!h2hMap[lawan]) h2hMap[lawan] = { lawan, menang: 0, kalah: 0 };
      if (skorRaw !== "W-W") {
        if (isWin) h2hMap[lawan].menang++;
        else h2hMap[lawan].kalah++;
      }

      // Win rate per set (hanya pertandingan normal)
      if (!WO_VALUES.has(skorRaw)) {
        [s1, s2, s3, s4, s5].forEach((sStr, idx) => {
          const s = String(sStr || "").trim();
          if (!s.includes("-")) return;
          const [a, b] = s.split("-").map(Number);
          if (isNaN(a) || isNaN(b)) return;
          const pFor = isP1 ? a : b;
          const pAgainst = isP1 ? b : a;
          setStats[idx].main++;
          setStats[idx].poinFor += pFor;
          setStats[idx].poinAgainst += pAgainst;
          if (pFor > pAgainst) setStats[idx].menang++;
        });
      }
    } else {
      jadwal.push({
        lawan,
        tgl: tglIndo,
        timestamp: tglRaw?.getTime() ?? 9_999_999_999_999,
      });
    }
  }

  return {
    hasil: hasil.sort((a, b) => b.timestamp - a.timestamp),
    jadwal: jadwal.sort((a, b) => a.timestamp - b.timestamp),
    h2h: Object.values(h2hMap).sort(
      (a, b) => b.menang + b.kalah - (a.menang + a.kalah),
    ),
    winRateSet: setStats.map((s, i) => ({
      set: i + 1,
      main: s.main,
      menang: s.menang,
      kalah: s.main - s.menang,
      winrate: s.main > 0 ? Math.round((s.menang / s.main) * 100) : null,
      avgPoinFor: s.main > 0 ? (s.poinFor / s.main).toFixed(1) : null,
      avgPoinAgainst: s.main > 0 ? (s.poinAgainst / s.main).toFixed(1) : null,
    })),
  };
}

// ── Private Helpers ──────────────────────────────────────────
function _ensurePlayer(map, nama) {
  if (nama && !map[nama]) {
    map[nama] = {
      nama,
      main: 0,
      menang: 0,
      kalah: 0,
      wo: 0,
      poin: 0,
      setM: 0,
      setK: 0,
      bolaM: 0,
      bolaK: 0,
      rawForm: [],
    };
  }
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function _formatTgl(date) {
  if (!date || isNaN(date)) return "TBD";
  return `${HARI[date.getDay()]}, ${date.getDate()} ${BULAN[date.getMonth()]} ${date.getFullYear()}`;
}
