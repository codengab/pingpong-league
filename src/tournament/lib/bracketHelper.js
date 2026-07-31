// src/tournament/lib/bracketHelper.js

export const RONDE_UTAMA = [
  "Babak 32 Besar",
  "Babak 16 Besar",
  "Perempat Final",
  "Semi Final",
  "Final",
];

export const SLOT_STANDAR = {
  "Babak 32 Besar": 16,
  "Babak 16 Besar": 8,
  "Perempat Final": 4,
  "Semi Final": 2,
  Final: 1,
};

export const RONDE_JUARA3 = "Perebutan Peringkat 3";

// ── Urutan ronde untuk tab Jadwal & Hasil (list biasa, bukan bracket) ──
export function urutkanRonde(rondeList) {
  const semua = [...RONDE_UTAMA, RONDE_JUARA3];
  return [...rondeList].sort((a, b) => {
    const ia = semua.indexOf(a);
    const ib = semua.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
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

export function formatTanggal(dateStr) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  if (isNaN(d)) return "TBD";
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function formatTanggalOnly(dateStr) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  if (isNaN(d)) return "TBD";
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
// ============================================================
// LAYOUT BRACKET — skeleton otomatis + posisi kartu + connector
// Pendekatan "asumsi urutan": pasangan slot ke-(2k) & ke-(2k+1) di
// satu ronde (diurutkan by urutan_bracket) dianggap menuju slot
// ke-k di ronde berikutnya. Perebutan Juara 3 dirender terpisah,
// tanpa connector, di kolom paling ujung bagian bawah.
// ============================================================
const CARD_W = 208;
const CARD_H = 76;
const GAP0 = 20; // jarak antar kartu di ronde paling awal
const COL_GAP = 56; // jarak horizontal antar kolom ronde
const LEFT_MARGIN = 16;
const TOP_MARGIN = 32;
const UNIT = CARD_H + GAP0;

export function buildBracketLayout(gugurMatches) {
  const utama = gugurMatches.filter((m) => (m.ronde || "") !== RONDE_JUARA3);
  const juara3 = gugurMatches.filter((m) => m.ronde === RONDE_JUARA3);

  if (!utama.length && !juara3.length) return null;

  const byRonde = {};
  utama.forEach((m) => {
    const r = RONDE_UTAMA.includes(m.ronde) ? m.ronde : "Final";
    if (!byRonde[r]) byRonde[r] = [];
    byRonde[r].push(m);
  });
  Object.values(byRonde).forEach((list) =>
    list.sort(
      (a, b) =>
        (a.urutan_bracket || 0) - (b.urutan_bracket || 0) || a.id - b.id,
    ),
  );

  const rondeAda = RONDE_UTAMA.filter((r) => byRonde[r]?.length);
  const finalIdx = RONDE_UTAMA.indexOf("Final");
  const startIdx = rondeAda.length
    ? RONDE_UTAMA.indexOf(rondeAda[0])
    : finalIdx;
  const sequence = RONDE_UTAMA.slice(startIdx, finalIdx + 1);

  const firstRonde = sequence[0];
  const firstRealList = byRonde[firstRonde] || [];
  const baseSlotsReal = Math.max(
    firstRealList.length,
    ...firstRealList.map((m) => m.urutan_bracket || 0),
    0,
  );
  const baseSlots = Math.max(SLOT_STANDAR[firstRonde] || 1, baseSlotsReal, 1);

  const rounds = sequence.map((ronde, r) => {
    const realList = byRonde[ronde] || [];
    const slotCountStandar = baseSlots / Math.pow(2, r);
    const maxUrutanReal = Math.max(
      realList.length,
      ...realList.map((m) => m.urutan_bracket || 0),
      0,
    );
    const slotCount = Math.max(slotCountStandar, maxUrutanReal, 1);

    const slots = [];
    for (let i = 0; i < slotCount; i++) {
      const match = realList[i] || null;
      const centerY = TOP_MARGIN + (i + 0.5) * UNIT * Math.pow(2, r);
      slots.push({ match, isSkeleton: !match, urutanSaran: i + 1, centerY });
    }
    const colX = LEFT_MARGIN + r * (CARD_W + COL_GAP);
    const centerYCol =
      slots.reduce((s, sl) => s + sl.centerY, 0) / slots.length;
    return { ronde, slots, colX, centerYCol };
  });

  const connectors = [];
  for (let r = 0; r < rounds.length - 1; r++) {
    const cur = rounds[r];
    const next = rounds[r + 1];
    for (let k = 0; k < next.slots.length; k++) {
      const a = cur.slots[k * 2];
      const b = cur.slots[k * 2 + 1];
      if (!a || !b) continue;
      const x1 = cur.colX + CARD_W;
      const xmid = x1 + COL_GAP / 2;
      const x2 = next.colX;
      connectors.push({
        x1,
        y1a: a.centerY,
        y1b: b.centerY,
        xmid,
        x2,
        y2: next.slots[k].centerY,
      });
    }
  }

  const totalHeight = TOP_MARGIN * 2 + baseSlots * UNIT;
  const totalWidthUtama = LEFT_MARGIN + rounds.length * (CARD_W + COL_GAP);

  const juara3Sorted = [...juara3].sort(
    (a, b) => (a.urutan_bracket || 0) - (b.urutan_bracket || 0) || a.id - b.id,
  );
  const juara3List = juara3Sorted.length ? juara3Sorted : [null];
  const juara3ColX = totalWidthUtama;
  const juara3BottomY = totalHeight - TOP_MARGIN - CARD_H / 2;
  const juara3Slots = juara3List.map((m, i) => ({
    match: m,
    isSkeleton: !m,
    urutanSaran: i + 1,
    centerY: juara3BottomY - (juara3List.length - 1 - i) * UNIT,
  }));
  const centerYJuara3 =
    juara3Slots.reduce((s, sl) => s + sl.centerY, 0) / juara3Slots.length;

  const totalWidth = juara3ColX + CARD_W + LEFT_MARGIN;

  return {
    rounds,
    connectors,
    juara3: { colX: juara3ColX, slots: juara3Slots, centerY: centerYJuara3 },
    totalWidth,
    totalHeight,
    CARD_W,
    CARD_H,
  };
}
