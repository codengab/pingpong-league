// src/lib/appState.js
// Centralized state management — mirip Zustand/Redux tapi vanilla JS
// Mudah diextend: tinggal tambah properti dan action

export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState()          { return state; },
    setState(partial)   {
      state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
      listeners.forEach(fn => fn(state));
    },
    subscribe(fn)       { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

// Global app store
export const store = createStore({
  // Auth
  user:          null,
  isAdmin:       false,
  authLoading:   true,

  // Sesi
  sesiList:      [],
  sesiAktif:     null,

  // Data per sesi
  matches:       [],       // raw matches untuk sesi aktif
  dataLoading:   false,

  // UI
  activeTab:     'klasemen',
  h2hFilter:     'SESI',   // 'SESI' | 'ALL'
});
