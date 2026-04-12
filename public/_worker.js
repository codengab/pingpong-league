// public/_worker.js
// Cloudflare Pages Worker — inject env vars ke /env.js saat runtime
// Ini agar SUPABASE_URL dan ANON_KEY tidak perlu di-hardcode di file static

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve /env.js dengan nilai dari Cloudflare Environment Variables
    if (url.pathname === '/env.js') {
      const envConfig = {
        SUPABASE_URL:      env.SUPABASE_URL      ?? '',
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY ?? '',
      };

      return new Response(
        `window.__ENV = ${JSON.stringify(envConfig)};`,
        {
          headers: {
            'Content-Type':  'application/javascript',
            'Cache-Control': 'no-store', // jangan cache env vars
          },
        }
      );
    }

    // Semua request lain → serve file static biasa
    return env.ASSETS.fetch(request);
  },
};
