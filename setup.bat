@echo off
REM =============================================================
REM Liga Pingpong NIC — Setup Script (Windows)
REM Jalankan: double click atau via CMD → setup.bat
REM =============================================================

echo.
echo 🏓 Liga Pingpong NIC — Setup
echo ==============================

REM 1. Install npm dependencies
echo.
echo 📦 Install npm dependencies...
call npm install
if %errorlevel% neq 0 (
  echo ❌ Gagal install dependencies
  pause
  exit /b
)
echo ✅ Dependencies terinstall

REM 2. Buat .env jika belum ada
echo.
if not exist .env (
  copy .env.example .env >nul
  echo ✅ File .env dibuat dari .env.example
  echo ⚠️  Edit .env dan isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
) else (
  echo ✅ File .env sudah ada
)

REM 3. Download Font Awesome (pakai PowerShell)
echo.
echo 🔤 Download Font Awesome 6.5 (offline)...

set FA_VERSION=6.5.0

mkdir public\assets\fontawesome\css 2>nul
mkdir public\assets\fontawesome\webfonts 2>nul

REM Download CSS
powershell -Command "try { Invoke-WebRequest -Uri 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/%FA_VERSION%/css/all.min.css' -OutFile 'public/assets/fontawesome/css/all.min.css' -UseBasicParsing; Write-Host '✅ Font Awesome CSS downloaded' } catch { Write-Host '⚠️  Download FA CSS gagal' }"

REM Download fonts
set FONT_BASE=https://cdnjs.cloudflare.com/ajax/libs/font-awesome/%FA_VERSION%/webfonts

for %%f in (
  fa-solid-900.woff2
  fa-solid-900.ttf
  fa-regular-400.woff2
  fa-regular-400.ttf
  fa-brands-400.woff2
  fa-brands-400.ttf
) do (
  powershell -Command "try { Invoke-WebRequest -Uri '%FONT_BASE%/%%f' -OutFile 'public/assets/fontawesome/webfonts/%%f' -UseBasicParsing; Write-Host '  ✅ %%f' } catch { Write-Host '  ⚠️  %%f gagal' }"
)

echo.
echo ==============================
echo ✅ Setup selesai!
echo.

echo Langkah selanjutnya:
echo   1. Edit .env — isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
echo   2. npm run dev    → start dev server (http://localhost:5173)
echo.

echo Perintah lain:
echo   npm run build    → build untuk production (output: dist/)
echo   npm run preview  → preview hasil build

pause