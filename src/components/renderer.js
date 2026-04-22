// src/components/renderer.js
// Pure render functions — input data, output HTML string
// Mudah diupdate: ubah template tanpa sentuh logika bisnis

import {
  hitungKlasemen,
  hitungDetailPlayer,
} from "../lib/klasemenCalculator.js";

const WO_SET = new Set(["W-0", "0-W", "W-W"]);

// ============================================================
// KLASEMEN TABLE
// ============================================================
export function renderKlasemen(matches) {
  const data = hitungKlasemen(matches);
  if (!data.length) {
    return '<tr><td colspan="11" class="py-8 text-center text-sm text-gray-400">Belum ada pertandingan di sesi ini.</td></tr>';
  }

  return data
    .map(
      (p, i) => `
    <tr data-nama="${p.nama}" class="row-pemain hover:bg-blue-50/50 transition-colors cursor-pointer">
      <td class="px-4 py-2 text-center text-base ${i < 3 ? "font-bold text-blue-600" : "text-gray-400"}">${i + 1}</td>
      <td class="px-2 py-2">
        <div class="flex flex-col">
          <span class="text-base font-medium text-gray-800">${p.nama}</span>
          <div class="flex space-x-1 mt-1">
            ${p.form.map((f) => `<span class="w-1 h-1 rounded-full ${f === "W" ? "bg-green-500" : "bg-red-500"}"></span>`).join("")}
          </div>
        </div>
      </td>
      <td class="px-2 py-2 text-center text-sm text-gray-600">${p.main}</td>
      <td class="px-2 py-2 text-center text-sm text-gray-600">${p.menang}</td>
      <td class="px-2 py-2 text-center text-sm text-gray-600">${p.kalah}</td>
      <td class="px-2 py-2 text-center text-sm text-gray-600">${p.wo}</td>
      <td class="px-4 py-2 text-center text-base font-bold text-gray-800">${p.poin}</td>
      <td class="px-2 py-2 text-center text-sm text-gray-600">${p.rasioSet.toFixed(3)}</td>
      <td class="px-2 py-2 text-center text-sm text-gray-600">${p.rasioBola.toFixed(3)}</td>
    </tr>
  `,
    )
    .join("");
}

// ============================================================
// JADWAL (grouped by date)
// ============================================================
export function renderJadwal(matches, isAdmin = false) {
  const pending = matches.filter((m) => !m.skor_akhir || m.skor_akhir === "");
  if (!pending.length) {
    return '<div class="text-center py-12 text-gray-400 text-sm">Tidak ada jadwal mendatang.</div>';
  }

  const groups = _groupByDate(pending, "asc");
  let html =
    '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-2">';

  for (const [tgl, items] of Object.entries(groups)) {
    html += `
      <div class="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gray-800 text-white px-3 py-2">
          <div class="text-sm font-bold">${tgl}</div>
        </div>
        <div class="divide-y divide-gray-100">
          ${items
            .map(
              (m) => `
            <div class="px-3 py-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-gray-700 truncate w-[40%]">${m.pemain_1}</span>
                <span class="text-[10px] font-black text-gray-300 px-2 py-1 bg-gray-50 rounded shrink-0">VS</span>
                <span class="text-xs font-semibold text-gray-700 truncate w-[40%] text-right">${m.pemain_2}</span>
              </div>
              ${
                isAdmin
                  ? `
              <div class="flex gap-1 mt-1 justify-end">
                <button onclick="openModalUbahJadwal(${m.id})" class="text-[10px] text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                  ✏️ Ubah
                </button>
                <button onclick="hapusMatch(${m.id})" class="text-[10px] text-red-400 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                  🗑️ Hapus
                </button>
              </div>`
                  : ""
              }
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }
  html += "</div>";
  return html;
}

// ============================================================
// HASIL (sorted newest first, grouped by date)
// ============================================================
export function renderHasil(matches, isAdmin = false) {
  const selesai = matches
    .filter((m) => m.skor_akhir && m.skor_akhir !== "")
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  if (!selesai.length) {
    return '<div class="text-center py-12 text-gray-400 text-sm">Belum ada hasil pertandingan.</div>';
  }

  const groups = _groupByDate(selesai, "desc");
  let html = "";

  for (const [tgl, items] of Object.entries(groups)) {
    html += `<div class="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-6 mb-2">${tgl}</div>`;
    items.forEach((m) => {
      const {
        display: skorDisplay,
        badge,
        p1Bold,
        p2Bold,
      } = _parseSkorHasil(m);
      html += `
        <div class="bg-white border rounded-xl p-4 shadow-sm mb-2">
          <div class="flex items-center justify-between mb-2">
            
            <div class="text-sm ${p1Bold ? "font-bold text-gray-800" : "text-gray-500"} w-1/3">${m.pemain_1}</div>
            <div class="flex items-center bg-gray-800 text-white text-xs px-2 py-1 rounded-md font-mono tracking-widest">
              ${skorDisplay}${badge}
            </div>
            <div class="text-sm ${p2Bold ? "font-bold text-gray-800" : "text-gray-500"} w-1/3 text-right">${m.pemain_2}</div>
          </div>
          <div class="flex justify-center space-x-2 mt-1">
            
            ${[m.s1, m.s2, m.s3, m.s4, m.s5]
              .filter((s) => s && s.includes("-"))
              .map(
                (s) =>
                  `<span class="text-[10px] text-gray-400 bg-gray-50 px-1 rounded">${s}</span>`,
              )
              .join("")}
          </div>
          <div class="text-xs text-gray-500 flex justify-center mt-1"> ${"Sesi " + m.sesi_id + " - " + m.leg} </div>
          ${
            isAdmin
              ? `
          <div class="flex gap-2 mt-2 justify-end border-t border-gray-50 pt-1">
            <button onclick="editMatch(${m.id})" class="text-[10px] text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
              ✏️ Edit Skor
            </button>
            <button onclick="hapusMatch(${m.id})" class="text-[10px] text-red-400 hover:bg-red-50 px-2 py-1 rounded transition-colors">
              🗑️ Hapus
            </button>
          </div>`
              : ""
          }
        </div>
      `;
    });
  }
  return html;
}

// ============================================================
// PODIUM & STATISTIK
// ============================================================
export function renderPodium(matches) {
  const data = hitungKlasemen(matches);
  if (!data.length) return;

  const byId = (id) => document.getElementById(id);

  byId("nama-1").textContent = data[0]?.nama ?? "-";
  byId("nama-2").textContent = data[1]?.nama ?? "-";
  byId("nama-3").textContent = data[2]?.nama ?? "-";

  const topSet = data.reduce((a, b) => (b.setM > a.setM ? b : a));
  const topBola = data.reduce((a, b) => (b.bolaM > a.bolaM ? b : a));
  const bestRasio = data.reduce((a, b) => (b.rasioSet > a.rasioSet ? b : a));
  const bestBolaR = data.reduce((a, b) => (b.rasioBola > a.rasioBola ? b : a));
  const maxWO = Math.max(...data.map((p) => p.wo));
  const maxLoss = Math.max(...data.map((p) => p.kalah));
  const mostWO = data.filter((p) => p.wo === maxWO && maxWO > 0);
  const mostLoss = data.filter((p) => p.kalah === maxLoss && maxLoss > 0);

  byId("stat-set-nama").textContent = topSet.nama;
  byId("stat-set-angka").textContent = topSet.setM + " Set";
  byId("stat-bola-nama").textContent = topBola.nama;
  byId("stat-bola-angka").textContent = topBola.bolaM + " Poin";
  byId("stat-rasio-nama").textContent = bestRasio.nama;
  byId("stat-rasio-angka").textContent = String(bestRasio.rasioSet);
  byId("stat-bolarasio-nama").textContent = bestBolaR.nama;
  byId("stat-bolarasio-angka").textContent = String(bestBolaR.rasioBola);
  byId("stat-wo-nama").textContent = mostWO.length
    ? mostWO.map((p) => p.nama).join(", ")
    : "-";
  byId("stat-wo-angka").textContent = mostWO.length
    ? mostWO[0].wo + " WO"
    : "0 WO";
  byId("stat-loss-nama").textContent = mostLoss.length
    ? mostLoss.map((p) => p.nama).join(", ")
    : "-";
  byId("stat-loss-angka").textContent = mostLoss.length
    ? mostLoss[0].kalah + " Kalah"
    : "0 Kalah";
}

// ============================================================
// DETAIL PEMAIN MODAL
// ============================================================
export function renderDetailPemain(nama, allMatches, klasemenData) {
  const detail = hitungDetailPlayer(nama, allMatches);
  // Hitung stats dari allMatches yang sudah difilter (ALL atau SESI)
  // bukan dari klasemenData yang hanya dari sesi aktif
  const klasemenDariFilter = hitungKlasemen(allMatches);
  const stats = klasemenDariFilter.find((p) => p.nama === nama) || null;

  // Stats cards
  const statsHtml = stats
    ? `
    <div class="bg-blue-50 p-2 rounded-xl text-center border border-blue-100">
      <div class="text-[9px] text-blue-400 uppercase font-bold">Set Menang</div>
      <div class="text-lg font-black text-blue-700">${stats.setM}</div>
    </div>
    <div class="bg-red-50 p-2 rounded-xl text-center border border-red-100">
      <div class="text-[9px] text-red-400 uppercase font-bold">Set Kalah</div>
      <div class="text-lg font-black text-red-700">${stats.setK}</div>
    </div>
    <div class="bg-green-50 p-2 rounded-xl text-center border border-green-100">
      <div class="text-[9px] text-green-400 uppercase font-bold">Rasio Set</div>
      <div class="text-lg font-black text-green-700">${typeof stats.rasioSet === "number" ? stats.rasioSet.toFixed(3) : stats.rasioSet}</div>
    </div>
  `
    : '<div class="col-span-3 text-center text-xs text-gray-400">Belum ada statistik.</div>';

  // Hasil
  const hasilHtml = detail.hasil.length
    ? detail.hasil
        .map((m) => {
          const woUpper = String(m.skor || "")
            .trim()
            .toUpperCase();
          let skorTampil = m.skorTampil;
          let woBadge = "";
          if (woUpper === "W-W") {
            skorTampil = "DOUBLE WO";
          } else if (WO_SET.has(woUpper)) {
            skorTampil += " (WO)";
            woBadge = " WO";
          }

          return `
          <div class="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm mb-2">
            <div>
              <div class="text-[10px] text-gray-400 tracking-tight">${m.tgl}</div>
              <div class="text-sm font-medium text-gray-700">vs ${m.lawan}</div>
            </div>
            <div class="flex items-center space-x-3">
              <span class="text-[10px] text-gray-400 bg-gray-50 rounded">${m.leg}</span>
              <span class="text-sm font-black ${m.isWin ? "text-green-600" : "text-red-600"}">${skorTampil}</span>
              <span class="w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black ${m.isWin ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}">
                ${woUpper === "W-W" ? "WO" : m.isWin ? "W" : "L"}
              </span>
            </div>
          </div>`;
        })
        .join("")
    : '<p class="text-sm text-gray-400 italic">Belum ada pertandingan selesai.</p>';

  // Jadwal
  const jadwalHtml = detail.jadwal.length
    ? detail.jadwal
        .map(
          (m) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <div>
            <div class="text-[10px] text-gray-400 uppercase">${m.tgl}</div>
            <div class="text-sm font-bold text-gray-700">${nama} vs ${m.lawan}</div>
          </div>
          <div class="text-[10px] font-bold bg-white px-2 py-1 rounded border text-gray-400">VS</div>
        </div>`,
        )
        .join("")
    : '<p class="text-sm text-gray-400 italic">Tidak ada jadwal tersisa.</p>';

  // H2H
  const h2hHtml = detail.h2h.length
    ? detail.h2h
        .map((h) => {
          const total = h.menang + h.kalah;
          const pct = total > 0 ? Math.round((h.menang / total) * 100) : 0;
          const barColor = pct >= 50 ? "bg-green-500" : "bg-red-400";
          return `
          <div class="p-3 bg-white border rounded-xl shadow-sm mb-2">
            <div class="flex justify-between items-center mb-1">
              <span class="text-sm font-bold text-gray-700">${h.lawan}</span>
              <span class="text-xs font-black ${pct >= 50 ? "text-green-600" : "text-red-500"}">${h.menang}W — ${h.kalah}L</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1">
              <div class="${barColor} h-1 rounded-full" style="width:${pct}%"></div>
            </div>
            <div class="text-[10px] text-gray-400 mt-1">${pct}% winrate dari ${total} pertemuan</div>
          </div>`;
        })
        .join("")
    : '<p class="text-sm text-gray-400 italic">Belum ada data H2H.</p>';

  // Win rate per set
  const activeSetStats = detail.winRateSet.filter((s) => s.main > 0);
  const wrHtml = activeSetStats.length
    ? activeSetStats
        .map((s) => {
          const pct = s.winrate;
          const barColor =
            pct >= 70
              ? "bg-green-500"
              : pct >= 50
                ? "bg-yellow-400"
                : "bg-red-400";
          const label = pct >= 70 ? "💪" : pct >= 50 ? "👍" : "⚠️";
          return `
          <div class="p-3 bg-white border rounded-xl shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-gray-600">Set ${s.set}</span>
              <div class="flex items-center space-x-2">
                <span class="text-[10px] text-gray-400">${s.menang}W / ${s.kalah}L dari ${s.main} set</span>
                <span class="text-xs font-black ${pct >= 50 ? "text-green-600" : "text-red-500"}">${pct}%</span>
                <span>${label}</span>
              </div>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2">
              <div class="${barColor} h-2 rounded-full" style="width:${pct}%"></div>
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-[10px] text-gray-400">Avg poin: <b>${s.avgPoinFor}</b> vs <b>${s.avgPoinAgainst}</b></span>
            </div>
          </div>`;
        })
        .join("")
    : '<p class="text-sm text-gray-400 italic">Belum ada data set.</p>';

  return { statsHtml, hasilHtml, jadwalHtml, h2hHtml, wrHtml };
}

// ── Private Helpers ──────────────────────────────────────────
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

function _formatTglDisplay(isoStr) {
  if (!isoStr) return "TBD";
  const d = new Date(isoStr);
  if (isNaN(d)) return "TBD";
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function _groupByDate(matches, order = "asc") {
  const groups = {};
  matches.forEach((m) => {
    const key = _formatTglDisplay(m.tanggal);
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return groups;
}

function _parseSkorHasil(m) {
  const s = String(m.skor_akhir || "")
    .trim()
    .toUpperCase();
  if (s === "W-0")
    return {
      display: "3 - 0",
      badge:
        ' <span class="ml-1 text-[10px] px-1 py-1 bg-red-100 text-red-600 rounded font-bold">WO</span>',
      p1Bold: true,
      p2Bold: false,
    };
  if (s === "0-W")
    return {
      display: "0 - 3",
      badge:
        ' <span class="ml-1 text-[10px] px-1 py-1 bg-red-100 text-red-600 rounded font-bold">WO</span>',
      p1Bold: false,
      p2Bold: true,
    };
  if (s === "W-W")
    return { display: "DOUBLE WO", badge: "", p1Bold: false, p2Bold: false };
  const [a, b] = s.split("-").map(Number);
  return { display: `${a} - ${b}`, badge: "", p1Bold: a > b, p2Bold: b > a };
}
