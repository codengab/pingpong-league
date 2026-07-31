// src/tournament/components/renderer.js
// Pure render functions — input data, output HTML string (gaya sama dengan src/components/renderer.js)

import {
  hitungKlasemenGrup,
  rankingRunnerUp,
  ringkasSet,
  tentukanPemenang,
} from "../lib/klasemenCalculator.js";
import {
  formatTanggal,
  formatTanggalOnly,
  buildBracketLayout,
  RONDE_JUARA3,
} from "../lib/bracketHelper.js";

function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================
// SELECTOR EVENT (dropdown musim turnamen)
// ============================================================
export function renderEventOptions(events, selectedId) {
  if (!events.length) return '<option value="">Belum ada turnamen</option>';
  return events
    .map(
      (e) =>
        `<option value="${e.id}" ${String(e.id) === String(selectedId) ? "selected" : ""}>${esc(e.nama)} ${e.status === "AKTIF" ? "🟢" : e.status === "DRAFT" ? "📝" : ""}</option>`,
    )
    .join("");
}

// ============================================================
// FASE GRUP — klasemen per grup + ranking runner-up
// ============================================================
export function renderFaseGrup(grupList, pemainList, matchList) {
  if (!grupList.length) {
    return '<div class="text-center py-12 text-gray-400 text-sm">Belum ada grup dibuat untuk turnamen ini.</div>';
  }

  const standingsPerGrup = {};
  let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

  grupList.forEach((g) => {
    const pemainGrup = pemainList.filter((p) => p.grup_id === g.id);
    const matchGrup = matchList.filter(
      (m) => m.fase === "GRUP" && m.grup_id === g.id,
    );
    const rows = hitungKlasemenGrup(pemainGrup, matchGrup);
    standingsPerGrup[g.id] = rows;

    html += `
      <div class="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div class="bg-gray-800 text-white px-4 py-2 text-sm font-bold">${esc(g.nama)}</div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-gray-400 border-b border-gray-100">
                <th class="py-2 px-1">#</th>
                <th class="py-2 px-1 text-left">Pemain</th>
                <th class="py-2 px-1">M</th>
                <th class="py-2 px-1">W</th>
                <th class="py-2 px-1">L</th>
                <th class="py-2 px-1">Sel.Set</th>
                <th class="py-2 px-1">Sel.Skor</th>
                <th class="py-2 px-1">Poin</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${rows
                .map(
                  (r, i) => `
                <tr onclick="tLihatPemain(${r.pemain.id})" class="${i === 0 ? "bg-green-50" : i === 1 ? "bg-blue-50/50" : ""}">
                  <td class="py-2 px-1 text-center font-bold ${i < 2 ? "text-blue-600" : "text-gray-400"}">${i + 1}</td>
                  <td class="py-2 px-1 font-medium text-gray-700 cursor-pointer hover:text-blue-600 underline" >${esc(r.pemain.nama)}</td>
                  <td class="py-2 px-1 text-center text-gray-500">${r.main}</td>
                  <td class="py-2 px-1 text-center text-gray-500">${r.menang}</td>
                  <td class="py-2 px-1 text-center text-gray-500">${r.kalah}</td>
                  <td class="py-2 px-1 text-center text-gray-500">${r.selisihSet >= 0 ? "+" : ""}${r.selisihSet}</td>
                  <td class="py-2 px-1 text-center text-gray-500">${r.selisihSkor >= 0 ? "+" : ""}${r.selisihSkor}</td>
                  <td class="py-2 px-1 text-center font-bold text-gray-800">${r.poin}</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <div class="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-50">🟢 Juara Grup &nbsp; 🔵 Zona Runner-up</div>
      </div>`;
  });
  html += "</div>";

  // Ranking runner-up lintas grup
  const runnerUps = rankingRunnerUp(standingsPerGrup);
  const grupOf = (pemainId) => {
    const p = pemainList.find((x) => x.id === pemainId);
    const g = grupList.find((x) => x.id === p?.grup_id);
    return g ? g.nama : "-";
  };

  html += `
    <div class="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mt-4">
      <div class="px-4 py-3">
        <div class="text-sm font-bold text-gray-800">🏅 Peringkat 3 Terbaik</div>
        <div class="text-[11px] text-gray-400 mt-0.5">Peringkat ke-3 tiap grup, diurutkan dari Poin → Selisih Set → Selisih Skor. Juara grup &amp; runner-up (peringkat 1 &amp; 2) sudah otomatis lolos ke babak gugur.</div>
      </div>
      <table class="w-full text-xs">
        <thead>
          <tr class="text-gray-400 border-y border-gray-100">
            <th class="py-2 px-2">#</th>
            <th class="py-2 px-2 text-left">Pemain</th>
            <th class="py-2 px-2 text-left">Grup</th>
            <th class="py-2 px-2">M</th>
            <th class="py-2 px-2">Sel.Set</th>
            <th class="py-2 px-2">Sel.Skor</th>
            <th class="py-2 px-2">Poin</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${
            runnerUps
              .map(
                (r, i) => `
            <tr>
              <td class="py-2 px-2 text-center font-bold text-gray-500">${i + 1}</td>
              <td class="py-2 px-2 font-medium text-gray-700">${esc(r.pemain.nama)}</td>
              <td class="py-2 px-2 text-gray-500">${esc(grupOf(r.pemain.id))}</td>
              <td class="py-2 px-2 text-center text-gray-500">${r.main}</td>
              <td class="py-2 px-2 text-center text-gray-500">${r.selisihSet >= 0 ? "+" : ""}${r.selisihSet}</td>
              <td class="py-2 px-2 text-center text-gray-500">${r.selisihSkor >= 0 ? "+" : ""}${r.selisihSkor}</td>
              <td class="py-2 px-2 text-center font-bold text-gray-800">${r.poin}</td>
            </tr>`,
              )
              .join("") ||
            '<tr><td colspan="7" class="py-6 text-center text-gray-400">Belum ada data.</td></tr>'
          }
        </tbody>
      </table>
    </div>`;

  return html;
}

// ============================================================
// JADWAL & HASIL
// ============================================================
export function renderJadwalHasil(
  matchList,
  pemainList,
  grupList,
  filter,
  isAdmin,
) {
  const namaPemain = (id) => pemainList.find((p) => p.id === id)?.nama || "TBD";

  const namaGrup = (id) => grupList.find((g) => g.id === id)?.nama || "";

  let list = [...matchList];

  // ==========================================================
  // FILTER
  // ==========================================================
  if (filter === "terjadwal") {
    list = list.filter((m) => m.status === "TERJADWAL");
  }

  if (filter === "selesai") {
    list = list.filter((m) => m.status === "SELESAI");
  }

  // ==========================================================
  // EMPTY
  // ==========================================================
  if (!list.length) {
    return `
      <div class="text-center py-12 text-gray-400 text-sm">
        Tidak ada pertandingan.
      </div>
    `;
  }

  // ==========================================================
  // SORT BERDASARKAN DATETIME
  // ==========================================================
  list.sort((a, b) => {
    return new Date(a.tanggal) - new Date(b.tanggal);
  });

  // ==========================================================
  // GROUP BERDASARKAN TANGGAL SAJA
  // tanggal = YYYY-MM-DD
  // ==========================================================
  const grouped = list.reduce((acc, match) => {
    const key = (match.tanggal || "").substring(0, 10);

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(match);

    return acc;
  }, {});

  // ==========================================================
  // RENDER
  // ==========================================================
  return Object.entries(grouped)
    .map(([tanggal, matches]) => {
      return `
        <section class="mb-8">

          <!-- HEADER TANGGAL -->
          <div class="flex items-center gap-3 mb-3">
            <div
              class="flex items-center gap-2
                     text-sm font-bold text-gray-700
                     whitespace-nowrap"
            >
              <span>📅</span>
              <span>${formatTanggalOnly(tanggal)}</span>
            </div>

            <div class="h-px bg-gray-200 flex-1"></div>

            <div class="text-[11px] text-gray-400 whitespace-nowrap">
              ${matches.length} pertandingan
            </div>
          </div>

          <!-- GRID -->
          <div class="
            grid
            grid-cols-1
            sm:grid-cols-1
            lg:grid-cols-2
            xl:grid-cols-3
            gap-3
          ">

            ${matches
              .map((m) => {
                const sum = ringkasSet(m.set_skor);

                // ==================================================
                // JAM
                // ==================================================
                const jam = m.tanggal
                  ? new Date(m.tanggal).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--";

                // ==================================================
                // LABEL
                // ==================================================
                const label =
                  m.fase === "GRUP"
                    ? `Grup ${namaGrup(m.grup_id)}`
                    : m.ronde || "Babak Gugur";

                // ==================================================
                // STATUS / SKOR
                // ==================================================
                const skorHtml =
                  m.status === "SELESAI"
                    ? `
                      <div class="
                        text-lg
                        font-black
                        text-gray-800
                        tracking-wide
                      ">
                        ${sum.p1Set}
                        <span class="text-gray-300 mx-1">-</span>
                        ${sum.p2Set}
                      </div>
                    `
                    : `
                      <span class="
                        inline-flex
                        items-center
                        text-[10px]
                        font-bold
                        text-amber-600
                        bg-amber-50
                        px-2.5
                        py-1
                        rounded-full
                      ">
                        Terjadwal
                      </span>
                    `;

                // ==================================================
                // CARD
                // ==================================================
                return `
                  <div
                    class="
                      bg-white
                      border
                      border-gray-100
                      rounded-xl
                      shadow-sm
                      hover:shadow-md
                      hover:border-gray-200
                      transition-all
                      duration-200
                      overflow-hidden
                    "
                  >

                    <!-- CARD HEADER -->
                    <div
                      class="
                        flex
                        items-center
                        justify-between
                        px-3
                        py-2
                        bg-gray-50/70
                        border-b
                        border-gray-100
                      "
                    >

                      <div class="flex items-center gap-2">

                        <!-- JAM -->
                        <span
                          class="
                            text-xs
                            font-bold
                            text-gray-700
                            bg-white
                            border
                            border-gray-200
                            px-2
                            py-1
                            rounded-md
                          "
                        >
                          ${jam}
                        </span>

                        <!-- FASE -->
                        <span
                          class="
                            text-[10px]
                            font-medium
                            text-gray-400
                            truncate
                          "
                        >
                          ${esc(label)}
                        </span>

                      </div>

                      <!-- STATUS -->
                      ${
                        m.status === "SELESAI"
                          ? `
                            <span
                              class="
                                text-[9px]
                                font-bold
                                text-green-600
                                bg-green-50
                                px-2
                                py-1
                                rounded-full
                              "
                            >
                              SELESAI
                            </span>
                          `
                          : `
                            <span
                              class="
                                text-[9px]
                                font-bold
                                text-amber-600
                                bg-amber-50
                                px-2
                                py-1
                                rounded-full
                              "
                            >
                              LIVE
                            </span>
                          `
                      }

                    </div>

                    <!-- PEMAIN -->
                    <div class="px-3 py-4">

                      <div
                        class="
                          flex
                          items-center
                          justify-between
                          gap-2
                        "
                      >

                        <!-- PEMAIN 1 -->
                        <div class="flex-1 min-w-0 text-center">

                          <div
                            class="
                              text-sm
                              font-bold
                              text-gray-800
                              truncate
                            "
                            title="${esc(namaPemain(m.pemain1_id))}"
                          >
                            ${esc(namaPemain(m.pemain1_id))}
                          </div>

                          <div
                            class="
                              text-[9px]
                              text-gray-400
                              mt-0.5
                            "
                          >
                            Pemain 1
                          </div>

                        </div>

                        <!-- SKOR -->
                        <div
                          class="
                            flex
                            flex-col
                            items-center
                            justify-center
                            min-w-[55px]
                          "
                        >
                          ${skorHtml}

                          <span
                            class="
                              text-[9px]
                              text-gray-300
                              mt-0.5
                            "
                          >
                            ${m.status === "SELESAI" ? "SET" : "VS"}
                          </span>
                        </div>

                        <!-- PEMAIN 2 -->
                        <div class="flex-1 min-w-0 text-center">

                          <div
                            class="
                              text-sm
                              font-bold
                              text-gray-800
                              truncate
                            "
                            title="${esc(namaPemain(m.pemain2_id))}"
                          >
                            ${esc(namaPemain(m.pemain2_id))}
                          </div>

                          <div
                            class="
                              text-[9px]
                              text-gray-400
                              mt-0.5
                            "
                          >
                            Pemain 2
                          </div>

                        </div>

                      </div>

                    </div>

                    <!-- FOOTER -->
                    <div
                      class="
                        px-3
                        py-2
                        border-t
                        border-gray-100
                        flex
                        items-center
                        justify-between
                        min-h-[38px]
                      "
                    >

                      <!-- TEMPAT -->
                      <div
                        class="
                          text-[10px]
                          text-gray-400
                          truncate
                        "
                      >
                        ${m.tempat ? `📍 ${esc(m.tempat)}` : ""}
                      </div>

                      <!-- ADMIN -->
                      ${
                        isAdmin
                          ? `
                            <div class="flex items-center gap-1 ml-auto">

                              <button
                                  onclick="tOpenEditJadwal(${m.id})"
                                  class="text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded-md transition"
                                  title="Edit Jadwal"
                                >
                                  📅
                              </button>
                              ${
                                m.fase === "GUGUR"
                                  ? `
                                    <button
                                      onclick="tOpenEditPemain(${m.id})"
                                      class="
                                        text-[10px]
                                        text-gray-500
                                        hover:text-gray-700
                                        hover:bg-gray-100
                                        px-2
                                        py-1
                                        rounded-md
                                        transition
                                      "
                                      title="Edit Pemain"
                                    >
                                      👤
                                    </button>
                                  `
                                  : ""
                              }

                              ${
                                m.pemain1_id && m.pemain2_id
                                  ? `
                                    <button
                                      onclick="tInputSkor(${m.id})"
                                      class="
                                        text-[10px]
                                        text-blue-500
                                        hover:text-blue-700
                                        hover:bg-blue-50
                                        px-2
                                        py-1
                                        rounded-md
                                        transition
                                      "
                                      title="Input Skor"
                                    >
                                      ✏️
                                    </button>
                                  `
                                  : `
                                    <span
                                      class="
                                        text-[10px]
                                        text-amber-500
                                        px-2
                                      "
                                    >
                                      Menunggu TBD
                                    </span>
                                  `
                              }

                              <button
                                onclick="tHapusMatch(${m.id})"
                                class="
                                  text-[10px]
                                  text-red-400
                                  hover:text-red-600
                                  hover:bg-red-50
                                  px-2
                                  py-1
                                  rounded-md
                                  transition
                                "
                                title="Hapus Pertandingan"
                              >
                                🗑️
                              </button>

                            </div>
                          `
                          : ""
                      }

                    </div>

                  </div>
                `;
              })
              .join("")}

          </div>

        </section>
      `;
    })
    .join("");
}

// ============================================================
// BRACKET BABAK GUGUR
// ============================================================
export function renderBracket(matchList, pemainList, isAdmin) {
  const namaPemain = (id) => pemainList.find((p) => p.id === id)?.nama || "TBD";
  const gugur = matchList.filter((m) => m.fase === "GUGUR");

  const layout = buildBracketLayout(gugur);
  if (!layout) {
    return '<div class="text-center py-12 text-gray-400 text-sm">Bracket babak gugur belum dibuat.</div>';
  }
  const {
    rounds,
    connectors,
    juara3,
    totalWidth,
    totalHeight,
    CARD_W,
    CARD_H,
  } = layout;

  function kartuHtml(slot) {
    if (slot.isSkeleton) {
      return `
        <div class="absolute rounded-lg border border-dashed border-gray-200 bg-gray-50/60 flex items-center justify-center"
          style="left:0;top:0;width:${CARD_W}px;height:${CARD_H}px">
          <span class="text-[10px] text-gray-300 italic">TBD vs TBD</span>
        </div>`;
    }
    const m = slot.match;
    const sum = ringkasSet(m.set_skor);
    const w = m.pemenang_id || tentukanPemenang(m);
    const tbdSlot = !m.pemain1_id || !m.pemain2_id;

    const baris = (pid, skor) => `
      <div class="flex justify-between items-center px-2 py-1 ${w && w === pid ? "text-green-600 font-bold" : "text-gray-700"}">
        <span class="truncate">${pid ? esc(namaPemain(pid)) : '<span class="text-gray-300 italic">TBD</span>'}</span>
        <span>${m.status === "SELESAI" ? skor : ""}</span>
      </div>`;

    const tombolAdmin = isAdmin
      ? `
      <button onclick="tOpenEditJadwal(${m.id})" title="Edit Jadwal" class="text-gray-400 hover:text-blue-600"><i class="fas fa-calendar text-[9px]"></i></button>
      <button onclick="tOpenEditPemain(${m.id})" title="Edit Pemain" class="text-gray-400 hover:text-blue-600"><i class="fas fa-pen text-[9px]"></i></button>
      ${
        tbdSlot
          ? `<span class="text-[9px] text-amber-500" title="Lengkapi pemain dulu">TBD</span>`
          : `<button onclick="tInputSkor(${m.id})" title="Input Skor" class="text-gray-400 hover:text-blue-600"><i class="fas fa-clipboard-list text-[9px]"></i></button>`
      }
    `
      : "";

    return `
      <div class="absolute rounded-lg border border-gray-100 bg-white shadow-sm text-xs overflow-hidden"
        style="left:0;top:0;width:${CARD_W}px;height:${CARD_H}px">
        ${baris(m.pemain1_id, sum.p1Set)}
        <div class="border-t border-gray-50">${baris(m.pemain2_id, sum.p2Set)}</div>
        <div class="flex justify-between items-center px-2 py-1 mt-0 border-t border-dashed border-gray-100 bg-gray-50/50">
          <span class="text-[9px] text-gray-400">${formatTanggal(m.tanggal)}</span>
          <span class="flex gap-1.5">${tombolAdmin}</span>
        </div>
      </div>`;
  }

  // Kolom ronde utama
  const kolomHtml = rounds
    .map(
      (round) => `
      <div class="absolute text-center text-[11px] font-bold text-gray-400 uppercase"
        style="left:${round.colX}px;top:0;width:${CARD_W}px">${esc(round.ronde)}</div>
      ${round.slots
        .map(
          (slot) => `
        <div class="absolute" style="left:${round.colX}px;top:${slot.centerY - CARD_H / 2}px">${kartuHtml(slot)}</div>`,
        )
        .join("")}`,
    )
    .join("");

  // Kolom Perebutan Juara 3 — terpisah, tanpa connector
  const juara3Html = `
    <div class="absolute text-center text-[11px] font-bold text-amber-500 uppercase"
      style="left:${juara3.colX}px;top:${juara3.centerY - CARD_H / 2 - 22}px;width:${CARD_W}px">🥉 ${esc(RONDE_JUARA3)}</div>
    ${juara3.slots
      .map(
        (slot) => `
      <div class="absolute" style="left:${juara3.colX}px;top:${slot.centerY - CARD_H / 2}px">${kartuHtml(slot)}</div>`,
      )
      .join("")}`;

  // SVG connector antar ronde utama
  const svgPaths = connectors
    .map(
      (
        c,
      ) => `<path d="M${c.x1},${c.y1a} H${c.xmid} M${c.x1},${c.y1b} H${c.xmid} M${c.xmid},${c.y1a} V${c.y1b} M${c.xmid},${(c.y1a + c.y1b) / 2} H${c.x2}"
        fill="none" stroke="#d1d5db" stroke-width="1.5" />`,
    )
    .join("");

  return `
    <div class="overflow-x-auto pb-4">
      <div class="relative" style="width:${totalWidth}px;height:${totalHeight}px;min-width:${totalWidth}px">
        <svg class="absolute inset-0 pointer-events-none" width="${totalWidth}" height="${totalHeight}">${svgPaths}</svg>
        ${kolomHtml}
        ${juara3Html}
      </div>
    </div>`;
}

// ============================================================
// HEAD TO HEAD
// ============================================================
export function renderH2HOptions(pemainList) {
  return pemainList
    .map((p) => `<option value="${p.id}">${esc(p.nama)}</option>`)
    .join("");
}

export function renderH2HResult(namaA, namaB, hasil) {
  if (hasil.total === 0) {
    return '<div class="text-center py-8 text-gray-400 text-sm">Belum pernah bertanding.</div>';
  }
  return `
    <div class="text-center mb-3">
      <div class="text-2xl font-black text-gray-800">${hasil.aMenang} <span class="text-xs font-normal text-gray-400">VS</span> ${hasil.bMenang}</div>
      <div class="text-[11px] text-gray-400">${esc(namaA)} vs ${esc(namaB)} • ${hasil.total} pertandingan</div>
    </div>
    <div class="divide-y divide-gray-50 border-t border-gray-100">
      ${hasil.detail
        .map(
          (d) => `
        <div class="flex items-center justify-between py-2 text-xs">
          <span class="text-gray-400">${formatTanggal(d.match.tanggal)}</span>
          <span class="font-semibold text-gray-700">${d.setA} - ${d.setB}</span>
          <span class="text-[10px] font-bold ${d.pemenangId ? "text-green-600" : "text-gray-400"}">${d.pemenangId ? esc(d.pemenangId === d.match.pemain1_id ? namaA : namaB) : "-"}</span>
        </div>`,
        )
        .join("")}
    </div>`;
}

// ============================================================
// ADMIN — daftar grup & pemain
// ============================================================
export function renderGrupAdminList(grupList) {
  if (!grupList.length)
    return '<div class="text-xs text-gray-400 py-3">Belum ada grup.</div>';
  return grupList
    .map(
      (g) => `
    <div class="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
      <span class="text-gray-700">${esc(g.nama)}</span>
      <button onclick="tHapusGrup(${g.id})" class="text-[10px] text-red-400 hover:bg-red-50 px-2 py-1 rounded">Hapus</button>
    </div>`,
    )
    .join("");
}

export function renderPemainAdminList(pemainList, grupList) {
  if (!pemainList.length)
    return '<div class="text-xs text-gray-400 py-3">Belum ada pemain.</div>';
  return pemainList
    .map((p) => {
      const g = grupList.find((x) => x.id === p.grup_id);
      const aktif = p.status === "AKTIF";
      return `
    <div class="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
      <span class="text-gray-700">
        ${esc(p.nama)}
        <span class="text-gray-400 text-[10px]">(${g ? esc(g.nama) : "tanpa grup"})</span>
        <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${aktif ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}">${p.status}</span>
      </span>
      <button onclick="tToggleStatusPemain(${p.id}, '${p.status}')"
        class="text-[10px] px-2 py-1 rounded ${aktif ? "text-red-500 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}">
        <i class="fas ${aktif ? "fa-times" : "fa-check"} mr-1"></i>${aktif ? "Nonaktifkan" : "Aktifkan"}
      </button>
    </div>`;
    })
    .join("");
}

export function renderSelectOptions(items, valueKey, labelKey) {
  return items
    .map(
      (it) => `<option value="${it[valueKey]}">${esc(it[labelKey])}</option>`,
    )
    .join("");
}

// ============================================================
// MODAL RIWAYAT PEMAIN — daftar jadwal & hasil satu pemain
// ============================================================
export function renderRiwayatPemain(pemainId, pemainList, matchList, grupList) {
  const namaPemain = (id) => pemainList.find((p) => p.id === id)?.nama || "TBD";
  const namaGrup = (id) => grupList.find((g) => g.id === id)?.nama || "";

  const matches = matchList
    .filter((m) => m.pemain1_id === pemainId || m.pemain2_id === pemainId)
    .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

  if (!matches.length) {
    return '<div class="text-center py-8 text-gray-400 text-sm">Belum ada jadwal/hasil untuk pemain ini.</div>';
  }

  const menangCount = matches.filter(
    (m) => m.status === "SELESAI" && m.pemenang_id === pemainId,
  ).length;
  const kalahCount = matches.filter(
    (m) =>
      m.status === "SELESAI" && m.pemenang_id && m.pemenang_id !== pemainId,
  ).length;

  const stats = `
    <div class="flex items-center gap-4 mb-3 text-xs text-gray-500">
      <span>Total: <b class="text-gray-700">${matches.length}</b></span>
      <span class="text-green-600">Menang: <b>${menangCount}</b></span>
      <span class="text-red-500">Kalah: <b>${kalahCount}</b></span>
    </div>`;

  const rows = matches
    .map((m) => {
      const lawanId = m.pemain1_id === pemainId ? m.pemain2_id : m.pemain1_id;
      const sum = ringkasSet(m.set_skor);
      const menang = m.status === "SELESAI" && m.pemenang_id === pemainId;
      const skorTampil =
        m.pemain1_id === pemainId
          ? `${sum.p1Set}-${sum.p2Set}`
          : `${sum.p2Set}-${sum.p1Set}`;
      const labelFase =
        m.fase === "GRUP" ? esc(namaGrup(m.grup_id)) : esc(m.ronde || "");

      return `
        <div class="py-2.5 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-medium text-gray-700 truncate">
              vs ${lawanId ? esc(namaPemain(lawanId)) : '<span class="text-gray-300 italic">TBD</span>'}
              <span class="text-[10px] text-gray-400 font-normal">${labelFase}</span>
            </div>
            <div class="text-[10px] text-gray-400 mt-0.5">
              ${formatTanggal(m.tanggal)}${m.tempat ? " · 📍 " + esc(m.tempat) : ""}
            </div>
          </div>
          <div class="text-right shrink-0">
            ${
              m.status === "SELESAI"
                ? `<span class="text-xs font-bold ${menang ? "text-green-600" : "text-red-500"}">${menang ? "Menang" : "Kalah"}</span>
                   <div class="text-[10px] text-gray-400">${skorTampil}</div>`
                : `<span class="text-[10px] text-amber-500">Terjadwal</span>`
            }
          </div>
        </div>`;
    })
    .join("");

  return stats + `<div class="divide-y divide-gray-100">${rows}</div>`;
}
