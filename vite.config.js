// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  // Root adalah folder pingpong itu sendiri
  root: '.',

  // Output build ke folder dist/
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  // Env vars: Vite baca dari .env secara otomatis
  // VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
  // Di browser bisa diakses via import.meta.env.VITE_SUPABASE_URL

  server: {
    port: 3000,
    open: true,
  },
});
