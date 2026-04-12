#!/bin/bash
# =============================================================
# Liga Pingpong NIC — Setup Script
# Jalankan sekali saat pertama clone:
#   chmod +x setup.sh && ./setup.sh
# =============================================================

set -e
echo "🏓 Liga Pingpong NIC — Setup"
echo "=============================="

# 1. Install semua npm dependencies (vite, tailwindcss, @supabase/supabase-js)
echo ""
echo "📦 Install npm dependencies..."
npm install
echo "✅ Dependencies terinstall"

# 2. Buat .env dari template jika belum ada
echo ""
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ File .env dibuat dari .env.example"
  echo "⚠️  Sekarang edit .env dan isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY"
else
  echo "✅ File .env sudah ada"
fi

# 3. Download Font Awesome offline (opsional)
echo ""
echo "🔤 Download Font Awesome 6.5 (offline)..."
FA_VERSION="6.5.0"
mkdir -p public/assets/fontawesome/css
mkdir -p public/assets/fontawesome/webfonts

curl -sL "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/${FA_VERSION}/css/all.min.css" \
  -o public/assets/fontawesome/css/all.min.css && \
  sed -i 's|../webfonts/|/public/assets/fontawesome/webfonts/|g' \
    public/assets/fontawesome/css/all.min.css && \
  echo "✅ Font Awesome CSS downloaded" || echo "⚠️  Download FA gagal, akan pakai CDN fallback"

FONTS=(fa-solid-900.woff2 fa-solid-900.ttf fa-regular-400.woff2 fa-regular-400.ttf fa-brands-400.woff2 fa-brands-400.ttf)
FONT_BASE="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/${FA_VERSION}/webfonts"
for font in "${FONTS[@]}"; do
  curl -sL "${FONT_BASE}/${font}" -o "public/assets/fontawesome/webfonts/${font}" \
    && echo "  ✅ $font" || echo "  ⚠️  $font gagal"
done

echo ""
echo "=============================="
echo "✅ Setup selesai!"
echo ""
echo "Langkah selanjutnya:"
echo "  1. Edit .env — isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY"
echo "  2. npm run dev    → start dev server (http://localhost:3000)"
echo ""
echo "Perintah lain:"
echo "  npm run build    → build untuk production (output: dist/)"
echo "  npm run preview  → preview hasil build"
