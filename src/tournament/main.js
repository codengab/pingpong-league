// src/tournament/main.js
// Entry point modul Turnamen — pola sama dengan src/main.js (liga reguler)

import { authService } from "../services/authService.js";
import {
  eventService,
  grupService,
  pemainService,
  matchService,
  logService,
} from "./services/tournamentService.js";
import {
  renderEventOptions,
  renderFaseGrup,
  renderJadwalHasil,
  renderBracket,
  renderH2HOptions,
  renderH2HResult,
  renderGrupAdminList,
  renderPemainAdminList,
  renderSelectOptions,
} from "./components/renderer.js";
import { headToHead } from "./lib/klasemenCalculator.js";
import { createStore } from "../lib/appState.js";
import "../input.css";

// ── Expose handler untuk onclick= di HTML ──────────────────────
Object.assign(window, {
  tShowTab,
  tOnEventChange,
  tOpenAuth,
  tCloseAuth,
  tHandleLogin,
  tHandleLogout,
  tTambahGrup,
  tHapusGrup,
  tTambahPemain,
  tToggleStatusPemain,
  tOpenGroupMatchForm,
  tSubmitGroupMatch,
  tOpenKnockoutMatchForm,
  tSubmitKnockoutMatch,
  tSuggestUrutan,
  tFilterJadwal,
  tInputSkor,
  tCloseSkorModal,
  tTambahSetRow,
  tHapusSetRow,
  tSubmitSkor,
  tHapusMatch,
  tOpenEditPemain,
  tCloseEditPemain,
  tSubmitEditPemain,
  tRunH2H,
  tBukaEventBaru,
  tSubmitEventBaru,
  tUbahStatusEvent,
});

const store = createStore({
  user: null,
  isAdmin: false,
  eventList: [],
  eventAktif: null,
  grupList: [],
  pemainList: [],
  matchList: [],
  activeTab: "grup",
  jadwalFilter: "semua",
});

let skorSetRows = [{ p1: "", p2: "" }];
let editingMatchId = null;
let editingPemainMatchId = null;

// ================================================================
// INIT
// ================================================================
async function init() {
  const user = await authService.getCurrentUser();
  const isAdmin = user ? await authService.isAdmin() : false;
  store.setState({ user, isAdmin });
  _toggleAdminUI(isAdmin);

  authService.onAuthChange((_event, session) => {
    setTimeout(async () => {
      const isAdmin2 = session?.user ? await authService.isAdmin() : false;
      store.setState({ user: session?.user || null, isAdmin: isAdmin2 });
      _toggleAdminUI(isAdmin2);
    }, 0);
  });

  await loadEvents();
}

function _toggleAdminUI(isAdmin) {
  document
    .querySelectorAll(".t-admin-only")
    .forEach((el) => el.classList.toggle("hidden", !isAdmin));
  const badge = document.getElementById("t-admin-badge");
  const loginBtn = document.getElementById("t-btn-login");
  if (badge) badge.classList.toggle("hidden", !isAdmin);
  if (loginBtn) loginBtn.classList.toggle("hidden", isAdmin);
}

// ================================================================
// EVENT (musim turnamen)
// ================================================================
async function loadEvents() {
  const events = await eventService.getAll();
  store.setState({ eventList: events });
  const sel = document.getElementById("t-select-event");
  const activeEvent =
    events.find((e) => e.status === "AKTIF") || events[0] || null;
  sel.innerHTML = renderEventOptions(events, activeEvent?.id);
  if (activeEvent) {
    store.setState({ eventAktif: activeEvent });
    await loadEventData(activeEvent.id);
  } else {
    document.getElementById("t-no-event").classList.remove("hidden");
  }
  _renderEventAdminList();
}

async function tOnEventChange() {
  const id = Number(document.getElementById("t-select-event").value);
  const event = store.getState().eventList.find((e) => e.id === id);
  store.setState({ eventAktif: event });
  await loadEventData(id);
}

async function loadEventData(eventId) {
  const [grup, pemain, match] = await Promise.all([
    grupService.getByEvent(eventId),
    pemainService.getByEvent(eventId),
    matchService.getByEvent(eventId),
  ]);
  store.setState({ grupList: grup, pemainList: pemain, matchList: match });
  _renderAll();
  _fillAdminSelects();
}

function tBukaEventBaru() {
  document.getElementById("t-modal-event").classList.remove("hidden");
}
async function tSubmitEventBaru() {
  const nama = document.getElementById("t-event-nama").value.trim();
  const tahun =
    Number(document.getElementById("t-event-tahun").value) ||
    new Date().getFullYear();
  const msg = document.getElementById("t-event-msg");
  if (!nama) {
    msg.textContent = "Nama turnamen wajib diisi.";
    return;
  }
  try {
    await eventService.create({ nama, tahun });
    document.getElementById("t-modal-event").classList.add("hidden");
    document.getElementById("t-event-nama").value = "";
    await loadEvents();
  } catch (e) {
    msg.textContent = e.message;
  }
}
async function tUbahStatusEvent(id, status) {
  await eventService.updateStatus(id, status);
  await loadEvents();
}
function _renderEventAdminList() {
  const el = document.getElementById("t-event-admin-list");
  if (!el) return;
  const events = store.getState().eventList;
  el.innerHTML = events
    .map(
      (e) => `
    <div class="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
      <span>${e.nama} <span class="text-[10px] text-gray-400">(${e.tahun})</span></span>
      <select onchange="tUbahStatusEvent(${e.id}, this.value)" class="text-xs border border-gray-200 rounded px-2 py-1">
        <option value="DRAFT" ${e.status === "DRAFT" ? "selected" : ""}>DRAFT</option>
        <option value="AKTIF" ${e.status === "AKTIF" ? "selected" : ""}>AKTIF</option>
        <option value="SELESAI" ${e.status === "SELESAI" ? "selected" : ""}>SELESAI</option>
      </select>
    </div>`,
    )
    .join("");
}

// ================================================================
// TAB SWITCH
// ================================================================
function tShowTab(tab) {
  store.setState({ activeTab: tab });
  document
    .querySelectorAll(".t-tab-btn")
    .forEach((b) => b.classList.remove("t-tab-active"));
  document
    .querySelectorAll(".t-content-section")
    .forEach((s) => s.classList.add("hidden"));
  document.getElementById("t-btn-" + tab)?.classList.add("t-tab-active");
  document.getElementById("t-tab-" + tab)?.classList.remove("hidden");
  _renderAll();
}

function _renderAll() {
  const { grupList, pemainList, matchList, activeTab, jadwalFilter, isAdmin } =
    store.getState();
  if (activeTab === "grup") {
    document.getElementById("t-tab-grup").innerHTML = renderFaseGrup(
      grupList,
      pemainList,
      matchList,
    );
  } else if (activeTab === "jadwal") {
    document.getElementById("t-jadwal-list").innerHTML = renderJadwalHasil(
      matchList,
      pemainList,
      grupList,
      jadwalFilter,
      isAdmin,
    );
  } else if (activeTab === "bracket") {
    document.getElementById("t-bracket-list").innerHTML = renderBracket(
      matchList,
      pemainList,
      isAdmin,
    );
  } else if (activeTab === "h2h") {
    const selA = document.getElementById("t-h2h-a");
    const selB = document.getElementById("t-h2h-b");
    selA.innerHTML = renderH2HOptions(pemainList);
    selB.innerHTML = renderH2HOptions(pemainList);
  } else if (activeTab === "kelola") {
    _renderKelola();
  }
}

function tFilterJadwal(filter) {
  store.setState({ jadwalFilter: filter });
  document
    .querySelectorAll(".t-filter-btn")
    .forEach((b) => b.classList.remove("t-filter-active"));
  document
    .getElementById("t-filter-" + filter)
    ?.classList.add("t-filter-active");
  _renderAll();
}

// ================================================================
// AUTH
// ================================================================
function tOpenAuth() {
  document.getElementById("t-auth-overlay").classList.remove("hidden");
}
function tCloseAuth() {
  document.getElementById("t-auth-overlay").classList.add("hidden");
}

async function tHandleLogin() {
  const email = document.getElementById("t-auth-email").value.trim();
  const password = document.getElementById("t-auth-password").value;
  const msg = document.getElementById("t-auth-msg");
  msg.classList.add("hidden");
  try {
    await authService.login(email, password);
    tCloseAuth();
  } catch (e) {
    msg.textContent = "Login gagal: " + e.message;
    msg.classList.remove("hidden");
  }
}

async function tHandleLogout() {
  await authService.logout();
}

// ================================================================
// ADMIN — KELOLA GRUP & PEMAIN
// ================================================================
function _renderKelola() {
  const { grupList, pemainList } = store.getState();
  document.getElementById("t-grup-admin-list").innerHTML =
    renderGrupAdminList(grupList);
  document.getElementById("t-pemain-admin-list").innerHTML =
    renderPemainAdminList(pemainList, grupList);
  _fillAdminSelects();
}

function _fillAdminSelects() {
  const { grupList, pemainList } = store.getState();
  const grupOpts = renderSelectOptions(grupList, "id", "nama");
  const pemainAktif = pemainList.filter((p) => p.status === "AKTIF");
  const pemainOpts = renderSelectOptions(pemainAktif, "id", "nama");
  const pemainOptsTBD = '<option value="">— TBD —</option>' + pemainOpts;

  ["t-pemain-grup", "t-gm-grup"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.innerHTML = grupOpts || "<option disabled>Belum ada grup</option>";
  });
  ["t-gm-p1", "t-gm-p2"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.innerHTML =
        pemainOpts || "<option disabled>Belum ada pemain aktif</option>";
  });
  // Match babak gugur & edit pemain boleh kosong (TBD)
  ["t-ko-p1", "t-ko-p2", "t-edit-p1", "t-edit-p2"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.innerHTML = pemainOpts
        ? pemainOptsTBD
        : '<option value="">— TBD —</option>';
  });
}

async function tTambahGrup() {
  const nama = document.getElementById("t-grup-nama").value.trim();
  const { eventAktif, user } = store.getState();
  if (!nama || !eventAktif) return;
  await grupService.create(eventAktif.id, nama);
  await logService.record(user?.email, "tambah_grup", { nama }, eventAktif.id);
  document.getElementById("t-grup-nama").value = "";
  await loadEventData(eventAktif.id);
}
async function tHapusGrup(id) {
  const dep = await grupService.checkDependents(id);
  if (dep.pemainCount > 0 || dep.matchCount > 0) {
    alert(
      `Grup ini tidak bisa dihapus karena masih punya ${dep.pemainCount} pemain dan ${dep.matchCount} pertandingan terkait.\n` +
        `Pindahkan/nonaktifkan pemainnya dulu, atau hapus pertandingannya lewat tab Jadwal & Hasil.`,
    );
    return;
  }
  if (!confirm("Hapus grup kosong ini?")) return;
  const { eventAktif } = store.getState();
  await grupService.remove(id);
  await loadEventData(eventAktif.id);
}

async function tTambahPemain() {
  const nama = document.getElementById("t-pemain-nama").value.trim();
  const grup_id = document.getElementById("t-pemain-grup").value || null;
  const { eventAktif, user } = store.getState();
  if (!nama || !eventAktif) return;
  await pemainService.create(eventAktif.id, { nama, grup_id });
  await logService.record(
    user?.email,
    "tambah_pemain",
    { nama },
    eventAktif.id,
  );
  document.getElementById("t-pemain-nama").value = "";
  await loadEventData(eventAktif.id);
}
async function tToggleStatusPemain(id, statusSekarang) {
  const statusBaru = statusSekarang === "AKTIF" ? "NON-AKTIF" : "AKTIF";
  if (
    !confirm(
      `${statusBaru === "NON-AKTIF" ? "Nonaktifkan" : "Aktifkan kembali"} pemain ini?`,
    )
  )
    return;
  const { eventAktif, user } = store.getState();
  await pemainService.toggleStatus(id, statusBaru);
  await logService.record(
    user?.email,
    statusBaru === "AKTIF" ? "aktif_pemain" : "nonaktif_pemain",
    { id },
    eventAktif.id,
  );
  await loadEventData(eventAktif.id);
}

// ================================================================
// ADMIN — JADWAL MATCH GRUP & GUGUR
// ================================================================
function tOpenGroupMatchForm() {
  document.getElementById("t-modal-gm").classList.remove("hidden");
}
async function tSubmitGroupMatch() {
  const { eventAktif, user } = store.getState();
  const grup_id = Number(document.getElementById("t-gm-grup").value);
  const pemain1_id = Number(document.getElementById("t-gm-p1").value);
  const pemain2_id = Number(document.getElementById("t-gm-p2").value);
  const tanggal = document.getElementById("t-gm-tanggal").value;
  const tempat = document.getElementById("t-gm-tempat").value.trim();
  const msg = document.getElementById("t-gm-msg");
  if (!grup_id || !pemain1_id || !pemain2_id || pemain1_id === pemain2_id) {
    msg.textContent = "Pilih grup dan dua pemain berbeda.";
    return;
  }
  await matchService.createGroupMatch(eventAktif.id, {
    grup_id,
    pemain1_id,
    pemain2_id,
    tanggal,
    tempat,
  });
  await logService.record(
    user?.email,
    "tambah_jadwal_grup",
    { pemain1_id, pemain2_id },
    eventAktif.id,
  );
  document.getElementById("t-modal-gm").classList.add("hidden");
  await loadEventData(eventAktif.id);
}

function tOpenKnockoutMatchForm() {
  document.getElementById("t-modal-ko").classList.remove("hidden");
  tSuggestUrutan();
}

/** Isi field Urutan Bracket dengan saran angka berikutnya untuk ronde yang dipilih (tetap bisa diedit manual) */
async function tSuggestUrutan() {
  const { eventAktif } = store.getState();
  const ronde = document.getElementById("t-ko-ronde").value;
  if (!eventAktif) return;
  try {
    const saran = await matchService.getNextUrutanBracket(eventAktif.id, ronde);
    document.getElementById("t-ko-urutan").value = saran;
  } catch (e) {
    /* biarkan nilai lama kalau gagal fetch */
  }
}

async function tSubmitKnockoutMatch() {
  const { eventAktif, user } = store.getState();
  const ronde = document.getElementById("t-ko-ronde").value;
  const pemain1_id = Number(document.getElementById("t-ko-p1").value) || null;
  const pemain2_id = Number(document.getElementById("t-ko-p2").value) || null;
  const urutan_bracket =
    Number(document.getElementById("t-ko-urutan").value) || 0;
  const tanggal = document.getElementById("t-ko-tanggal").value;
  const tempat = document.getElementById("t-ko-tempat").value.trim();
  const msg = document.getElementById("t-ko-msg");
  msg.textContent = "";
  if (!pemain1_id && !pemain2_id) {
    msg.textContent =
      "Isi minimal salah satu pemain (boleh salah satunya TBD).";
    return;
  }
  if (pemain1_id && pemain1_id === pemain2_id) {
    msg.textContent = "Pemain 1 dan Pemain 2 tidak boleh sama.";
    return;
  }
  await matchService.createKnockoutMatch(eventAktif.id, {
    ronde,
    urutan_bracket,
    pemain1_id,
    pemain2_id,
    tanggal,
    tempat,
  });
  await logService.record(
    user?.email,
    "tambah_jadwal_gugur",
    { ronde, pemain1_id, pemain2_id },
    eventAktif.id,
  );
  document.getElementById("t-modal-ko").classList.add("hidden");
  await loadEventData(eventAktif.id);
}

async function tHapusMatch(id) {
  if (!confirm("Hapus pertandingan ini?")) return;
  const { eventAktif } = store.getState();
  await matchService.remove(id);
  await loadEventData(eventAktif.id);
}

// ================================================================
// ADMIN — EDIT PEMAIN (isi/ganti slot TBD)
// ================================================================
function tOpenEditPemain(matchId) {
  editingPemainMatchId = matchId;
  const { matchList } = store.getState();
  const m = matchList.find((x) => x.id === matchId);
  if (!m) return;
  document.getElementById("t-edit-p1").value = m.pemain1_id || "";
  document.getElementById("t-edit-p2").value = m.pemain2_id || "";
  document.getElementById("t-edit-pemain-msg").textContent = "";
  document.getElementById("t-modal-edit-pemain").classList.remove("hidden");
}
function tCloseEditPemain() {
  document.getElementById("t-modal-edit-pemain").classList.add("hidden");
}

async function tSubmitEditPemain() {
  const pemain1_id = Number(document.getElementById("t-edit-p1").value) || null;
  const pemain2_id = Number(document.getElementById("t-edit-p2").value) || null;
  const msg = document.getElementById("t-edit-pemain-msg");
  if (!pemain1_id && !pemain2_id) {
    msg.textContent = "Minimal salah satu pemain harus diisi.";
    return;
  }
  if (pemain1_id && pemain1_id === pemain2_id) {
    msg.textContent = "Pemain 1 dan Pemain 2 tidak boleh sama.";
    return;
  }
  const { eventAktif, user } = store.getState();
  try {
    await matchService.updatePemain(editingPemainMatchId, {
      pemain1_id,
      pemain2_id,
    });
    await logService.record(
      user?.email,
      "edit_pemain_match",
      { matchId: editingPemainMatchId, pemain1_id, pemain2_id },
      eventAktif.id,
    );
    tCloseEditPemain();
    await loadEventData(eventAktif.id);
  } catch (e) {
    msg.textContent = e.message;
  }
}

// ================================================================
// ADMIN — INPUT SKOR
// ================================================================
function tInputSkor(matchId) {
  editingMatchId = matchId;
  const { matchList } = store.getState();
  const m = matchList.find((x) => x.id === matchId);
  if (!m) return;
  if (!m.pemain1_id || !m.pemain2_id) {
    alert(
      'Lengkapi kedua pemain dulu (masih ada slot TBD) sebelum input skor. Pakai tombol ✏️ / "Edit Pemain" untuk mengisinya.',
    );
    return;
  }
  skorSetRows = m.set_skor?.length
    ? JSON.parse(JSON.stringify(m.set_skor))
    : [{ p1: "", p2: "" }];
  document.getElementById("t-modal-skor").classList.remove("hidden");
  _renderSetRows();
}
function tCloseSkorModal() {
  document.getElementById("t-modal-skor").classList.add("hidden");
}
function tTambahSetRow() {
  skorSetRows.push({ p1: "", p2: "" });
  _renderSetRows();
}
function tHapusSetRow(idx) {
  skorSetRows.splice(idx, 1);
  _renderSetRows();
}

function _renderSetRows() {
  const el = document.getElementById("t-set-rows");
  el.innerHTML = skorSetRows
    .map(
      (s, i) => `
    <div class="flex items-center gap-2 mb-2">
      <span class="text-xs text-gray-400 w-12">Set ${i + 1}</span>
      <input type="number" min="0" value="${s.p1}" data-idx="${i}" data-field="p1"
        class="t-set-input w-full border border-gray-200 rounded px-2 py-1 text-sm" placeholder="P1" />
      <span class="text-gray-300">-</span>
      <input type="number" min="0" value="${s.p2}" data-idx="${i}" data-field="p2"
        class="t-set-input w-full border border-gray-200 rounded px-2 py-1 text-sm" placeholder="P2" />
      <button onclick="tHapusSetRow(${i})" class="text-red-400 text-xs px-1">✕</button>
    </div>`,
    )
    .join("");
  el.querySelectorAll(".t-set-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      skorSetRows[idx][field] = e.target.value;
    });
  });
}

async function tSubmitSkor() {
  const msg = document.getElementById("t-skor-msg");
  msg.classList.add("hidden");
  const sets = skorSetRows
    .filter((s) => s.p1 !== "" && s.p2 !== "")
    .map((s) => ({ p1: Number(s.p1), p2: Number(s.p2) }));
  if (!sets.length) {
    msg.textContent = "Isi minimal 1 set.";
    msg.classList.remove("hidden");
    return;
  }
  const { eventAktif, user } = store.getState();
  try {
    await matchService.saveScore(editingMatchId, sets, user?.email);
    await logService.record(
      user?.email,
      "input_skor",
      { matchId: editingMatchId, sets },
      eventAktif.id,
    );
    tCloseSkorModal();
    await loadEventData(eventAktif.id);
  } catch (e) {
    msg.textContent = e.message;
    msg.classList.remove("hidden");
  }
}

// ================================================================
// HEAD TO HEAD
// ================================================================
function tRunH2H() {
  const aId = Number(document.getElementById("t-h2h-a").value);
  const bId = Number(document.getElementById("t-h2h-b").value);
  const { pemainList, matchList } = store.getState();
  if (!aId || !bId || aId === bId) {
    document.getElementById("t-h2h-result").innerHTML =
      '<div class="text-center text-red-500 text-sm py-4">Pilih dua pemain berbeda.</div>';
    return;
  }
  const namaA = pemainList.find((p) => p.id === aId)?.nama || "";
  const namaB = pemainList.find((p) => p.id === bId)?.nama || "";
  const hasil = headToHead(aId, bId, matchList);
  document.getElementById("t-h2h-result").innerHTML = renderH2HResult(
    namaA,
    namaB,
    hasil,
  );
}

init();
