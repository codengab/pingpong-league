// src/main.js
// Entry point utama — semua logika UI dan app flow ada di sini

import { authService }    from './services/authService.js';
import { supabase }       from './lib/supabase.js';
import { matchService, resetSkor, updateJadwal, subscribeMatch } from './services/matchService.js';
import { sesiService }    from './services/sesiService.js';
import { pemainService }  from './services/pemainService.js';
import { logService }     from './services/logService.js';
import { generatePasangan, distribusiTanggal, toDbRows } from './lib/scheduleGenerator.js';
import { hitungKlasemen } from './lib/klasemenCalculator.js';
import { renderKlasemen, renderJadwal, renderHasil, renderPodium, renderDetailPemain } from './components/renderer.js';
import { store }          from './lib/appState.js';

// ── Expose semua fungsi untuk onclick= di HTML ────────────────
Object.assign(window, {
  showTab, onSesiChange, openDetail, closeDetail, renderH2HToggle,
  openModal, closeModal, filterMatchList, selectMatch, submitSkor,
  openModalUbahJadwal, closeModalUbahJadwal, submitUbahJadwal,
  openModalGenerate, closeModalGenerate, kembaliKeStep1, ubahMatchPerHari, jalankanPreview, konfirmasiSimpan,
  openModalRegister, closeModalRegister, submitRegisterAdmin,
  openModalTambahPemain, openModalEditPemain, closeModalPemain, submitPemain, toggleStatusPemain,
  loadLog,
  handleLogin, handleLogout, handleForgotPassword, togglePassword, toggleRegPassword,
  openAuthOverlay, closeAuthOverlay, toggleDarkMode,
  hapusMatch, editMatch,
});

// ── State lokal ───────────────────────────────────────────────
let pendingMatches  = [];
let genMatchPerHari = 2;
let genPreviewData  = null;
let h2hFilter       = 'SESI';
let realtimeChannel = null;
let editingMatchId  = null;

// ── Dark Mode ─────────────────────────────────────────────────
function initDarkMode() {
  const saved = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'true' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
    const icon = document.getElementById('darkmode-icon');
    if (icon) icon.className = 'fas fa-sun text-sm';
  }
}
function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark);
  const icon = document.getElementById('darkmode-icon');
  if (icon) icon.className = isDark ? 'fas fa-sun text-sm' : 'fas fa-moon text-sm';
}
initDarkMode();

// ── Boot ─────────────────────────────────────────────────────
(async () => {
  try {
    const [sesiList, { data: { session } }] = await Promise.all([
      sesiService.getAllSesi(),
      supabase.auth.getSession(),
    ]);

    store.setState({ sesiList });
    const sel = document.getElementById('selectSesi');
    sel.innerHTML = sesiList.map(s => {
      const badge = s.status === 'AKTIF' ? ' 🟢' : s.status === 'DRAFT' ? ' 🟡' : ' ⚪';
      return `<option value="${s.id}">${s.nama} (${s.keterangan})${badge}</option>`;
    }).join('');

    const first = sesiList[0];
    sel.value = first.id;
    store.setState({ sesiAktif: first.id });
    tampilkanInfoSesi(first);

    // Cek isAdmin DULU sebelum loadAllData agar render pertama langsung benar
    if (session?.user) {
      store.setState({ user: session.user });
      const isAdmin = await authService.isAdmin();
      store.setState({ isAdmin });
    }

    await loadAllData(first.id);

    // Update UI admin setelah data ada
    if (store.getState().isAdmin) {
      updateAdminUI(true);
    }
  } catch (e) {
    console.error('Init error:', e);
  }
})();

// Auth state listener
authService.onAuthChange(async ({ event, session }) => {
  const user = session?.user ?? null;

  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
    store.setState({ user });
    if (store.getState().isAdmin) updateAdminUI(true);
    return;
  }
  if (event === 'INITIAL_SESSION') {
    store.setState({ user, authLoading: false });
    if (store.getState().isAdmin) updateAdminUI(true);
    return;
  }
  if (event === 'SIGNED_IN') {
    store.setState({ user, authLoading: false });
    if (user && !store.getState().isAdmin) {
      const admin = await authService.isAdmin();
      store.setState({ isAdmin: admin });
      updateAdminUI(admin);
    }
    return;
  }
  if (event === 'SIGNED_OUT') {
    store.setState({ user: null, isAdmin: false, authLoading: false });
    updateAdminUI(false);
  }
});

// ── Data Loading ──────────────────────────────────────────────
async function loadAllData(sesiId) {
  store.setState({ dataLoading: true });
  try {
    const matches = await matchService.getMatchesBySesi(sesiId);
    store.setState({ matches });
    renderAll(matches);
    setupRealtime(sesiId);
  } catch (e) {
    console.error('Load error:', e);
  } finally {
    store.setState({ dataLoading: false });
  }
}

function renderAll(matches) {
  const { isAdmin } = store.getState();
  document.getElementById('body-klasemen').innerHTML = renderKlasemen(matches);
  document.getElementById('list-jadwal').innerHTML   = renderJadwal(matches, isAdmin);
  document.getElementById('list-hasil').innerHTML    = renderHasil(matches, isAdmin);
  renderPodium(matches);
  document.querySelectorAll('.row-pemain').forEach(r =>
    r.addEventListener('click', () => openDetail(r.dataset.nama))
  );
}

// ── Realtime ──────────────────────────────────────────────────
function setupRealtime(sesiId) {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = subscribeMatch(sesiId, async () => {
    const matches = await matchService.getMatchesBySesi(sesiId);
    store.setState({ matches });
    renderAll(matches);
  });
  const rt = document.getElementById('rt-indicator');
  if (rt) { rt.classList.remove('hidden'); rt.classList.add('flex'); }
}

// ── Tabs ──────────────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
  document.getElementById('tab-' + tab)?.classList.remove('hidden');
  document.querySelectorAll('[id^="btn-"]').forEach(b => b.classList.remove('tab-active'));
  document.getElementById('btn-' + tab)?.classList.add('tab-active');
  if (tab === 'log')    loadLog();
  if (tab === 'pemain') loadPemain();
}

// ── Sesi ──────────────────────────────────────────────────────
async function onSesiChange() {
  const sesiId = document.getElementById('selectSesi').value;
  const sesi   = store.getState().sesiList.find(s => String(s.id) === sesiId);
  store.setState({ sesiAktif: sesiId });
  tampilkanInfoSesi(sesi);
  await loadAllData(sesiId);
}

function tampilkanInfoSesi(sesi) {
  if (!sesi) return;
  const fmt = d => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';
  const c = sesi.status === 'AKTIF' ? 'text-green-600' : sesi.status === 'DRAFT' ? 'text-yellow-600' : 'text-gray-400';
  const el = document.getElementById('infoSesi');
  if (!el) return;
  el.innerHTML = `${fmt(sesi.tgl_mulai)} – ${fmt(sesi.tgl_selesai)} | Status: <span class="${c} font-semibold">${sesi.status}</span>`;
  el.classList.remove('hidden');
}

// ── Auth UI ───────────────────────────────────────────────────
function updateAdminUI(isAdmin) {
  const fab       = document.getElementById('fab-admin');
  const badge     = document.getElementById('admin-badge');
  const btnLogin  = document.getElementById('btn-show-login');
  const adminTabs = document.querySelectorAll('.admin-tab');

  if (isAdmin) {
    fab?.classList.remove('hidden'); fab?.classList.add('flex');
    badge?.classList.remove('hidden'); badge?.classList.add('flex');
    if (btnLogin) btnLogin.classList.add('hidden');
    adminTabs.forEach(t => t.classList.remove('hidden'));
    closeAuthOverlay();
  } else {
    if (store.getState().isAdmin) return;
    fab?.classList.add('hidden'); fab?.classList.remove('flex');
    badge?.classList.add('hidden'); badge?.classList.remove('flex');
    if (btnLogin) btnLogin.classList.remove('hidden');
    adminTabs.forEach(t => t.classList.add('hidden'));
  }

  // Re-render jadwal & hasil agar tombol edit/hapus muncul/hilang
  const { matches } = store.getState();
  if (matches?.length) {
    document.getElementById('list-jadwal').innerHTML = renderJadwal(matches, isAdmin);
    document.getElementById('list-hasil').innerHTML  = renderHasil(matches, isAdmin);
    document.querySelectorAll('.row-pemain').forEach(r =>
      r.addEventListener('click', () => openDetail(r.dataset.nama))
    );
  }
}

function openAuthOverlay() {
  document.getElementById('auth-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('auth-email')?.focus(), 100);
}

function closeAuthOverlay() {
  document.getElementById('auth-overlay').classList.add('hidden');
  const email = document.getElementById('auth-email');
  const pass  = document.getElementById('auth-password');
  const msg   = document.getElementById('auth-msg');
  if (email) email.value = '';
  if (pass)  { pass.value = ''; pass.type = 'password'; }
  if (msg)   msg.classList.add('hidden');
  const icon = document.getElementById('eye-icon');
  if (icon) icon.className = 'fas fa-eye text-sm';
}

async function handleLogin() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const btnEl    = document.getElementById('auth-btn-login');
  if (!email)    { showAuthMsg('Masukkan email.', 'error'); return; }
  if (!password) { showAuthMsg('Masukkan password.', 'error'); return; }

  btnEl.disabled = true;
  btnEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Masuk...';
  try {
    await authService.login(email, password);
    const isAdmin = await authService.isAdmin();
    if (isAdmin) {
      store.setState({ isAdmin: true });
      updateAdminUI(true);
    } else {
      showAuthMsg('⚠️ Akun ini bukan admin.', 'error');
      await authService.logout();
    }
  } catch (e) {
    const msg = e.message?.toLowerCase().includes('invalid')
      ? 'Email atau password salah.'
      : (e.message || 'Login gagal.');
    showAuthMsg('❌ ' + msg, 'error');
  } finally {
    btnEl.disabled = false;
    btnEl.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Masuk';
  }
}

async function handleForgotPassword() {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { showAuthMsg('Isi email dulu.', 'error'); return; }
  try {
    await authService.resetPassword(email);
    showAuthMsg('✅ Email reset dikirim. Cek inbox.', 'success');
  } catch (e) {
    showAuthMsg('❌ ' + e.message, 'error');
  }
}

async function handleLogout() {
  await authService.logout();
  store.setState({ user: null, isAdmin: false });
  updateAdminUI(false);
}

function togglePassword() {
  const inp = document.getElementById('auth-password');
  const icon = document.getElementById('eye-icon');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  icon.className = show ? 'fas fa-eye-slash text-sm' : 'fas fa-eye text-sm';
}

function toggleRegPassword() {
  const inp = document.getElementById('reg-password');
  const icon = document.getElementById('reg-eye-icon');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  icon.className = show ? 'fas fa-eye-slash text-sm' : 'fas fa-eye text-sm';
}

function showAuthMsg(text, type) {
  const el = document.getElementById('auth-msg');
  el.textContent = text;
  el.className = 'mt-4 p-3 rounded-xl text-center text-sm ' +
    (type === 'success'
      ? 'bg-green-50 text-green-700 border border-green-200'
      : 'bg-red-50 text-red-700 border border-red-200');
  el.classList.remove('hidden');
}

// ── Detail Pemain ─────────────────────────────────────────────
async function openDetail(nama, filter) {
  h2hFilter = filter || h2hFilter;
  document.getElementById('detailNamaPemain').textContent = nama;
  document.getElementById('modalDetail').classList.remove('hidden');
  renderH2HToggle(nama);

  ['detailStatistik', 'detailListHasil', 'detailListJadwal', 'detailH2H', 'detailWinRateSet'].forEach(id => {
    document.getElementById(id).innerHTML =
      '<div class="animate-pulse text-gray-400 text-xs py-4 text-center">Memuat...</div>';
  });

  let matchesUntukDetail;
  if (h2hFilter === 'ALL') {
    try {
      matchesUntukDetail = await matchService.getAllMatchesRaw();
    } catch (e) {
      console.error('Gagal fetch all matches:', e);
      matchesUntukDetail = store.getState().matches;
    }
  } else {
    matchesUntukDetail = store.getState().matches;
  }

  const { statsHtml, hasilHtml, jadwalHtml, h2hHtml, wrHtml } =
    renderDetailPemain(nama, matchesUntukDetail, []);

  document.getElementById('detailStatistik').innerHTML  = statsHtml;
  document.getElementById('detailListHasil').innerHTML  = hasilHtml;
  document.getElementById('detailListJadwal').innerHTML = jadwalHtml;
  document.getElementById('detailH2H').innerHTML        = h2hHtml;
  document.getElementById('detailWinRateSet').innerHTML = wrHtml;
}

function closeDetail() {
  document.getElementById('modalDetail').classList.add('hidden');
}

function renderH2HToggle(nama) {
  const btn = (label, f, active) =>
    `<button onclick="openDetail('${nama}','${f}')"
      class="px-3 py-1 text-xs font-semibold rounded-lg transition-all ${active
        ? 'bg-gray-100 text-slate-700'
        : 'bg-gray-800 text-gray-400'}">${label}</button>`;
  document.getElementById('h2hToggle').innerHTML =
    btn('Sesi Ini', 'SESI', h2hFilter === 'SESI') +
    btn('Semua',    'ALL',  h2hFilter === 'ALL');
}

// ── Input / Edit Skor ─────────────────────────────────────────
async function openModal(matchId = null) {
  editingMatchId = matchId;
  const isEdit = matchId !== null;
  document.getElementById('modal-skor-title').textContent    = isEdit ? 'Edit Skor' : 'Input Skor';
  document.getElementById('match-picker').style.display      = isEdit ? 'none' : '';
  document.getElementById('previewPemain').classList.add('hidden');
  document.getElementById('matchId').value    = matchId || '';
  document.getElementById('skor-msg').classList.add('hidden');
  document.getElementById('inp-wo').value     = '';
  document.getElementById('inp-tgl').value    = '';
  ['inp-s1', 'inp-s2', 'inp-s3', 'inp-s4', 'inp-s5'].forEach(id => {
    document.getElementById(id).value = '';
  });

  if (isEdit) {
    const { matches } = store.getState();
    const m = matches.find(x => x.id == matchId);
    if (m) {
      document.getElementById('previewP1').textContent = m.pemain_1 + ' (P1)';
      document.getElementById('previewP2').textContent = m.pemain_2 + ' (P2)';
      document.getElementById('previewPemain').classList.remove('hidden');
      if (m.tanggal) document.getElementById('inp-tgl').value = new Date(m.tanggal).toISOString().slice(0, 16);
      ['s1', 's2', 's3', 's4', 's5'].forEach(k => {
        document.getElementById('inp-' + k).value = m[k] || '';
      });
      if (m.skor_akhir?.includes('W')) document.getElementById('inp-wo').value = m.skor_akhir;
    }
  } else {
    document.getElementById('searchMatch').value = '';
    document.getElementById('matchListContainer').innerHTML =
      '<div class="p-4 text-center text-xs text-gray-400">Memuat...</div>';
    pendingMatches = await matchService.getPendingMatches(store.getState().sesiAktif);
    renderMatchList(pendingMatches);
  }
  document.getElementById('modalInput').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalInput').classList.add('hidden');
  editingMatchId = null;
}

function renderMatchList(matches) {
  const c = document.getElementById('matchListContainer');
  if (!matches.length) {
    c.innerHTML = '<p class="p-4 text-center text-sm text-gray-400 italic">Tidak ada jadwal pending.</p>';
    return;
  }
  c.innerHTML = matches.map(m =>
    `<div onclick="selectMatch(this,'${m.id}','${m.pemain_1}','${m.pemain_2}')"
      class="match-item p-3 bg-white hover:bg-blue-50 cursor-pointer flex justify-between items-center group">
      <span class="text-sm font-medium text-gray-700">${m.pemain_1} vs ${m.pemain_2}</span>
      <i class="fas fa-check-circle text-blue-500 opacity-0 group-hover:opacity-100"></i>
    </div>`
  ).join('');
}

function filterMatchList() {
  const kw = document.getElementById('searchMatch').value.toLowerCase();
  renderMatchList(pendingMatches.filter(m =>
    m.pemain_1.toLowerCase().includes(kw) || m.pemain_2.toLowerCase().includes(kw)
  ));
}

function selectMatch(el, id, p1, p2) {
  document.querySelectorAll('.match-item').forEach(i =>
    i.classList.remove('bg-blue-100', 'border-l-4', 'border-blue-600')
  );
  el.classList.add('bg-blue-100', 'border-l-4', 'border-blue-600');
  document.getElementById('matchId').value = id;
  document.getElementById('searchMatch').value = `✓ ${p1} vs ${p2}`;
  document.getElementById('previewP1').textContent = p1 + ' (P1)';
  document.getElementById('previewP2').textContent = p2 + ' (P2)';
  document.getElementById('previewPemain').classList.remove('hidden');
}

function showSkorMsg(text, type) {
  const el = document.getElementById('skor-msg');
  el.textContent = text;
  el.className = 'p-2 rounded-lg text-xs text-center ' +
    (type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700');
  el.classList.remove('hidden');
}

async function submitSkor() {
  const matchId = document.getElementById('matchId').value;
  if (!matchId) { showSkorMsg('Pilih pertandingan terlebih dahulu!', 'error'); return; }

  const wo   = document.getElementById('inp-wo').value;
  const sets = ['inp-s1', 'inp-s2', 'inp-s3', 'inp-s4', 'inp-s5'].map(id =>
    document.getElementById(id).value
  );
  if (!wo && !sets.some(s => s.includes('-'))) {
    showSkorMsg('Isi minimal 1 skor set atau pilih WO.', 'error');
    return;
  }

  const btn = document.getElementById('btnSimpan');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    const isEdit = editingMatchId !== null;
    const { matches } = store.getState();
    const matchBefore = matches.find(m => m.id == matchId);

    const res = await matchService.updateMatch(matchId, {
      tanggal: document.getElementById('inp-tgl').value,
      wo,
      s1: sets[0], s2: sets[1], s3: sets[2], s4: sets[3], s5: sets[4],
    });

    await logService.log(
      isEdit ? 'edit_skor' : 'input_skor',
      { matchId, p1: matchBefore?.pemain_1, p2: matchBefore?.pemain_2,
        skorBefore: matchBefore?.skor_akhir,
        skorAfter: wo || sets.filter(Boolean).join(' | ') },
      store.getState().sesiAktif
    );

    showSkorMsg('✅ ' + res.message, 'success');
    setTimeout(() => closeModal(), 800);
    await loadAllData(store.getState().sesiAktif);
  } catch (e) {
    showSkorMsg('❌ ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan';
  }
}

async function hapusMatch(matchId) {
  const { matches } = store.getState();
  const m = matches.find(x => x.id == matchId);
  if (!confirm(`Hapus pertandingan ${m?.pemain_1} vs ${m?.pemain_2}?\nTindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await resetSkor(matchId);
    await logService.log('hapus_match',
      { matchId, p1: m?.pemain_1, p2: m?.pemain_2, skor: m?.skor_akhir },
      store.getState().sesiAktif
    );
    await loadAllData(store.getState().sesiAktif);
  } catch (e) { alert('Gagal hapus: ' + e.message); }
}

function editMatch(matchId) { openModal(matchId); }

// ── Ubah Jadwal ───────────────────────────────────────────────
function openModalUbahJadwal(matchId) {
  const { matches } = store.getState();
  const m = matches.find(x => x.id == matchId);
  if (!m) return;
  document.getElementById('ubah-match-id').value = matchId;
  document.getElementById('ubah-p1').value  = m.pemain_1;
  document.getElementById('ubah-p2').value  = m.pemain_2;
  document.getElementById('ubah-tgl').value = m.tanggal
    ? new Date(m.tanggal).toISOString().slice(0, 16) : '';
  document.getElementById('ubah-msg').classList.add('hidden');
  document.getElementById('modalUbahJadwal').classList.remove('hidden');
}
function closeModalUbahJadwal() { document.getElementById('modalUbahJadwal').classList.add('hidden'); }

async function submitUbahJadwal() {
  const id  = document.getElementById('ubah-match-id').value;
  const p1  = document.getElementById('ubah-p1').value.trim();
  const p2  = document.getElementById('ubah-p2').value.trim();
  const tgl = document.getElementById('ubah-tgl').value;
  const btn = document.getElementById('btn-ubah-jadwal');
  const showMsg = (t, type) => {
    const el = document.getElementById('ubah-msg');
    el.textContent = t;
    el.className = 'p-2 rounded-lg text-xs text-center ' +
      (type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700');
    el.classList.remove('hidden');
  };

  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    await updateJadwal(id, { tanggal: tgl, pemain1: p1, pemain2: p2 });
    await logService.log('ubah_jadwal', { matchId: id, p1, p2, tgl }, store.getState().sesiAktif);
    showMsg('✅ Jadwal diperbarui!', 'success');
    setTimeout(() => closeModalUbahJadwal(), 800);
    await loadAllData(store.getState().sesiAktif);
  } catch (e) {
    showMsg('❌ ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan';
  }
}

// ── Manajemen Pemain ──────────────────────────────────────────
async function loadPemain() {
  const sesiId = store.getState().sesiAktif;
  const list = document.getElementById('list-pemain');
  list.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm animate-pulse">Memuat...</div>';
  try {
    const pemain = await pemainService.getBySesi(sesiId);
    if (!pemain.length) {
      list.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Belum ada pemain di sesi ini.</div>';
      return;
    }
    list.innerHTML = pemain.map(p => `
      <div class="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between shadow-sm">
        <div>
          <div class="text-sm font-semibold text-gray-800">${p.nama}</div>
          <div class="text-[11px] text-gray-400 mt-0.5">${p.email || 'Tanpa email'}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
            p.status === 'AKTIF' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }">${p.status}</span>
          <button onclick="openModalEditPemain(${p.id},'${p.nama}','${p.email || ''}')"
            class="text-gray-400 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors text-xs">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="toggleStatusPemain(${p.id},'${p.status}')"
            class="text-gray-400 px-2 py-1 rounded-lg transition-colors text-xs ${
              p.status === 'AKTIF'
                ? 'hover:text-red-600 hover:bg-red-50'
                : 'hover:text-green-600 hover:bg-green-50'
            }">
            <i class="fas ${p.status === 'AKTIF' ? 'fa-times' : 'fa-check'}"></i>
          </button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = `<div class="text-center py-6 text-red-400 text-sm">Error: ${e.message}</div>`;
  }
}

function openModalTambahPemain() {
  document.getElementById('modal-pemain-title').textContent = 'Tambah Pemain';
  document.getElementById('pemain-id').value   = '';
  document.getElementById('pemain-nama').value = '';
  document.getElementById('pemain-msg').classList.add('hidden');
  const sel = document.getElementById('pemain-sesi');
  const { sesiList, sesiAktif } = store.getState();
  sel.innerHTML = sesiList.map(s =>
    `<option value="${s.id}" ${String(s.id) === String(sesiAktif) ? 'selected' : ''}>${s.nama}</option>`
  ).join('');
  document.getElementById('modalPemain').classList.remove('hidden');
}

function openModalEditPemain(id, nama, email) {
  document.getElementById('modal-pemain-title').textContent = 'Edit Pemain';
  document.getElementById('pemain-id').value   = id;
  document.getElementById('pemain-nama').value = nama;
  document.getElementById('pemain-msg').classList.add('hidden');
  const sel = document.getElementById('pemain-sesi');
  const { sesiList } = store.getState();
  sel.innerHTML = sesiList.map(s => `<option value="${s.id}">${s.nama}</option>`).join('');
  document.getElementById('modalPemain').classList.remove('hidden');
}

function closeModalPemain() { document.getElementById('modalPemain').classList.add('hidden'); }

async function submitPemain() {
  const id     = document.getElementById('pemain-id').value;
  const nama   = document.getElementById('pemain-nama').value.trim();
  const sesiId = document.getElementById('pemain-sesi').value;
  const btn    = document.getElementById('btn-simpan-pemain');
  const showMsg = (t, type) => {
    const el = document.getElementById('pemain-msg');
    el.textContent = t;
    el.className = 'p-2 rounded-lg text-xs text-center ' +
      (type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700');
    el.classList.remove('hidden');
  };

  if (!nama) { showMsg('Nama tidak boleh kosong.', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    if (id) {
      await pemainService.edit(id, { nama });
      await logService.log('edit_pemain', { id, nama }, sesiId);
    } else {
      await pemainService.tambah({ nama, sesiId });
      await logService.log('tambah_pemain', { nama, sesiId }, sesiId);
    }
    showMsg('✅ Tersimpan!', 'success');
    setTimeout(() => { closeModalPemain(); loadPemain(); }, 600);
  } catch (e) {
    showMsg('❌ ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan';
  }
}

async function toggleStatusPemain(id, statusSekarang) {
  const statusBaru = statusSekarang === 'AKTIF' ? 'NON-AKTIF' : 'AKTIF';
  if (!confirm(`${statusBaru === 'NON-AKTIF' ? 'Nonaktifkan' : 'Aktifkan kembali'} pemain ini?`)) return;
  try {
    await pemainService.toggleStatus(id, statusBaru);
    await logService.log(
      statusBaru === 'AKTIF' ? 'aktif_pemain' : 'nonaktif_pemain',
      { id }, store.getState().sesiAktif
    );
    await loadPemain();
  } catch (e) { alert('Gagal: ' + e.message); }
}

// ── Log Aktivitas ─────────────────────────────────────────────
async function loadLog() {
  const list = document.getElementById('list-log');
  list.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm animate-pulse">Memuat...</div>';
  try {
    const logs = await logService.getLogs(80);
    if (!logs.length) {
      list.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Belum ada log aktivitas.</div>';
      return;
    }
    const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    list.innerHTML = logs.map(l => {
      const d   = new Date(l.created_at);
      const tgl = `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} `
        + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      const detail = l.detail
        ? Object.entries(l.detail)
            .filter(([k]) => !['matchId','id'].includes(k))
            .map(([k, v]) => `${k}: ${v}`)
            .join(' • ')
        : '';
      return `
        <div class="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <div class="text-sm font-semibold text-gray-800">${logService.formatAction(l.action)}</div>
              ${detail ? `<div class="text-[11px] text-gray-500 mt-0.5 truncate">${detail}</div>` : ''}
            </div>
            <div class="text-right shrink-0">
              <div class="text-[11px] text-gray-400">${tgl}</div>
              <div class="text-[10px] text-blue-500">${l.admin_email.split('@')[0]}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    list.innerHTML = `<div class="text-center py-6 text-red-400 text-sm">Error: ${e.message}</div>`;
  }
}

// ── Generate Jadwal ───────────────────────────────────────────
function openModalGenerate() {
  const { sesiList, sesiAktif } = store.getState();
  const sel = document.getElementById('gen-sesi');
  sel.innerHTML = '<option value="">-- Pilih Sesi --</option>' +
    sesiList.map(s =>
      `<option value="${s.id}" ${String(s.id) === String(sesiAktif) ? 'selected' : ''}>${s.nama} — ${s.keterangan}</option>`
    ).join('');
  kembaliKeStep1();
  document.getElementById('modalGenerate').classList.remove('hidden');
}
function closeModalGenerate() { document.getElementById('modalGenerate').classList.add('hidden'); }
function kembaliKeStep1() {
  document.getElementById('generate-step-1').classList.remove('hidden');
  document.getElementById('generate-step-2').classList.add('hidden');
  genPreviewData = null;
}
function ubahMatchPerHari(d) {
  genMatchPerHari = Math.max(1, Math.min(10, genMatchPerHari + d));
  document.getElementById('val-matchPerHari').textContent = genMatchPerHari;
}

async function jalankanPreview() {
  const sesiId = document.getElementById('gen-sesi').value;
  const mode   = document.querySelector('input[name="gen-mode"]:checked').value;
  if (!sesiId) { alert('Pilih sesi!'); return; }
  try {
    const { sesiList } = store.getState();
    const sesi    = sesiList.find(s => String(s.id) === sesiId);
    const pemain  = await sesiService.getPemainBySesi(sesiId);
    const libur   = await sesiService.getHariLibur();
    const pasangan = generatePasangan(pemain, mode);
    const jadwal   = distribusiTanggal(
      pasangan, new Date(sesi.tgl_mulai), new Date(sesi.tgl_selesai), libur, genMatchPerHari
    );
    const pending  = await matchService.getPendingMatches(sesiId);
    genPreviewData = { sesiId, sesi, mode, jadwal, pemain, sudahAdaJadwal: pending.length > 0 };
    tampilkanPreview(genPreviewData);
  } catch (e) { alert('Error: ' + e.message); }
}

function tampilkanPreview({ jadwal, pemain, sesi, mode, sudahAdaJadwal }) {
  const HARI  = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  document.getElementById('gen-ringkasan').innerHTML = `
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
        <div class="text-[10px] text-green-500 uppercase font-bold">Total Match</div>
        <div class="text-2xl font-black text-green-700">${jadwal.length}</div>
      </div>
      <div class="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
        <div class="text-[10px] text-blue-500 uppercase font-bold">Pemain</div>
        <div class="text-2xl font-black text-blue-700">${pemain.length}</div>
      </div>
    </div>
    <div class="text-xs text-gray-500 space-y-1">
      <div>📅 ${sesi.tgl_mulai} s/d ${sesi.tgl_selesai}</div>
      <div>🔁 Mode: <b>${mode === 'double' ? 'Home & Away' : 'Single'}</b> | 📌 ${genMatchPerHari}/hari</div>
      <div>👥 ${pemain.join(', ')}</div>
    </div>`;

  const grouped = {};
  jadwal.forEach(j => {
    const t = j.tanggal.split(' ')[0];
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(j);
  });

  let html = '', no = 1;
  Object.keys(grouped).sort().forEach(tgl => {
    const d = new Date(tgl);
    const label = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
    html += `<tr class="bg-gray-50"><td colspan="4" class="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase">${label}</td></tr>`;
    grouped[tgl].forEach(m => {
      html += `<tr>
        <td class="px-4 py-2 text-gray-400 text-[10px]">${no++}</td>
        <td class="px-2 py-2 text-gray-700">${m.p1}</td>
        <td class="px-2 py-2 text-center text-gray-300 font-bold">vs</td>
        <td class="px-2 py-2 text-gray-700 text-right">${m.p2}</td>
      </tr>`;
    });
  });
  document.getElementById('gen-tabel-jadwal').innerHTML = html;

  const warn = document.getElementById('gen-warning-overwrite');
  if (sudahAdaJadwal) {
    warn.classList.remove('hidden');
    document.getElementById('chk-overwrite').checked = false;
  } else {
    warn.classList.add('hidden');
  }

  document.getElementById('generate-step-1').classList.add('hidden');
  document.getElementById('generate-step-2').classList.remove('hidden');
}

async function konfirmasiSimpan() {
  if (!genPreviewData) return;
  if (genPreviewData.sudahAdaJadwal && !document.getElementById('chk-overwrite').checked) {
    alert('Centang konfirmasi overwrite!');
    return;
  }
  const btn = document.getElementById('btn-konfirmasi-simpan');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    const { sesiId, jadwal, sudahAdaJadwal } = genPreviewData;
    if (sudahAdaJadwal && document.getElementById('chk-overwrite').checked) {
      await matchService.deletePendingBySesi(sesiId);
    }
    await matchService.bulkInsertJadwal(toDbRows(jadwal, sesiId));
    await logService.log('generate_jadwal', { totalMatch: jadwal.length, mode: genPreviewData.mode }, sesiId);
    alert(`✅ Berhasil generate ${jadwal.length} pertandingan!`);
    closeModalGenerate();
    await loadAllData(store.getState().sesiAktif);
  } catch (e) {
    alert('Gagal: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '✅ Simpan Jadwal';
  }
}

// ── Register Admin ────────────────────────────────────────────
function openModalRegister() { document.getElementById('modalRegister').classList.remove('hidden'); }
function closeModalRegister() {
  document.getElementById('modalRegister').classList.add('hidden');
  ['reg-email', 'reg-password', 'reg-password-confirm'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('reg-msg').classList.add('hidden');
}

async function submitRegisterAdmin() {
  const email   = document.getElementById('reg-email').value.trim();
  const pw      = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-password-confirm').value;
  const btn     = document.getElementById('reg-btn');
  const showMsg = (t, type) => {
    const el = document.getElementById('reg-msg');
    el.textContent = t;
    el.className = 'mb-3 p-2 rounded-lg text-xs text-center ' +
      (type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700');
    el.classList.remove('hidden');
  };

  if (!email)        { showMsg('Masukkan email.', 'error'); return; }
  if (pw.length < 8) { showMsg('Password min. 8 karakter.', 'error'); return; }
  if (pw !== confirm){ showMsg('Password tidak cocok.', 'error'); return; }

  btn.disabled = true; btn.textContent = 'Mendaftarkan...';
  try {
    const res = await authService.registerAdmin(email, pw);
    showMsg('✅ ' + res.message, 'success');
    setTimeout(() => closeModalRegister(), 2000);
  } catch (e) {
    showMsg('❌ ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Daftarkan';
  }
}
