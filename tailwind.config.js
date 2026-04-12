/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan semua file untuk class yang dipakai
  content: [
    './index.html',
    './src/**/*.{js,ts}',
  ],

  // Dark mode via class="dark" di <html>
  darkMode: 'class',

  theme: {
    extend: {},
  },

  // Safelist: class yang dibuat secara dinamis di JS (template literal)
  // Tanpa ini, Tailwind akan menghapusnya karena tidak terdeteksi di scan
  safelist: [
    // Status pemain colors
    'bg-green-100', 'text-green-700',
    'bg-gray-100',  'text-gray-500',
    // Form states
    'bg-green-50',  'text-green-700',
    'bg-red-50',    'text-red-700',
    // H2H bar colors
    'bg-green-500', 'bg-red-400',
    // WinRate bar
    'bg-yellow-400',
    // Hover states di dynamically rendered HTML
    'hover:bg-red-50', 'hover:bg-green-50', 'hover:bg-blue-50',
    'hover:text-red-600', 'hover:text-green-600', 'hover:text-blue-600',
    // Text colors dari JS
    'text-red-600', 'text-green-600',
    // Border active state
    'border-l-4', 'border-blue-600',
    // Row hover
    'hover:bg-blue-50',
    // Form message states
    { pattern: /^(bg|text|border)-(green|red|blue|yellow|gray)-(50|100|200|500|600|700)$/ },
    // Grid responsive
    { pattern: /^grid-cols-\d$/ },
    // Width fractions
    { pattern: /^w-\[.+\]$/ },
  ],

  plugins: [],
};
